import type { InviteProvider } from "@/platform/types";
import {
  acceptInviteAndCreateAccount,
  getInviteContext,
} from "@/lib/family";

/**
 * Local invite validation (D-4 deferred).
 * Codes only work for members stored on this device's localStorage.
 */
export const localInviteProvider: InviteProvider = {
  id: "invite-local",
  mode: "local",
  async validateInvite(code) {
    const ctx = getInviteContext(code);
    if (!ctx) {
      return { ok: false, reason: "Invite not found on this device" };
    }
    return {
      ok: true,
      householdName: ctx.householdName,
      memberName: ctx.memberName,
    };
  },
  async acceptInvite(code, account) {
    const result = acceptInviteAndCreateAccount({
      inviteCode: code,
      email: account.email,
      password: account.password,
      name: account.name,
      emoji: "👤",
    });
    return result.ok
      ? { ok: true }
      : { ok: false, reason: result.error || "Could not accept invite" };
  },
};
