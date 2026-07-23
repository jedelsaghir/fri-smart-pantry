/**
 * Global App Admin — single super-user email with full registered-user visibility.
 * Household owners still use Manage Family; only this email sees the Admin Panel.
 */

import type { FamilyMember } from "@/types/pantry";
import {
  CURRENT_USER_KEY,
  LOGGED_IN_KEY,
  loadAccounts,
  loadFamilyMembers,
  loadHouseholdName,
  saveAccounts,
  saveFamilyMembers,
  type FamilyAccount,
} from "@/lib/family";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { clearSyncCreds } from "@/lib/sync-session";

/** Sole global app admin email (case-insensitive). */
export const GLOBAL_APP_ADMIN_EMAIL = "jed.el.saghir@hotmail.com";

const FORCED_LOGOUT_KEY = "friggg-forced-logout-ids";

export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase();
}

/** True only when the given email is the designated global App Admin. */
export function isGlobalAppAdmin(email: string | null | undefined): boolean {
  return normalizeAdminEmail(email) === GLOBAL_APP_ADMIN_EMAIL;
}

/** Resolve signed-in email from profile / accounts (browser only). */
export function getSignedInEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    const accountId = localStorage.getItem(CURRENT_USER_KEY);
    if (accountId) {
      const acct = loadAccounts().find((a) => a.id === accountId);
      if (acct?.email) return acct.email.trim().toLowerCase();
    }
  } catch {}
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (raw) {
      const p = JSON.parse(raw) as { email?: string };
      if (p?.email) return p.email.trim().toLowerCase();
    }
  } catch {}
  return "";
}

export type GlobalUserRole = "App Admin" | "Owner" | "Member";
export type GlobalUserStatus = "Active" | "Pending";

/** Unified row for the global admin user directory */
export type GlobalRegisteredUser = {
  /** Stable UI key */
  id: string;
  accountId?: string;
  memberId?: string;
  name: string;
  email: string;
  emoji: string;
  household: string;
  role: GlobalUserRole;
  status: GlobalUserStatus;
  joinedAt?: string;
  phone?: string;
  isCurrentUser: boolean;
  isGlobalAdmin: boolean;
};

function roleFor(member: FamilyMember | undefined, email: string): GlobalUserRole {
  if (isGlobalAppAdmin(email)) return "App Admin";
  if (member?.status === "owner") return "Owner";
  return "Member";
}

function statusFor(member: FamilyMember | undefined, hasAccount: boolean): GlobalUserStatus {
  if (member?.status === "pending") return "Pending";
  if (!hasAccount && member && member.status !== "owner") return "Pending";
  return "Active";
}

/**
 * All registered users visible to the global admin on this device/app instance.
 * Merges friggg-accounts with family members (pending invites without an account yet).
 */
export function loadGlobalRegisteredUsers(): GlobalRegisteredUser[] {
  if (typeof window === "undefined") return [];

  const accounts = loadAccounts();
  const members = loadFamilyMembers();
  const household = loadHouseholdName("Family pantry");
  let currentId: string | null = null;
  try {
    currentId = localStorage.getItem(CURRENT_USER_KEY);
  } catch {}

  const rows: GlobalRegisteredUser[] = [];
  const coveredMemberIds = new Set<string>();

  for (const acct of accounts) {
    const member = members.find((m) => m.id === acct.memberId);
    if (member) coveredMemberIds.add(member.id);
    const email = (acct.email || "").trim().toLowerCase();
    rows.push({
      id: `acct:${acct.id}`,
      accountId: acct.id,
      memberId: acct.memberId || member?.id,
      name: (acct.name || member?.name || "").trim() || "Unnamed",
      email,
      emoji: acct.emoji || member?.emoji || "👤",
      household,
      role: roleFor(member, email),
      status: statusFor(member, true),
      joinedAt: member?.joinedAt,
      phone: member?.phone,
      isCurrentUser: acct.id === currentId,
      isGlobalAdmin: isGlobalAppAdmin(email),
    });
  }

  // Members with no linked account (e.g. pending invites)
  for (const member of members) {
    if (coveredMemberIds.has(member.id)) continue;
    if (accounts.some((a) => a.memberId === member.id)) continue;
    const email = (member.email || "").trim().toLowerCase();
    rows.push({
      id: `member:${member.id}`,
      memberId: member.id,
      name: member.name,
      email,
      emoji: member.emoji || "👤",
      household,
      role: roleFor(member, email),
      status: statusFor(member, false),
      joinedAt: member.joinedAt,
      phone: member.phone,
      isCurrentUser: false,
      isGlobalAdmin: isGlobalAppAdmin(email),
    });
  }

  const rank = (u: GlobalRegisteredUser) => {
    if (u.isGlobalAdmin) return 0;
    if (u.role === "Owner") return 1;
    if (u.status === "Active") return 2;
    return 3;
  };

  return rows.sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name) || a.email.localeCompare(b.email)
  );
}

