import type { FamilyMember, FamilyMemberStatus } from "@/types/pantry";

import {
  establishSession,
  hashPassword,
  isDemoAuthMode,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth";
import { buildLocalQrDataUrl } from "@/lib/local-qr";
import {
  loginServerAccount,
  pullHouseholdSync,
  registerServerAccount,
} from "@/lib/household-sync.functions";
import { applySnapshotToLocalStorage } from "@/lib/household-sync";
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

export function createMemberId(): string {
  return `member-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Digits only, optional leading country code for wa.me */
export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits;
}

export function formatPhoneDisplay(phone?: string): string {
  if (!phone?.trim()) return "";
  const d = normalizePhoneDigits(phone);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith("1"))
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length > 8) return `+${d}`;
  return phone.trim();
}

export function getAppOrigin(): string {
  if (typeof window === "undefined") return "https://app.friggg.app";
  return window.location.origin;
}

/** Absolute invite link for account creation */
export function buildInviteUrl(inviteCode: string): string {
  const origin = getAppOrigin();
  return `${origin}/?invite=${encodeURIComponent(inviteCode)}`;
}

export function buildInviteMessage(householdName: string, inviteUrl: string, inviteeName?: string): string {
  const greeting = inviteeName ? `Hey ${inviteeName}!` : "Hey!";
  return (
    `${greeting} You're invited to join our household pantry on Friġġ 🥛\n\n` +
    `Household: ${householdName}\n\n` +
    `Create your free account and see the shared fridge:\n${inviteUrl}\n\n` +
    `— Sent via Friġġ`
  );
}

/** WhatsApp deep link — with phone if provided, otherwise open share sheet */
export function buildWhatsAppInviteLink(opts: {
  phone?: string;
  householdName: string;
  inviteCode: string;
  inviteeName?: string;
}): string {
  const inviteUrl = buildInviteUrl(opts.inviteCode);
  const text = buildInviteMessage(opts.householdName, inviteUrl, opts.inviteeName);
  const encoded = encodeURIComponent(text);
  const digits = opts.phone ? normalizePhoneDigits(opts.phone) : "";
  if (digits.length >= 8) {
    return `https://wa.me/${digits}?text=${encoded}`;
  }
  return `https://wa.me/?text=${encoded}`;
}

/** Offline invite visual (L-08) — no third-party host; copy link remains primary share. */
export function buildQrImageUrl(data: string, size = 200): string {
  return buildLocalQrDataUrl(data, size);
}

export function readInviteCodeFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("invite") || params.get("join");
    if (fromQuery?.trim()) return fromQuery.trim();

    const hash = window.location.hash.replace(/^#/, "");
    if (hash.startsWith("invite=")) return decodeURIComponent(hash.slice(7)).trim() || null;
    const hashParams = new URLSearchParams(hash);
    const fromHash = hashParams.get("invite");
    if (fromHash?.trim()) return fromHash.trim();
  } catch {}
  return null;
}

/** N-15: always strip invite params from the address bar after read/join. */
export function clearInviteFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    url.searchParams.delete("join");
    // Clear hash invite forms entirely (including #invite=… and #?invite=)
    if (url.hash && /invite/i.test(url.hash)) {
      url.hash = "";
    }
    const cleaned = url.pathname + url.search + (url.hash || "");
    window.history.replaceState({}, "", cleaned);
  } catch {}
}

export function normalizeFamilyMember(raw: Partial<FamilyMember> & { id: string; name: string }): FamilyMember {
  const isYou = Boolean(raw.isYou);
  const status: FamilyMemberStatus =
    raw.status ?? (isYou ? "owner" : "joined");
  return {
    id: raw.id,
    name: raw.name,
    emoji: raw.emoji || "👤",
    phone: raw.phone || "",
    inviteCode: raw.inviteCode || generateInviteCode(),
    status: isYou ? "owner" : status,
    isYou,
    email: raw.email,
    joinedAt: raw.joinedAt,
  };
}

export function defaultFamilyMembers(): FamilyMember[] {
  // Only the signed-in owner — never seed demo people (Elena/Alex, etc.)
  return [
    normalizeFamilyMember({
      id: "you",
      name: "You",
      emoji: "👤",
      isYou: true,
      status: "owner",
      phone: "",
    }),
  ];
}

