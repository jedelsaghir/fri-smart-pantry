import type { FamilyMember, FamilyMemberStatus } from "@/types/pantry";

import {
  establishSession,
  hashPassword,
  isDemoAuthMode,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth";
import { buildLocalQrDataUrl } from "@/lib/local-qr";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const FAMILY_MEMBERS_KEY = STORAGE_KEYS.FAMILY_MEMBERS;
export const HOUSEHOLD_KEY = STORAGE_KEYS.HOUSEHOLD;
export const PROFILE_KEY = STORAGE_KEYS.PROFILE;
export const LOGGED_IN_KEY = STORAGE_KEYS.LOGGED_IN;
export const CURRENT_USER_KEY = STORAGE_KEYS.CURRENT_USER;
export const ACCOUNTS_KEY = STORAGE_KEYS.ACCOUNTS;
export const PENDING_INVITE_KEY = STORAGE_KEYS.PENDING_INVITE;

export type FamilyAccount = {
  id: string;
  memberId: string;
  email: string;
  /**
   * @deprecated Prefer passwordHash. Migrated away on next successful sign-in.
   * Never write new plain passwords to localStorage.
   */
  password?: string;
  /** SHA-256 hash via hashSyncPassword (same scheme as cloud household auth) */
  passwordHash?: string;
  name: string;
  emoji: string;
};

export type PendingInviteContext = {
  code: string;
  memberId: string;
  memberName: string;
  memberEmoji: string;
  householdName: string;
};

/**
 * Unique invite code (URL-safe). H-09: longer codes reduce guessing risk.
 * ~20 chars base36 ≈ strong enough for household invite links.
 */
export function generateInviteCode(): string {
  const part = () => Math.random().toString(36).slice(2, 10);
  return `${part()}${part()}${part()}`.slice(0, 20);
}
