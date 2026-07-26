/**
 * Household sync + invite server implementation (runtime helpers).
 *
 * Keep separate from createServerFn modules — TanStack production
 * `?tss-serverfn-split` strips sibling helpers and caused live 500s for OCR.
 *
 * Never log or return plain passwords.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HOUSEHOLD_SYNC_VERSION,
  hashSyncPassword,
  sanitizeAccountsForSync,
  validateSnapshot,
  type HouseholdSyncAccount,
  type HouseholdSyncSnapshot,
} from "@/lib/household-sync";
import type { FamilyMember } from "@/types/pantry";

export type StoredRecord = {
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

export type SyncStatusResult = {
  configured: boolean;
  backend: "upstash" | "fs" | "memory" | "none";
  durable: boolean;
  /** Calm multi-device warning when backend cannot survive restarts / multi-instance */
  multiDeviceWarning?: string;
};

export type PullInput = { email: string; password: string };
export type PushInput = {
  email: string;
  password: string;
  snapshot: HouseholdSyncSnapshot;
};
export type RegisterInviteInput = {
  email: string;
  password: string;
  code: string;
  memberId: string;
  memberName: string;
  memberEmoji: string;
  householdName: string;
  snapshot?: HouseholdSyncSnapshot;
};
export type ResolveInviteInput = { code: string };
export type AcceptInviteInput = {
  code: string;
  email: string;
  password: string;
  name?: string;
  emoji?: string;
};
export type RevokeInviteInput = {
  email: string;
  password: string;
  code: string;
};

// Warm-instance fallback
const memoryStore =
  (globalThis as unknown as { __friggKv?: Map<string, string> }).__friggKv ||
  new Map<string, string>();
(globalThis as unknown as { __friggKv: Map<string, string> }).__friggKv = memoryStore;

export function accountKey(email: string): string {
  return `frigg:household:${email.trim().toLowerCase()}`;
}

export function inviteKey(code: string): string {
  return `frigg:invite:${code.trim().toLowerCase()}`;
}

export function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
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

