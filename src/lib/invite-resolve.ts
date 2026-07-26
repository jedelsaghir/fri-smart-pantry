/**
 * Single ordered invite resolver (M-12): local → cloud.
 * Avoids dual-path race confusion in LoginScreen.
 */

import { getInviteContext, type PendingInviteContext } from "@/lib/family";
import { resolveInviteFromCloud } from "@/lib/member-invite";

export type ResolveInviteResult =
  | { ok: true; ctx: PendingInviteContext; source: "local" | "cloud" }
  | { ok: false; reason: string };

/**
 * Resolve an invite code for signup join flow.
 * 1) Same-device pending member row
 * 2) Cloud registry (cross-device)
 */
export async function resolveInviteForJoin(code: string): Promise<ResolveInviteResult> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: "Invite code is empty." };

  const local = getInviteContext(trimmed);
  if (local) {
    return { ok: true, ctx: local, source: "local" };
  }

  try {
    const cloud = await resolveInviteFromCloud(trimmed);
    if (cloud) {
      return {
        ok: true,
        ctx: {
          code: cloud.code,
          memberId: cloud.memberId,
          memberName: cloud.memberName,
          memberEmoji: cloud.memberEmoji,
          householdName: cloud.householdName,
        },
        source: "cloud",
      };
    }
  } catch {
    return {
      ok: false,
      reason: "Could not reach invite server. Check your connection and try again.",
    };
  }

  return {
    ok: false,
    reason:
      "Invite not found. Ask the owner to open Manage Family and copy the invite link again.",
  };
}
