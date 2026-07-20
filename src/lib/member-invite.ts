/**
 * Client helpers for per-member invite links (unique to each family profile).
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
} from "@/lib/household-sync.functions";
import { saveSyncCreds } from "@/lib/sync-session";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { generateInviteCode } from "@/lib/family";

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
 * Register this member’s invite on the server so other devices can open the link.
 * Call while owner is signed in (sync credentials available).
 */
export async function publishMemberInvite(opts: {
  member: FamilyMember;
  householdName: string;
  ownerCreds: SyncCreds;
}): Promise<{ ok: boolean; reason?: string; code?: string }> {
  const member = ensureMemberInviteCode(opts.member);
  const snapshot = buildSnapshotFromLocalStorage(opts.ownerCreds.email);
  const members = [...(snapshot.familyMembers || [])];
  const idx = members.findIndex((m) => m.id === member.id);
  if (idx >= 0) members[idx] = { ...members[idx], ...member };
  else members.push(member);
  snapshot.familyMembers = members;

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
    } catch {}

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