export function formatJoinDate(iso?: string): string | null {
  if (!iso?.trim()) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function readForcedLogoutIds(): string[] {
  try {
    const raw = localStorage.getItem(FORCED_LOGOUT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeForcedLogoutIds(ids: string[]): void {
  try {
    localStorage.setItem(FORCED_LOGOUT_KEY, JSON.stringify(ids));
  } catch {}
}

/** Mark account as force-logged-out (simulated). Checked on next session restore. */
export function markForcedLogout(accountId: string): void {
  if (!accountId) return;
  const ids = readForcedLogoutIds();
  if (!ids.includes(accountId)) writeForcedLogoutIds([...ids, accountId]);
}

export function clearForcedLogout(accountId: string): void {
  writeForcedLogoutIds(readForcedLogoutIds().filter((id) => id !== accountId));
}

export function isAccountForceLoggedOut(accountId: string): boolean {
  return readForcedLogoutIds().includes(accountId);
}

/**
 * Remove a user from the app registry (account + linked household member when safe).
 * Never removes the global App Admin account.
 */
export function removeGlobalUser(user: GlobalRegisteredUser): {
  ok: boolean;
  reason?: string;
  removedSelf?: boolean;
} {
  if (user.isGlobalAdmin || isGlobalAppAdmin(user.email)) {
    return { ok: false, reason: "Cannot remove the global App Admin." };
  }

  let removedSelf = false;
  try {
    const currentId = localStorage.getItem(CURRENT_USER_KEY);

    if (user.accountId) {
      const next = loadAccounts().filter((a) => a.id !== user.accountId);
      saveAccounts(next);
      if (currentId && currentId === user.accountId) {
        removedSelf = true;
        localStorage.removeItem(LOGGED_IN_KEY);
        localStorage.removeItem(CURRENT_USER_KEY);
        clearSyncCreds();
      }
      clearForcedLogout(user.accountId);
    }

    if (user.memberId) {
      const members = loadFamilyMembers();
      const target = members.find((m) => m.id === user.memberId);
      // Never delete the household owner row via global remove if they have no account
      // (owner account was already blocked above when isGlobalAdmin / owner with admin email)
      if (target && target.status !== "owner") {
        saveFamilyMembers(members.filter((m) => m.id !== user.memberId));
      } else if (target && target.status === "owner" && user.accountId) {
        // Account already removed; leave owner member row so household structure remains
      } else if (target && !user.accountId && target.status !== "owner") {
        saveFamilyMembers(members.filter((m) => m.id !== user.memberId));
      }
    }
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Could not remove user",
    };
  }

  return { ok: true, removedSelf };
}

/**
 * Simulated force logout. If target is the current session, signs them out immediately.
 */
export function forceLogoutUser(user: GlobalRegisteredUser): {
  ok: boolean;
  signedOutNow: boolean;
  reason?: string;
} {
  if (!user.accountId && user.status === "Pending") {
    return {
      ok: false,
      signedOutNow: false,
      reason: "This invite has no active session yet.",
    };
  }

  if (user.accountId) {
    markForcedLogout(user.accountId);
  }

  let signedOutNow = false;
  try {
    const currentId = localStorage.getItem(CURRENT_USER_KEY);
    if (user.accountId && currentId === user.accountId) {
      localStorage.removeItem(LOGGED_IN_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
      clearSyncCreds();
      signedOutNow = true;
    } else if (user.isCurrentUser) {
      localStorage.removeItem(LOGGED_IN_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
      clearSyncCreds();
      signedOutNow = true;
    }
  } catch {}

  return { ok: true, signedOutNow };
}

/** Drop password-bearing fields when exposing account rows (admin UI never needs passwords). */
export function sanitizeAccountForAdmin(acct: FamilyAccount): Omit<FamilyAccount, "password"> {
  const { password: _p, ...rest } = acct;
  return rest;
}