export type StoredProfile = {
  name: string;
  email: string;
  emoji: string;
  memberId?: string;
  accountId?: string;
};

/** Old demo display names that must never win the dashboard greeting */
export function isLegacyDemoDisplayName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    n === "elena" ||
    n === "elena borg" ||
    n === "alex" ||
    n === "you" ||
    n === "your name" ||
    n === "demo" ||
    n === "user"
  );
}

/** Derive a human name from email local-part when profile is still a demo seed */
export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || "";
  if (!local) return "";
  const cleaned = local.replace(/[._+\-]+/g, " ").replace(/\d+/g, " ").trim();
  if (!cleaned) return local.charAt(0).toUpperCase() + local.slice(1);
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeProfileName(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed && !isLegacyDemoDisplayName(trimmed)) return trimmed;
  const fromEmail = displayNameFromEmail(email);
  if (fromEmail && !isLegacyDemoDisplayName(fromEmail)) return fromEmail;
  return "";
}

/**
 * Resolve the signed-in user's profile for greetings / settings.
 * Prefer current account (login source of truth), then PROFILE, then isYou member.
 * Strips legacy demo names (Elena, etc.) so they never stick as the greeting.
 */
export function loadStoredProfile(): StoredProfile {
  const empty: StoredProfile = { name: "", email: "", emoji: "👤" };
  if (typeof window === "undefined") return empty;

  let candidate: StoredProfile | null = null;

  try {
    const accountId = localStorage.getItem(CURRENT_USER_KEY);
    if (accountId) {
      const account = loadAccounts().find((a) => a.id === accountId);
      if (account) {
        candidate = {
          name: account.name?.trim() || "",
          email: account.email || "",
          emoji: account.emoji || "👤",
          memberId: account.memberId,
          accountId: account.id,
        };
      }
    }
  } catch {}

  if (!candidate) {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredProfile>;
        if (parsed && typeof parsed === "object") {
          candidate = {
            name: typeof parsed.name === "string" ? parsed.name.trim() : "",
            email: typeof parsed.email === "string" ? parsed.email : "",
            emoji: (typeof parsed.emoji === "string" && parsed.emoji.trim()) || "👤",
            memberId: typeof parsed.memberId === "string" ? parsed.memberId : undefined,
            accountId: typeof parsed.accountId === "string" ? parsed.accountId : undefined,
          };
        }
      }
    } catch {}
  }

  if (!candidate) {
    try {
      const you = loadFamilyMembers().find((m) => m.isYou || m.status === "owner");
      if (you) {
        candidate = {
          name: you.name?.trim() || "",
          email: you.email || "",
          emoji: you.emoji || "👤",
          memberId: you.id,
        };
      }
    } catch {}
  }

  if (!candidate) return empty;

  const name = sanitizeProfileName(candidate.name, candidate.email);
  const resolved: StoredProfile = {
    ...candidate,
    name,
    emoji: candidate.emoji || "👤",
  };

  // Persist cleaned name so Elena/demo seeds do not return after refresh
  if (name && name !== candidate.name.trim()) {
    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          name: resolved.name,
          email: resolved.email,
          emoji: resolved.emoji,
          memberId: resolved.memberId,
          accountId: resolved.accountId,
        })
      );
      if (resolved.accountId) {
        const accounts = loadAccounts().map((a) =>
          a.id === resolved.accountId ? { ...a, name: resolved.name, emoji: resolved.emoji } : a
        );
        saveAccounts(accounts);
      }
    } catch {}
  }

  return resolved;
}

export function loadFamilyMembers(): FamilyMember[] {
  if (typeof window === "undefined") return defaultFamilyMembers();
  try {
    const saved = localStorage.getItem(FAMILY_MEMBERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((m: Partial<FamilyMember>) => m?.id && m?.name)
          .map((m: Partial<FamilyMember> & { id: string; name: string }) => normalizeFamilyMember(m));
      }
    }
  } catch {}
  return defaultFamilyMembers();
}

export function saveFamilyMembers(members: FamilyMember[]): void {
  try {
    localStorage.setItem(FAMILY_MEMBERS_KEY, JSON.stringify(members));
  } catch {}
}

