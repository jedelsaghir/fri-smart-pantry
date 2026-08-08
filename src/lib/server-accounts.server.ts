/**
 * Server-owned account register / login (Upstash source of truth).
 * Split from household-sync.server for smaller deploys.
 * Password reset via email is deferred.
 */

import {
  getHouseholdRecord,
  setHouseholdRecord,
  sanitizeSnapshotForStore,
} from "@/lib/household-sync.server";
import {
  HOUSEHOLD_SYNC_VERSION,
  hashSyncPassword,
  validateSnapshot,
  type HouseholdSyncSnapshot,
} from "@/lib/household-sync";
import { checkRateLimit, rateKey } from "@/lib/rate-limit.server";

export type RegisterServerAccountInput = {
  email: string;
  password: string;
  name: string;
  emoji: string;
  householdName: string;
};

export type LoginServerAccountInput = {
  email: string;
  password: string;
};

export type ServerAccountProfile = {
  email: string;
  name: string;
  emoji: string;
  householdName: string;
  accountId: string;
  memberId: string;
};

export function validateRegisterServerAccountInput(
  data: RegisterServerAccountInput
): RegisterServerAccountInput {
  if (!data?.email?.trim() || !data?.password) {
    throw new Error("Email and password required");
  }
  if (!data.name?.trim()) throw new Error("Name required");
  return {
    email: data.email.trim().toLowerCase(),
    password: data.password,
    name: data.name.trim(),
    emoji: (data.emoji || "👤").trim() || "👤",
    householdName: (data.householdName || "Family pantry").trim() || "Family pantry",
  };
}

export function validateLoginServerAccountInput(
  data: LoginServerAccountInput
): LoginServerAccountInput {
  if (!data?.email?.trim() || !data?.password) {
    throw new Error("Email and password required");
  }
  return {
    email: data.email.trim().toLowerCase(),
    password: data.password,
  };
}

function buildOwnerBootstrapSnapshot(opts: {
  email: string;
  passwordHash: string;
  name: string;
  emoji: string;
  householdName: string;
  accountId: string;
}): HouseholdSyncSnapshot {
  const now = new Date().toISOString();
  const memberId = "you";
  const shortName = opts.name.split(" ")[0] || "You";
  return {
    version: HOUSEHOLD_SYNC_VERSION,
    updatedAt: now,
    email: opts.email,
    household: opts.householdName,
    profile: {
      name: opts.name,
      email: opts.email,
      emoji: opts.emoji,
      memberId,
      accountId: opts.accountId,
    },
    familyMembers: [
      {
        id: memberId,
        name: shortName,
        emoji: opts.emoji,
        phone: "",
        inviteCode: `own-${Date.now().toString(36)}`,
        status: "owner",
        isYou: true,
        email: opts.email,
      },
    ],
    accounts: [
      {
        id: opts.accountId,
        memberId,
        email: opts.email,
        passwordHash: opts.passwordHash,
        name: opts.name,
        emoji: opts.emoji,
      },
    ],
    items: { fridge: [], freezer: [], pantry: [] },
    catalog: [],
    receipts: [],
    shoppingList: [],
    activityLog: [],
  };
}

/**
 * Create a server-owned account (household record) for this email.
 * Fails if the email already has a cloud household.
 */
export async function runRegisterServerAccount(
  data: RegisterServerAccountInput
): Promise<
  | { ok: true; profile: ServerAccountProfile; backend: string }
  | { ok: false; reason: string }
> {
  try {
    const rl = checkRateLimit(rateKey("register", data.email), {
      limit: 10,
      windowMs: 60_000,
      label: "Too many registrations",
    });
    if (!rl.ok) return { ok: false, reason: rl.message };

    const existing = await getHouseholdRecord(data.email);
    if (existing) {
      return {
        ok: false,
        reason: "An account with this email already exists. Sign in instead.",
      };
    }

    const passwordHash = await hashSyncPassword(data.email, data.password);
    const accountId = `acct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const snapshot = buildOwnerBootstrapSnapshot({
      email: data.email,
      passwordHash,
      name: data.name,
      emoji: data.emoji,
      householdName: data.householdName,
      accountId,
    });

    const backend = await setHouseholdRecord(data.email, {
      passwordHash,
      snapshot: sanitizeSnapshotForStore(snapshot),
    });

    return {
      ok: true,
      backend,
      profile: {
        email: data.email,
        name: data.name,
        emoji: data.emoji,
        householdName: data.householdName,
        accountId,
        memberId: "you",
      },
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Registration failed" };
  }
}

/**
 * Verify email + password against the server household record.
 * Source of truth for multi-device sign-in.
 */
export async function runLoginServerAccount(
  data: LoginServerAccountInput
): Promise<
  | { ok: true; profile: ServerAccountProfile; hasSnapshot: boolean }
  | { ok: false; reason: string; code?: "not_found" | "bad_password" | "rate_limit" | "error" }
> {
  try {
    const rl = checkRateLimit(rateKey("login", data.email), {
      limit: 30,
      windowMs: 60_000,
      label: "Too many sign-in attempts",
    });
    if (!rl.ok) {
      return { ok: false, reason: rl.message, code: "rate_limit" };
    }

    const record = await getHouseholdRecord(data.email);
    if (!record) {
      return {
        ok: false,
        reason: "No server account for this email. Create an account first.",
        code: "not_found",
      };
    }

    const hash = await hashSyncPassword(data.email, data.password);
    if (record.passwordHash !== hash) {
      return { ok: false, reason: "Incorrect password.", code: "bad_password" };
    }

    const snap = record.snapshot;
    const profileFromSnap = snap?.profile;
    const acct =
      (snap?.accounts || []).find(
        (a) => (a.email || "").toLowerCase() === data.email
      ) || (snap?.accounts || [])[0];

    const name =
      (profileFromSnap?.name || acct?.name || data.email.split("@")[0] || "You").trim();
    const emoji = (profileFromSnap?.emoji || acct?.emoji || "👤").trim() || "👤";
    const householdName = (snap?.household || "Family pantry").trim() || "Family pantry";
    const accountId = acct?.id || profileFromSnap?.accountId || `acct-${data.email.replace(/[^a-z0-9]/g, "").slice(0, 16)}`;
    const memberId = acct?.memberId || profileFromSnap?.memberId || "you";

    return {
      ok: true,
      hasSnapshot: Boolean(snap),
      profile: {
        email: data.email,
        name,
        emoji,
        householdName,
        accountId,
        memberId,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Sign-in failed",
      code: "error",
    };
  }
}
