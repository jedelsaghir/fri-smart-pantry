/**
 * Multi-device household sync + member invite registry — server store + RPC.
 *
 * Backends (first match wins):
 * 1. Upstash Redis REST — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * 2. Filesystem — .data/frigg-sync/
 * 3. In-process memory
 *
 * Invites: each family member has a unique inviteCode. Owner registers the code
 * on the server when copying the link so invitees on other devices can resolve
 * Krista’s profile and join the shared household.
 */

import { createServerFn } from "@tanstack/react-start";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HOUSEHOLD_SYNC_VERSION,
  hashSyncPassword,
  type HouseholdSyncAccount,
  type HouseholdSyncSnapshot,
  validateSnapshot,
} from "@/lib/household-sync";
import type { FamilyMember } from "@/types/pantry";

type StoredRecord = {
  passwordHash: string;
  snapshot: HouseholdSyncSnapshot;
};

/** Public invite record (code is the secret) */
export type HouseholdInviteRecord = {
  code: string;
  ownerEmail: string;
  memberId: string;
  memberName: string;
  memberEmoji: string;
  householdName: string;
  createdAt: string;
  status: "pending" | "accepted";
  acceptedEmail?: string;
};

// Warm-instance fallback
const memoryStore =
  (globalThis as unknown as { __friggKv?: Map<string, string> }).__friggKv ||
  new Map<string, string>();
(globalThis as unknown as { __friggKv: Map<string, string> }).__friggKv = memoryStore;

function accountKey(email: string): string {
  return `frigg:household:${email.trim().toLowerCase()}`;
}

function inviteKey(code: string): string {
  return `frigg:invite:${code.trim().toLowerCase()}`;
}