export function findMemberByInviteCode(code: string, members?: FamilyMember[]): FamilyMember | null {
  const list = members ?? loadFamilyMembers();
  const normalized = code.trim().toLowerCase();
  return list.find((m) => m.inviteCode.toLowerCase() === normalized) ?? null;
}

export function loadHouseholdName(fallback = "Family pantry"): string {
  try {
    const h = localStorage.getItem(HOUSEHOLD_KEY);
    if (h?.trim()) return h.trim();
  } catch {}
  return fallback;
}

export function saveHouseholdName(name: string): string {
  const trimmed = name.trim() || "Family pantry";
  try {
    localStorage.setItem(HOUSEHOLD_KEY, trimmed);
  } catch {}
  return trimmed;
}

export function getInviteContext(code: string): PendingInviteContext | null {
  const member = findMemberByInviteCode(code);
  if (!member || member.status === "owner") return null;
  return {
    code: member.inviteCode,
    memberId: member.id,
    memberName: member.name,
    memberEmoji: member.emoji,
    householdName: loadHouseholdName(),
  };
}

export function loadAccounts(): FamilyAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveAccounts(accounts: FamilyAccount[]): void {
  try {
    // Never persist plain passwords via the shared writer
    const cleaned = accounts.map(({ password: _p, ...rest }) => rest);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(cleaned));
  } catch {}
}

export function findAccountByEmail(email: string): FamilyAccount | null {
  const lower = email.trim().toLowerCase();
  return loadAccounts().find((a) => a.email.toLowerCase() === lower) ?? null;
}

/** Persist account with hash only (strip plain password). */
function saveAccountSecure(account: FamilyAccount): FamilyAccount {
  const { password: _plain, ...rest } = account;
  const clean: FamilyAccount = { ...rest };
  // never persist plaintext
  delete clean.password;
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.id === clean.id || a.email.toLowerCase() === clean.email.toLowerCase());
  if (idx >= 0) {
    const next = [...accounts];
    next[idx] = { ...next[idx], ...clean, password: undefined };
    saveAccounts(next.map((a) => ({ ...a, password: undefined })));
  } else {
    saveAccounts([...accounts.map((a) => ({ ...a, password: undefined })), clean]);
  }
  return clean;
}

/** Mark invite as accepted and attach account (local/same-device path) */
export async function acceptInviteAndCreateAccount(opts: {
  inviteCode: string;
  email: string;
  password: string;
  name?: string;
  emoji?: string;
}): Promise<{ ok: true; account: FamilyAccount; member: FamilyMember } | { ok: false; error: string }> {
  const members = loadFamilyMembers();
  const member = findMemberByInviteCode(opts.inviteCode, members);
  if (!member) {
    return { ok: false, error: "This invite link is invalid or has expired." };
  }
  if (member.status === "owner") {
    return { ok: false, error: "This invite cannot be used." };
  }

  const email = opts.email.trim().toLowerCase();
  if (!email || !opts.password) {
    return { ok: false, error: "Email and password are required." };
  }
  const strength = validatePasswordStrength(opts.password);
  if (!strength.ok) return { ok: false, error: strength.error };

  const existing = findAccountByEmail(email);
  if (existing && existing.memberId !== member.id) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const name = (opts.name?.trim() || member.name).trim();
  const emoji = opts.emoji || member.emoji || "👤";
  const passwordHash = await hashPassword(email, opts.password);

  let account: FamilyAccount;
  if (existing) {
    account = saveAccountSecure({
      ...existing,
      passwordHash,
      password: undefined,
      name,
      emoji,
      memberId: member.id,
    });
  } else {
    account = saveAccountSecure({
      id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      memberId: member.id,
      email,
      passwordHash,
      name,
      emoji,
    });
  }

  const updatedMembers = members.map((m) => {
    if (m.id !== member.id) {
      return { ...m, isYou: false };
    }
    return {
      ...m,
      name,
      emoji,
      email,
      status: "joined" as const,
      joinedAt: m.joinedAt || new Date().toISOString(),
      isYou: true,
    };
  });
  saveFamilyMembers(updatedMembers);

  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ name, emoji, email, memberId: member.id, accountId: account.id })
    );
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}

  establishSession(account.id, email);
  clearInviteFromUrl();

  const joined = updatedMembers.find((m) => m.id === member.id)!;
  return { ok: true, account, member: joined };
}

