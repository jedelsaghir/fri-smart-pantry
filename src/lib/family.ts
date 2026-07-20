import type { FamilyMember, FamilyMemberStatus } from "@/types/pantry";

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
  /** Demo only — plain text for local simulation */
  password: string;
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

/** Short unique invite code (URL-safe) */
export function generateInviteCode(): string {
  const part = () => Math.random().toString(36).slice(2, 8);
  return `${part()}${part()}`.slice(0, 10);
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

/** QR image URL (no npm dep; works in browser) */
export function buildQrImageUrl(data: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encodeURIComponent(data)}`;
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

export function clearInviteFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("invite");
    url.searchParams.delete("join");
    if (url.hash.includes("invite")) url.hash = "";
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
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
  return [
    normalizeFamilyMember({
      id: "you",
      name: "You",
      emoji: "👤",
      isYou: true,
      status: "owner",
      phone: "",
    }),
    normalizeFamilyMember({
      id: "elena",
      name: "Elena",
      emoji: "👩‍🍳",
      status: "joined",
      phone: "",
      joinedAt: new Date().toISOString(),
    }),
    normalizeFamilyMember({
      id: "alex",
      name: "Alex",
      emoji: "🧒",
      status: "joined",
      phone: "",
      joinedAt: new Date().toISOString(),
    }),
  ];
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
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

export function findAccountByEmail(email: string): FamilyAccount | null {
  const lower = email.trim().toLowerCase();
  return loadAccounts().find((a) => a.email.toLowerCase() === lower) ?? null;
}

/** Mark invite as accepted and attach account */
export function acceptInviteAndCreateAccount(opts: {
  inviteCode: string;
  email: string;
  password: string;
  name?: string;
  emoji?: string;
}): { ok: true; account: FamilyAccount; member: FamilyMember } | { ok: false; error: string } {
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

  const existing = findAccountByEmail(email);
  if (existing && existing.memberId !== member.id) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const name = (opts.name?.trim() || member.name).trim();
  const emoji = opts.emoji || member.emoji || "👤";

  let account: FamilyAccount;
  const accounts = loadAccounts();
  if (existing) {
    account = {
      ...existing,
      password: opts.password,
      name,
      emoji,
      memberId: member.id,
    };
    saveAccounts(accounts.map((a) => (a.id === account.id ? account : a)));
  } else {
    account = {
      id: `acct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      memberId: member.id,
      email,
      password: opts.password,
      name,
      emoji,
    };
    saveAccounts([...accounts, account]);
  }

  const updatedMembers = members.map((m) => {
    if (m.id !== member.id) {
      // Only one "You" — clear isYou on others when switching
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
    localStorage.setItem(CURRENT_USER_KEY, account.id);
    localStorage.setItem(LOGGED_IN_KEY, "true");
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}

  clearInviteFromUrl();

  const joined = updatedMembers.find((m) => m.id === member.id)!;
  return { ok: true, account, member: joined };
}

export function signInWithAccount(
  email: string,
  password: string
): { ok: true; account: FamilyAccount } | { ok: false; error: string } {
  const account = findAccountByEmail(email);
  if (!account) {
    // Demo fallback: allow sign-in without pre-registered account (legacy owner)
    if (email && password) {
      const demo: FamilyAccount = {
        id: "acct-demo-owner",
        memberId: "you",
        email: email.trim().toLowerCase(),
        password,
        name: email.split("@")[0] || "You",
        emoji: "👤",
      };
      const accounts = loadAccounts();
      if (!accounts.some((a) => a.id === demo.id)) {
        saveAccounts([...accounts, demo]);
      }
      try {
        localStorage.setItem(LOGGED_IN_KEY, "true");
        localStorage.setItem(CURRENT_USER_KEY, demo.id);
        localStorage.setItem(
          PROFILE_KEY,
          JSON.stringify({ name: demo.name, emoji: demo.emoji, email: demo.email, memberId: demo.memberId })
        );
        // Mark owner as current "You"
        const members = loadFamilyMembers().map((m) => ({
          ...m,
          isYou: m.id === "you" || m.status === "owner",
        }));
        // Ensure only one isYou
        let seen = false;
        const fixed = members.map((m) => {
          if ((m.id === "you" || m.status === "owner") && !seen) {
            seen = true;
            return { ...m, isYou: true };
          }
          return { ...m, isYou: false };
        });
        saveFamilyMembers(fixed);
      } catch {}
      return { ok: true, account: demo };
    }
    return { ok: false, error: "No account found for that email." };
  }
  if (account.password !== password) {
    return { ok: false, error: "Incorrect password." };
  }

  try {
    localStorage.setItem(LOGGED_IN_KEY, "true");
    localStorage.setItem(CURRENT_USER_KEY, account.id);
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
      isYou: m.id === account.memberId,
    }));
    saveFamilyMembers(members);
  } catch {}

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