export async function kvSetJson(key: string, value: unknown): Promise<"upstash" | "fs" | "memory"> {
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

export async function getHouseholdRecord(email: string): Promise<StoredRecord | null> {
  return kvGetJson<StoredRecord>(accountKey(email));
}

export async function setHouseholdRecord(
  email: string,
  record: StoredRecord
): Promise<"upstash" | "fs" | "memory"> {
  return kvSetJson(accountKey(email), record);
}

/** Strip plain passwords from a snapshot before any storage write. */
export function sanitizeSnapshotForStore(snapshot: HouseholdSyncSnapshot): HouseholdSyncSnapshot {
  return {
    ...snapshot,
    accounts: sanitizeAccountsForSync(snapshot.accounts),
  };
}

/**
 * Collect household member emails that should receive the shared snapshot.
 * Does not include credentials — only addresses for fan-out.
 */
export function collectHouseholdEmails(
  snapshot: HouseholdSyncSnapshot,
  primaryEmail: string
): string[] {
  const primary = primaryEmail.trim().toLowerCase();
  const set = new Set<string>();
  for (const acct of snapshot.accounts || []) {
    const em = (acct.email || "").trim().toLowerCase();
    if (em && em !== primary) set.add(em);
  }
  for (const m of snapshot.familyMembers || []) {
    const em = (m.email || "").trim().toLowerCase();
    if (em && em !== primary) set.add(em);
  }
  return [...set];
}

/**
 * Write snapshot for primary + every known household email that already has a
 * cloud record. Preserves each email's existing passwordHash — never requires
 * or stores plain passwords. Hash-only accounts in the snapshot can seed a new
 * record only when passwordHash is already present (e.g. post-invite).
 */
export async function fanOutHousehold(
  snapshot: HouseholdSyncSnapshot,
  primaryEmail: string,
  primaryHash: string
): Promise<"upstash" | "fs" | "memory"> {
  const safe = sanitizeSnapshotForStore(snapshot);
  const primary = primaryEmail.trim().toLowerCase();

  let backend = await setHouseholdRecord(primary, {
    passwordHash: primaryHash,
    snapshot: { ...safe, email: primary },
  });

  const emails = collectHouseholdEmails(safe, primary);
  for (const em of emails) {
    try {
      const existing = await getHouseholdRecord(em);
      if (existing?.passwordHash) {
        // Update shared household blob; keep invitee/owner's own auth hash
        backend = await setHouseholdRecord(em, {
          passwordHash: existing.passwordHash,
          snapshot: { ...safe, email: em },
        });
        continue;
      }
      // Seed only when snapshot already carries a passwordHash for this email
      // (set during invite accept — never plain password).
      const acct = (safe.accounts || []).find((a) => a.email?.toLowerCase() === em);
      if (acct?.passwordHash) {
        backend = await setHouseholdRecord(em, {
          passwordHash: acct.passwordHash,
          snapshot: { ...safe, email: em },
        });
      }
    } catch {
      /* skip bad account */
    }
  }
  return backend;
}

/**
 * Optimistic concurrency: reject when cloud is strictly newer than the
 * base revision the client last pulled/pushed (`baseUpdatedAt`).
 * First push (no base) or matching clocks are accepted.
 */
export function shouldAcceptPush(
  existingUpdatedAt: string | undefined | null,
  baseUpdatedAt: string | undefined | null
): boolean {
  if (!existingUpdatedAt) return true;
  if (!baseUpdatedAt) return true; // first device / unknown base — allow seed
  // Accept unless cloud advanced past the client's base
  const existing = Date.parse(existingUpdatedAt);
  const base = Date.parse(baseUpdatedAt);
  if (Number.isNaN(existing)) return true;
  if (Number.isNaN(base)) return true;
  return existing <= base;
}

// ---------------------------------------------------------------------------
// Handler bodies (imported by thin createServerFn wrappers)
// ---------------------------------------------------------------------------

export async function resolveHouseholdSyncStatus(): Promise<SyncStatusResult> {
  if (hasUpstash()) {
    return { configured: true, backend: "upstash", durable: true };
  }
  try {
    const dir = process.env.FRIGG_SYNC_DIR || join(process.cwd(), ".data", "frigg-sync");
    await mkdir(dir, { recursive: true });
    return { configured: true, backend: "fs", durable: true };
  } catch {
    return {
      configured: true,
      backend: "memory",
      durable: false,
      multiDeviceWarning:
        "Sync is in-memory only on this host. Multi-device invites and household restore will not work across restarts or other servers. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (recommended) or FRIGG_SYNC_DIR.",
    };
  }
}

export function validatePullInput(data: PullInput): PullInput {
  if (!data?.email?.trim() || !data?.password) throw new Error("Email and password required");
  return { email: data.email.trim().toLowerCase(), password: data.password };
}

export async function runPullHouseholdSync(
  data: PullInput
): Promise<{ ok: true; snapshot: HouseholdSyncSnapshot | null } | { ok: false; reason: string }> {
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
    return { ok: true, snapshot: validateSnapshot(sanitizeSnapshotForStore(record.snapshot)) };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Corrupt snapshot" };
  }
}

export function validatePushInput(data: PushInput): PushInput {
  if (!data?.email?.trim() || !data?.password) throw new Error("Email and password required");
  if (!data.snapshot) throw new Error("Snapshot required");
  return {
    email: data.email.trim().toLowerCase(),
    password: data.password,
    snapshot: data.snapshot,
  };
}

export async function runPushHouseholdSync(
  data: PushInput
): Promise<
  | { ok: true; backend: string; updatedAt: string }
  | { ok: false; reason: string; remoteUpdatedAt?: string }
> {
  try {
    const hash = await hashSyncPassword(data.email, data.password);
    const existing = await getHouseholdRecord(data.email);
    if (existing && existing.passwordHash !== hash) {
      return {
        ok: false,
        reason: "Password does not match the existing cloud household for this email.",
      };
    }

    const incoming = validateSnapshot({
      ...sanitizeSnapshotForStore(data.snapshot),
      version: HOUSEHOLD_SYNC_VERSION,
      email: data.email,
    });

    const base = incoming.baseUpdatedAt;
    if (
      existing?.snapshot?.updatedAt &&
      !shouldAcceptPush(existing.snapshot.updatedAt, base)
    ) {
      return {
        ok: false,
        reason:
          "Cloud household is newer than this device. Pull first (Sync now), then try again.",
        remoteUpdatedAt: existing.snapshot.updatedAt,
      };
    }

    // Server-side clock for total order after accept
    const snapshot = validateSnapshot({
      ...incoming,
      updatedAt: new Date().toISOString(),
    });

    const backend = await fanOutHousehold(snapshot, data.email, hash);
    return { ok: true, backend, updatedAt: snapshot.updatedAt };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Push failed" };
  }
}

export function validateRegisterInviteInput(data: RegisterInviteInput): RegisterInviteInput {
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
}