export async function signInWithAccount(
  email: string,
  password: string
): Promise<{ ok: true; account: FamilyAccount } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) {
    return { ok: false, error: "Email and password are required." };
  }

  // Production / live: server is source of truth (works on any device)
  if (!isDemoAuthMode()) {
    try {
      const server = await loginServerAccount({ data: { email: normalized, password } });
      if (!server.ok) {
        return { ok: false, error: server.reason };
      }
      const profile = server.profile;
      const passwordHash = await hashPassword(normalized, password);
      const account = saveAccountSecure({
        id: profile.accountId,
        memberId: profile.memberId,
        email: profile.email,
        passwordHash,
        name: profile.name,
        emoji: profile.emoji,
      });
      try {
        localStorage.setItem(HOUSEHOLD_KEY, profile.householdName);
        localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({
            name: profile.name,
            emoji: profile.emoji,
            email: profile.email,
            memberId: profile.memberId,
            accountId: profile.accountId,
          })
        );
        // Keep a local session password for subsequent household sync push/pull
        sessionStorage.setItem("frigg-sync-pw", password);
        if (server.hasSnapshot) {
          const pulled = await pullHouseholdSync({
            data: { email: normalized, password },
          });
          if (pulled.ok && pulled.snapshot) {
            applySnapshotToLocalStorage(pulled.snapshot);
          }
        } else {
          saveFamilyMembers([
            normalizeFamilyMember({
              id: profile.memberId,
              name: profile.name.split(" ")[0] || "You",
              emoji: profile.emoji,
              email: profile.email,
              status: "owner",
              isYou: true,
            }),
          ]);
        }
      } catch {}
      establishSession(account.id, account.email);
      return { ok: true, account };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Could not reach the server. Check your connection and try again.",
      };
    }
  }

  // Demo / offline-local path
  let account = findAccountByEmail(normalized);

  if (!account) {
    // Demo-only: auto-create on first sign-in (disabled in production mode)
    if (isDemoAuthMode() && password) {
      const strength = validatePasswordStrength(password, "demo");
      if (!strength.ok) return { ok: false, error: strength.error };
      const passwordHash = await hashPassword(normalized, password);
      const demo: FamilyAccount = {
        // M-22: unique id per email (never fixed acct-demo-owner)
        id: `acct-demo-${normalized.replace(/[^a-z0-9]/g, "").slice(0, 24)}-${Date.now().toString(36)}`,
        memberId: "you",
        email: normalized,
        passwordHash,
        name: normalized.split("@")[0] || "You",
        emoji: "👤",
      };
      const accounts = loadAccounts();
      if (!accounts.some((a) => a.id === demo.id || a.email === normalized)) {
        saveAccountSecure(demo);
      } else {
        const existingById = accounts.find((a) => a.id === demo.id || a.email === normalized);
        if (existingById) account = existingById;
      }
      if (!account) account = findAccountByEmail(normalized) || demo;

      try {
        localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({
            name: account.name,
            emoji: account.emoji,
            email: account.email,
            memberId: account.memberId,
            accountId: account.id,
          })
        );
        let seen = false;
        const fixed = loadFamilyMembers().map((m) => {
          if ((m.id === "you" || m.status === "owner") && !seen) {
            seen = true;
            return { ...m, isYou: true };
          }
          return { ...m, isYou: false };
        });
        saveFamilyMembers(fixed);
      } catch {}
      establishSession(account.id, account.email);
      return { ok: true, account };
    }
    return {
      ok: false,
      error: isDemoAuthMode()
        ? "No account found for that email."
        : "No account found. Create an account first.",
    };
  }

  // Verify: prefer hash; migrate plain → hash on success
  let valid = false;
  if (account.passwordHash) {
    valid = await verifyPassword(normalized, password, account.passwordHash);
  } else if (account.password != null && account.password === password) {
    valid = true;
  }

  if (!valid) {
    return { ok: false, error: "Incorrect password." };
  }

  // Migrate / re-hash and strip plaintext
  const passwordHash = account.passwordHash || (await hashPassword(normalized, password));
  account = saveAccountSecure({
    ...account,
    passwordHash,
    password: undefined,
  });

  try {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        name: account.name,
        emoji: account.emoji,
        email: account.email,
        memberId: account.memberId,
        accountId: account.id,
      })
    );
    const members = loadFamilyMembers().map((m) => ({
      ...m,
      isYou: m.id === account!.memberId,
    }));
    saveFamilyMembers(members);
    try {
      const key = "friggg-forced-logout-ids";
      const raw = localStorage.getItem(key);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        if (Array.isArray(ids) && ids.includes(account.id)) {
          localStorage.setItem(key, JSON.stringify(ids.filter((id) => id !== account!.id)));
        }
      }
    } catch {}
  } catch {}

  establishSession(account.id, account.email);
  return { ok: true, account };
}