function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function kvGetJson<T>(key: string): Promise<T | null> {
  if (hasUpstash()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = (await res.json()) as { result?: string | null };
        if (body.result) {
          return typeof body.result === "string"
            ? (JSON.parse(body.result) as T)
            : (body.result as T);
        }
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const dir = process.env.FRIGG_SYNC_DIR || join(process.cwd(), ".data", "frigg-sync");
    const safe = key.replace(/[^a-z0-9:_-]/gi, "_");
    const raw = await readFile(join(dir, `${safe}.json`), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    /* fall through */
  }
  const mem = memoryStore.get(key);
  if (!mem) return null;
  try {
    return JSON.parse(mem) as T;
  } catch {
    return null;
  }
}

async function kvSetJson(key: string, value: unknown): Promise<"upstash" | "fs" | "memory"> {
  const text = JSON.stringify(value);
  if (hasUpstash()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL!;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
      await fetch(`${url}/set/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: text,
      });
      memoryStore.set(key, text);
      return "upstash";
    } catch {
      /* fall through */
    }
  }
  try {
    const dir = process.env.FRIGG_SYNC_DIR || join(process.cwd(), ".data", "frigg-sync");
    await mkdir(dir, { recursive: true });
    const safe = key.replace(/[^a-z0-9:_-]/gi, "_");
    await writeFile(join(dir, `${safe}.json`), text, "utf8");
    memoryStore.set(key, text);
    return "fs";
  } catch {
    memoryStore.set(key, text);
    return "memory";
  }
}

async function getHouseholdRecord(email: string): Promise<StoredRecord | null> {
  return kvGetJson<StoredRecord>(accountKey(email));
}

async function setHouseholdRecord(
  email: string,
  record: StoredRecord
): Promise<"upstash" | "fs" | "memory"> {
  return kvSetJson(accountKey(email), record);
}

/** Write snapshot for owner + every household account (demo passwords enable fan-out) */
async function fanOutHousehold(
  snapshot: HouseholdSyncSnapshot,
  primaryEmail: string,
  primaryHash: string
): Promise<"upstash" | "fs" | "memory"> {
  let backend = await setHouseholdRecord(primaryEmail, {
    passwordHash: primaryHash,
    snapshot: { ...snapshot, email: primaryEmail },
  });

  const accounts = snapshot.accounts || [];
  for (const acct of accounts) {
    const em = (acct.email || "").trim().toLowerCase();
    if (!em || em === primaryEmail || !acct.password) continue;
    try {
      const h = await hashSyncPassword(em, acct.password);
      backend = await setHouseholdRecord(em, {
        passwordHash: h,
        snapshot: { ...snapshot, email: em },
      });
    } catch {
      /* skip bad account */
    }
  }
  return backend;
}

export type SyncStatusResult = {
  configured: boolean;
  backend: "upstash" | "fs" | "memory" | "none";
  durable: boolean;
};

export const getHouseholdSyncStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<SyncStatusResult> => {
    if (hasUpstash()) {
      return { configured: true, backend: "upstash", durable: true };
    }
    try {
      const dir = process.env.FRIGG_SYNC_DIR || join(process.cwd(), ".data", "frigg-sync");
      await mkdir(dir, { recursive: true });
      return { configured: true, backend: "fs", durable: true };
    } catch {
      return { configured: true, backend: "memory", durable: false };
    }
  }
);

export type PullInput = { email: string; password: string };

export const pullHouseholdSync = createServerFn({ method: "POST" })
  .validator((data: PullInput) => {
    if (!data?.email?.trim() || !data?.password) throw new Error("Email and password required");
    return { email: data.email.trim().toLowerCase(), password: data.password };
  })
  .handler(
    async ({
      data,
    }): Promise<
      { ok: true; snapshot: HouseholdSyncSnapshot | null } | { ok: false; reason: string }
    > => {
      const hash = await hashSyncPassword(data.email, data.password);
      const record = await getHouseholdRecord(data.email);
      if (!record) return { ok: true, snapshot: null };
      if (record.passwordHash !== hash) {
        return {
          ok: false,
          reason: "Password does not match the cloud household for this email.",
        };
      }
      try {
        return { ok: true, snapshot: validateSnapshot(record.snapshot) };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "Corrupt snapshot" };
      }
    }
  );

export type PushInput = {
  email: string;
  password: string;
  snapshot: HouseholdSyncSnapshot;
};

export const pushHouseholdSync = createServerFn({ method: "POST" })
  .validator((data: PushInput) => {
    if (!data?.email?.trim() || !data?.password) throw new Error("Email and password required");
    if (!data.snapshot) throw new Error("Snapshot required");
    return {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      snapshot: data.snapshot,
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; backend: string; updatedAt: string } | { ok: false; reason: string }> => {
      try {
        const hash = await hashSyncPassword(data.email, data.password);
        const existing = await getHouseholdRecord(data.email);
        if (existing && existing.passwordHash !== hash) {
          return {
            ok: false,
            reason: "Password does not match the existing cloud household for this email.",
          };
        }

        const snapshot = validateSnapshot({
          ...data.snapshot,
          version: HOUSEHOLD_SYNC_VERSION,
          email: data.email,
          updatedAt: new Date().toISOString(),
        });

        const backend = await fanOutHousehold(snapshot, data.email, hash);
        return { ok: true, backend, updatedAt: snapshot.updatedAt };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "Push failed" };
      }
    }
  );

// ---------------------------------------------------------------------------
// Member-specific invites (unique code → Krista’s profile slot)
// ---------------------------------------------------------------------------

export type RegisterInviteInput = {
  email: string;
  password: string;
  code: string;
  memberId: string;
  memberName: string;
  memberEmoji: string;
  householdName: string;
  /** Current household snapshot so invitees can join even before their own login pull */
  snapshot?: HouseholdSyncSnapshot;
};

export const registerHouseholdInvite = createServerFn({ method: "POST" })
  .validator((data: RegisterInviteInput) => {
    if (!data?.email?.trim() || !data?.password) throw new Error("Owner credentials required");
    if (!data.code?.trim() || !data.memberId?.trim() || !data.memberName?.trim()) {
      throw new Error("Invite code, member id, and name are required");
    }
    return {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      code: data.code.trim(),
      memberId: data.memberId.trim(),
      memberName: data.memberName.trim(),
      memberEmoji: (data.memberEmoji || "👤").trim(),
      householdName: (data.householdName || "Family pantry").trim(),
      snapshot: data.snapshot,
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; code: string } | { ok: false; reason: string }> => {
      try {
        const hash = await hashSyncPassword(data.email, data.password);
        let record = await getHouseholdRecord(data.email);
        if (record && record.passwordHash !== hash) {
          return { ok: false, reason: "Owner password does not match cloud household." };
        }

        // Ensure latest snapshot is stored (and fan-out) when provided
        if (data.snapshot) {
          const snapshot = validateSnapshot({
            ...data.snapshot,
            version: HOUSEHOLD_SYNC_VERSION,
            email: data.email,
            updatedAt: new Date().toISOString(),
          });
          // Verify invitee member exists in snapshot family list
          const members = snapshot.familyMembers || [];
          const slot = members.find((m) => m.id === data.memberId || m.inviteCode === data.code);
          if (!slot) {
            return {
              ok: false,
              reason: "Member not found in household — save family members and try again.",
            };
          }
          await fanOutHousehold(snapshot, data.email, hash);
          record = { passwordHash: hash, snapshot };
        } else if (!record) {
          return {
            ok: false,
            reason: "Push household once before inviting (no cloud household yet).",
          };
        }

        const invite: HouseholdInviteRecord = {
          code: data.code,
          ownerEmail: data.email,
          memberId: data.memberId,
          memberName: data.memberName,
          memberEmoji: data.memberEmoji,
          householdName: data.householdName,
          createdAt: new Date().toISOString(),
          status: "pending",
        };
        await kvSetJson(inviteKey(data.code), invite);
        return { ok: true, code: data.code };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "Register invite failed" };
      }
    }
  );

export type ResolveInviteInput = { code: string };

export const resolveHouseholdInvite = createServerFn({ method: "POST" })
  .validator((data: ResolveInviteInput) => {
    if (!data?.code?.trim()) throw new Error("Invite code required");
    return { code: data.code.trim() };
  })
  .handler(
    async ({
      data,
    }): Promise<
      | {
          ok: true;
          invite: {
            code: string;
            memberId: string;
            memberName: string;
            memberEmoji: string;
            householdName: string;
            ownerEmail: string;
            status: string;
          };
        }
      | { ok: false; reason: string }
    > => {
      const invite = await kvGetJson<HouseholdInviteRecord>(inviteKey(data.code));
      if (!invite) {
        return { ok: false, reason: "Invite not found. Ask the owner to copy the link again." };
      }
      if (invite.status === "accepted") {
        return {
          ok: false,
          reason: "This invite was already used. Ask the owner for a new invite if needed.",
        };
      }
      return {
        ok: true,
        invite: {
          code: invite.code,
          memberId: invite.memberId,
          memberName: invite.memberName,
          memberEmoji: invite.memberEmoji,
          householdName: invite.householdName,
          ownerEmail: invite.ownerEmail,
          status: invite.status,
        },
      };
    }
  );

export type AcceptInviteInput = {
  code: string;
  email: string;
  password: string;
  name?: string;
  emoji?: string;
};

export const acceptHouseholdInvite = createServerFn({ method: "POST" })
  .validator((data: AcceptInviteInput) => {
    if (!data?.code?.trim() || !data?.email?.trim() || !data?.password) {
      throw new Error("Code, email, and password are required");
    }
    return {
      code: data.code.trim(),
      email: data.email.trim().toLowerCase(),
      password: data.password,
      name: data.name?.trim(),
      emoji: data.emoji?.trim(),
    };
  })
  .handler(
    async ({
      data,
    }): Promise<
      | { ok: true; snapshot: HouseholdSyncSnapshot; accountId: string; memberId: string }
      | { ok: false; reason: string }
    > => {
      try {
        const invite = await kvGetJson<HouseholdInviteRecord>(inviteKey(data.code));
        if (!invite) {
          return { ok: false, reason: "Invite not found. Ask the owner to re-copy the invite link." };
        }
        if (invite.status === "accepted" && invite.acceptedEmail !== data.email) {
          return { ok: false, reason: "This invite was already used by someone else." };
        }

        const ownerRecord = await getHouseholdRecord(invite.ownerEmail);
        if (!ownerRecord?.snapshot) {
          return {
            ok: false,
            reason: "Household is not on the cloud yet. Owner should open the app and Sync now.",
          };
        }

        let snapshot = validateSnapshot(ownerRecord.snapshot);
        const members: FamilyMember[] = [...(snapshot.familyMembers || [])];
        const idx = members.findIndex(
          (m) =>
            m.id === invite.memberId ||
            m.inviteCode?.toLowerCase() === invite.code.toLowerCase()
        );
        if (idx < 0) {
          return { ok: false, reason: "This member is no longer in the household." };
        }

        const displayName = (data.name || invite.memberName || "Member").trim();
        const emoji = data.emoji || invite.memberEmoji || "👤";
        const accountId = `acct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

        // Only one isYou in the shared snapshot — joiner is isYou on their device after apply
        const updatedMembers = members.map((m, i) => {
          if (i === idx) {
            return {
              ...m,
              name: displayName,
              emoji,
              email: data.email,
              status: "joined" as const,
              joinedAt: m.joinedAt || new Date().toISOString(),
              inviteCode: m.inviteCode || invite.code,
              isYou: false, // owner remains primary on shared blob; client sets isYou locally
            };
          }
          return { ...m, isYou: m.status === "owner" || m.id === "you" };
        });

        const accounts: HouseholdSyncAccount[] = [...(snapshot.accounts || [])];
        const existingAcctIdx = accounts.findIndex(
          (a) => a.email.toLowerCase() === data.email || a.memberId === invite.memberId
        );
        const newAccount: HouseholdSyncAccount = {
          id: accountId,
          memberId: invite.memberId,
          email: data.email,
          password: data.password,
          name: displayName,
          emoji,
        };
        if (existingAcctIdx >= 0) {
          accounts[existingAcctIdx] = {
            ...accounts[existingAcctIdx],
            ...newAccount,
            id: accounts[existingAcctIdx].id || accountId,
          };
        } else {
          accounts.push(newAccount);
        }

        snapshot = validateSnapshot({
          ...snapshot,
          familyMembers: updatedMembers,
          accounts,
          updatedAt: new Date().toISOString(),
        });

        await fanOutHousehold(snapshot, invite.ownerEmail, ownerRecord.passwordHash);

        // Also write invitee's key with their password
        const inviteeHash = await hashSyncPassword(data.email, data.password);
        await setHouseholdRecord(data.email, {
          passwordHash: inviteeHash,
          snapshot: { ...snapshot, email: data.email },
        });

        const accepted: HouseholdInviteRecord = {
          ...invite,
          status: "accepted",
          acceptedEmail: data.email,
        };
        await kvSetJson(inviteKey(data.code), accepted);

        // Client applies snapshot with isYou for this member
        const clientMembers = updatedMembers.map((m) => ({
          ...m,
          isYou: m.id === invite.memberId,
        }));
        const clientSnapshot = validateSnapshot({
          ...snapshot,
          email: data.email,
          familyMembers: clientMembers,
          profile: {
            name: displayName,
            email: data.email,
            emoji,
            memberId: invite.memberId,
            accountId: existingAcctIdx >= 0 ? accounts[existingAcctIdx].id : accountId,
          },
        });

        return {
          ok: true,
          snapshot: clientSnapshot,
          accountId: existingAcctIdx >= 0 ? accounts[existingAcctIdx].id : accountId,
          memberId: invite.memberId,
        };
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : "Accept invite failed" };
      }
    }
  );