export async function runRegisterHouseholdInvite(
  data: RegisterInviteInput
): Promise<{ ok: true; code: string } | { ok: false; reason: string }> {
  try {
    const hash = await hashSyncPassword(data.email, data.password);
    let record = await getHouseholdRecord(data.email);
    if (record && record.passwordHash !== hash) {
      return { ok: false, reason: "Owner password does not match cloud household." };
    }

    if (data.snapshot) {
      const snapshot = validateSnapshot({
        ...sanitizeSnapshotForStore(data.snapshot),
        version: HOUSEHOLD_SYNC_VERSION,
        email: data.email,
        updatedAt: new Date().toISOString(),
      });
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

export function validateResolveInviteInput(data: ResolveInviteInput): ResolveInviteInput {
  if (!data?.code?.trim()) throw new Error("Invite code required");
  return { code: data.code.trim() };
}

export async function runResolveHouseholdInvite(data: ResolveInviteInput): Promise<
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
> {
  const invite = await kvGetJson<HouseholdInviteRecord>(inviteKey(data.code));
  if (!invite) {
    return { ok: false, reason: "Invite not found. Ask the owner to copy the link again." };
  }
  if (invite.status === "accepted") {
    if (invite.acceptedEmail === "__revoked__") {
      return {
        ok: false,
        reason: "This invite was cancelled. Ask the owner to send a new link.",
      };
    }
    return {
      ok: false,
      reason:
        "This invite was already used. Sign in with the account you created, or ask the owner for a new invite.",
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

export function validateAcceptInviteInput(data: AcceptInviteInput): AcceptInviteInput {
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
}

export async function runAcceptHouseholdInvite(data: AcceptInviteInput): Promise<
  | { ok: true; snapshot: HouseholdSyncSnapshot; accountId: string; memberId: string }
  | { ok: false; reason: string }
> {
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

    let snapshot = validateSnapshot(sanitizeSnapshotForStore(ownerRecord.snapshot));
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
    const inviteeHash = await hashSyncPassword(data.email, data.password);

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
          isYou: false,
        };
      }
      return { ...m, isYou: m.status === "owner" || m.id === "you" };
    });

    const accounts: HouseholdSyncAccount[] = [
      ...(sanitizeAccountsForSync(snapshot.accounts) || []),
    ];
    const existingAcctIdx = accounts.findIndex(
      (a) => a.email.toLowerCase() === data.email || a.memberId === invite.memberId
    );
    // Hash only — never plain password in snapshot
    const newAccount: HouseholdSyncAccount = {
      id: accountId,
      memberId: invite.memberId,
      email: data.email,
      passwordHash: inviteeHash,
      name: displayName,
      emoji,
    };
    if (existingAcctIdx >= 0) {
      accounts[existingAcctIdx] = {
        ...accounts[existingAcctIdx],
        ...newAccount,
        id: accounts[existingAcctIdx].id || accountId,
        password: undefined,
      };
    } else {
      accounts.push(newAccount);
    }

    snapshot = validateSnapshot({
      ...snapshot,
      familyMembers: updatedMembers,
      accounts: sanitizeAccountsForSync(accounts),
      updatedAt: new Date().toISOString(),
    });

    await fanOutHousehold(snapshot, invite.ownerEmail, ownerRecord.passwordHash);

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
      accounts: sanitizeAccountsForSync(accounts),
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

export function validateRevokeInviteInput(data: RevokeInviteInput): RevokeInviteInput {
  if (!data?.email?.trim() || !data?.password || !data?.code?.trim()) {
    throw new Error("Owner credentials and invite code required");
  }
  return {
    email: data.email.trim().toLowerCase(),
    password: data.password,
    code: data.code.trim(),
  };
}

export async function runRevokeHouseholdInvite(
  data: RevokeInviteInput
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const hash = await hashSyncPassword(data.email, data.password);
    const record = await getHouseholdRecord(data.email);
    if (!record) {
      return { ok: false, reason: "No cloud household for this owner." };
    }
    if (record.passwordHash !== hash) {
      return { ok: false, reason: "Owner password does not match." };
    }

    const invite = await kvGetJson<HouseholdInviteRecord>(inviteKey(data.code));
    if (!invite) {
      return { ok: true };
    }
    if (invite.ownerEmail.toLowerCase() !== data.email) {
      return { ok: false, reason: "This invite belongs to another household." };
    }

    await kvSetJson(inviteKey(data.code), {
      ...invite,
      status: "accepted",
      acceptedEmail: "__revoked__",
    } satisfies HouseholdInviteRecord);

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Revoke failed" };
  }
}