/** Register household owner (onboarding) with hashed password */
export async function registerOwnerAccount(
  displayName: string,
  email: string,
  password: string,
  emoji: string,
  householdName: string
): Promise<{ ok: true; account: FamilyAccount } | { ok: false; error: string }> {
  const normalized = email.trim().toLowerCase();
  const strength = validatePasswordStrength(password);
  if (!strength.ok) return { ok: false, error: strength.error };
  if (!normalized) return { ok: false, error: "Email is required." };
  if (!displayName.trim()) return { ok: false, error: "Name is required." };

  // Production / live: create server-owned account first (source of truth)
  if (!isDemoAuthMode()) {
    try {
      const server = await registerServerAccount({
        data: {
          email: normalized,
          password,
          name: displayName.trim(),
          emoji: emoji || "👤",
          householdName: householdName.trim() || "Family pantry",
        },
      });
      if (!server.ok) {
        return { ok: false, error: server.reason };
      }
      const profile = server.profile;
      const passwordHash = await hashPassword(normalized, password);
      const account = saveAccountSecure({
        id: profile.accountId,
        memberId: profile.memberId,
        email: profile.email,
        passwordHash,
        name: profile.name,
        emoji: profile.emoji,
      });
      try {
        localStorage.setItem(HOUSEHOLD_KEY, profile.householdName);
        localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({
            name: profile.name,
            emoji: profile.emoji,
            email: profile.email,
            memberId: profile.memberId,
            accountId: profile.accountId,
          })
        );
        saveFamilyMembers([
          normalizeFamilyMember({
            id: profile.memberId,
            name: profile.name.split(" ")[0] || "You",
            emoji: profile.emoji,
            email: profile.email,
            status: "owner",
            isYou: true,
          }),
        ]);
        sessionStorage.setItem("frigg-sync-pw", password);
      } catch {}
      establishSession(account.id, account.email);
      return { ok: true, account };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Could not reach the server. Check your connection and try again.",
      };
    }
  }

  // Demo mode: local-only account
  const existing = findAccountByEmail(normalized);
  if (existing) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const passwordHash = await hashPassword(normalized, password);
  const accountId = `acct-${Date.now()}`;
  const memberId = "you";
  const account = saveAccountSecure({
    id: accountId,
    memberId,
    email: normalized,
    passwordHash,
    name: displayName,
    emoji,
  });

  try {
    localStorage.setItem(HOUSEHOLD_KEY, householdName);
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({
        name: displayName,
        emoji,
        email: normalized,
        memberId,
        accountId,
      })
    );

    const membersRaw = localStorage.getItem(FAMILY_MEMBERS_KEY);
    let members = membersRaw ? JSON.parse(membersRaw) : null;
    if (!Array.isArray(members) || members.length === 0) {
      members = [
        {
          id: "you",
          name: displayName.split(" ")[0] || "You",
          emoji,
          phone: "",
          inviteCode: Math.random().toString(36).slice(2, 12),
          status: "owner",
          isYou: true,
          email: normalized,
        },
      ];
    } else {
      members = members.map((m: { id: string; status?: string }) => ({
        ...m,
        isYou: m.id === "you" || m.status === "owner",
        ...(m.id === "you"
          ? {
              name: displayName.split(" ")[0] || m.id,
              emoji,
              email: normalized,
              status: "owner",
            }
          : { isYou: false }),
      }));
    }
    localStorage.setItem(FAMILY_MEMBERS_KEY, JSON.stringify(members));
  } catch {}

  establishSession(accountId, normalized);
  return { ok: true, account };
}

export function memberStatusLabel(status: FamilyMemberStatus): string {
  switch (status) {
    case "owner":
      return "Owner";
    case "pending":
      return "Invite pending";
    case "joined":
      return "Active";
    default:
      return status;
  }
}
