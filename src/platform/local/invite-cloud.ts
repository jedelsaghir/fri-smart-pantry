/**
 * Cross-device invite adapter — cloud registry first, localStorage fallback.
 */

import type { InviteProvider } from "@/platform/types";
import {
  acceptInviteAndCreateAccount,
  getInviteContext,
} from "@/lib/family";
import {
  acceptMemberInvite,
  resolveInviteFromCloud,
} from "@/lib/member-invite";

export const cloudInviteProvider: InviteProvider = {
  id: "invite-cloud",
  mode: "remote",

  async validateInvite(code) {
    // Prefer cloud so links work on a fresh phone
    const cloud = await resolveInviteFromCloud(code);
    if (cloud) {
      return {
        ok: true,
        householdName: cloud.householdName,
        memberName: cloud.memberName,
      };
    }
    const local = getInviteContext(code);
    if (local) {
      return {
        ok: true,
        householdName: local.householdName,
        memberName: local.memberName,
      };
    }
    return {
      ok: false,
      reason:
        "Invite not found. Ask the owner to open Manage Family and copy the invite link again (publishes to the cloud).",
    };
  },

  async acceptInvite(code, account) {
    const cloud = await acceptMemberInvite({
      code,
      email: account.email,
      password: account.password,
      name: account.name,
      emoji: "👤",
    });
    if (cloud.ok) return { ok: true };

    // Same-device fallback (owner still has pending member in localStorage)
    const local = await acceptInviteAndCreateAccount({
      inviteCode: code,
      email: account.email,
      password: account.password,
      name: account.name,
      emoji: "👤",
    });
    return local.ok
      ? { ok: true }
      : { ok: false, reason: cloud.error || local.error || "Could not accept invite" };
  },
};
