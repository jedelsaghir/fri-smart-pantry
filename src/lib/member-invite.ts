/**
 * Cross-device member invites — unique code per family profile.
 * Owner publishes to the household-sync store; joiner resolves + accepts on their phone.
 */

import type { FamilyMember } from "@/types/pantry";
import {
  applySnapshotToLocalStorage,
  buildSnapshotFromLocalStorage,
  writeLocalSyncMeta,
  type SyncCreds,
} from "@/lib/household-sync";
import {
  acceptHouseholdInvite,
  registerHouseholdInvite,
  resolveHouseholdInvite,
  revokeHouseholdInvite,
} from "@/lib/household-sync.functions";
import { saveSyncCreds } from "@/lib/sync-session";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  generateInviteCode,
  loadFamilyMembers,
  loadHouseholdName,
  saveFamilyMembers,
  saveHouseholdName,
} from "@/lib/family";

export type ResolvedInvite = {
  code: string;
  memberId: string;
  memberName: string;
  memberEmoji: string;
  householdName: string;
  ownerEmail: string;
  source: "local" | "cloud";
};

/** Ensure member has a stable unique invite code (never empty). */
export function ensureMemberInviteCode(member: FamilyMember): FamilyMember {
  if (member.inviteCode?.trim()) return member;
  return { ...member, inviteCode: generateInviteCode() };
}

/**
 * Persist member into local family list so snapshot builders see them immediately.
 */
export function persistMemberInLocalFamily(member: FamilyMember): FamilyMember[] {
  const withCode = ensureMemberInviteCode(member);
  const members = loadFamilyMembers();
  const idx = members.findIndex((m) => m.id === withCode.id);
  const next =
    idx >= 0
      ? members.map((m, i) => (i === idx ? { ...m, ...withCode } : m))
      : [...members, withCode];
  saveFamilyMembers(next);
  return next;
}

/**
 * Register this member’s invite on the server so other devices can open the link.
 * Call while owner is signed in (sync credentials available).
 */
export async function publishMemberInvite(opts: {
  member: FamilyMember;
  householdName: string;
  ownerCreds: SyncCreds;
}): Promise<{ ok: boolean; reason?: string; code?: string }> {
  const member = ensureMemberInviteCode(opts.member);
  saveHouseholdName(opts.householdName);
  const members = persistMemberInLocalFamily(member);

  const snapshot = buildSnapshotFromLocalStorage(opts.ownerCreds.email);
  snapshot.familyMembers = members;
  snapshot.household = opts.householdName.trim() || loadHouseholdName();

  try {
    const result = await registerHouseholdInvite({
      data: {
        email: opts.ownerCreds.email,
        password: opts.ownerCreds.password,
        code: member.inviteCode,
        memberId: member.id,
        memberName: member.name,
        memberEmoji: member.emoji || "👤",
        householdName: opts.householdName,
        snapshot,
      },
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, code: result.code };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Could not publish invite",
    };
  }
}

/** Owner cancels invite — invalidates cloud code */
export async function revokeMemberInvite(opts: {
  code: string;
  ownerCreds: SyncCreds;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const result = await revokeHouseholdInvite({
      data: {
        email: opts.ownerCreds.email,
        password: opts.ownerCreds.password,
        code: opts.code,
      },
    });
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Could not revoke invite",
    };
  }
}

/** Resolve invite from cloud (cross-device) */
export async function resolveInviteFromCloud(code: string): Promise<ResolvedInvite | null> {
  try {
    const result = await resolveHouseholdInvite({ data: { code } });
    if (!result.ok) return null;
    return {
      code: result.invite.code,
      memberId: result.invite.memberId,
      memberName: result.invite.memberName,
      memberEmoji: result.invite.memberEmoji,
      householdName: result.invite.householdName,
      ownerEmail: result.invite.ownerEmail,
      source: "cloud",
    };
  } catch {
    return null;
  }
}

/**
 * Accept invite on server: links email → member slot, applies household locally.
 */
export async function acceptMemberInvite(opts: {
  code: string;
  email: string;
  password: string;
  name?: string;
  emoji?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const result = await acceptHouseholdInvite({
      data: {
        code: opts.code,
        email: opts.email,
        password: opts.password,
        name: opts.name,
        emoji: opts.emoji,
      },
    });
    if (!result.ok) return { ok: false, error: result.reason };

    applySnapshotToLocalStorage(result.snapshot, { currentUserId: result.accountId });
    try {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, result.accountId);
      localStorage.setItem(STORAGE_KEYS.LOGGED_IN, "true");
      // Ensure joiner account exists in local accounts for session recovery
      const accountsRaw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      const accounts = accountsRaw ? JSON.parse(accountsRaw) : [];
      if (Array.isArray(accounts) && !accounts.some((a: { id?: string }) => a.id === result.accountId)) {
        accounts.push({
          id: result.accountId,
          memberId: result.memberId,
          email: opts.email.trim().toLowerCase(),
          password: opts.password,
          name: opts.name || "Member",
          emoji: opts.emoji || "👤",
        });
        localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
      }
    } catch {
      /* ignore */
    }

    saveSyncCreds({ email: opts.email.trim().toLowerCase(), password: opts.password });
    writeLocalSyncMeta({
      lastPulledAt: new Date().toISOString(),
      lastRemoteUpdatedAt: result.snapshot.updatedAt,
      mode: "cloud",
      lastError: undefined,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not accept invite",
    };
  }
}
