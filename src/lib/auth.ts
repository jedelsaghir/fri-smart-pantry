/**
 * Auth helpers — path toward production-ready sessions.
 *
 * Mode:
 * - demo (default): auto-create on unknown email sign-in (legacy convenience)
 * - production: require registered accounts; no silent auto-create
 *
 * Set VITE_AUTH_MODE=production to enable stricter client behaviour.
 *
 * Passwords:
 * - Local accounts store passwordHash (SHA-256 via hashSyncPassword — same scheme as cloud sync)
 * - Plain-text password is never written to localStorage after migration
 * - Ephemeral plain password may live in sessionStorage for multi-device sync push only
 *
 * Session:
 * - Structured session with expiry (default 30 days) replaces bare LOGGED_IN=true
 * - LOGGED_IN remains mirrored for older code paths
 */

import { hashSyncPassword } from "@/lib/household-sync";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export type AuthMode = "demo" | "production";

export const AUTH_SESSION_KEY = "friggg-auth-session";
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type AuthSession = {
  v: 1;
  userId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
};

/**
 * Client auth strictness.
 * H-01: Production builds default to `production` (no auto-create on sign-in).
 * Explicit `VITE_AUTH_MODE=demo` is required for demo auto-create, including in prod hosts used for demos.
 * Dev (`import.meta.env.DEV`) still defaults to demo unless overridden.
 */
export function getAuthMode(): AuthMode {
  try {
    const explicit = String(import.meta.env?.VITE_AUTH_MODE || "")
      .trim()
      .toLowerCase();
    if (explicit === "production" || explicit === "prod") return "production";
    if (explicit === "demo") return "demo";
    // No explicit flag: prod hosts → production; local dev → demo
    if (import.meta.env?.PROD) return "production";
    return "demo";
  } catch {
    return "production";
  }
}

export function isDemoAuthMode(): boolean {
  return getAuthMode() === "demo";
}

/** Hash password for local verify + cloud sync (consistent with server). */
export async function hashPassword(email: string, password: string): Promise<string> {
  return hashSyncPassword(email.trim().toLowerCase(), password);
}

export async function verifyPassword(
  email: string,
  password: string,
  passwordHash: string | undefined | null
): Promise<boolean> {
  if (!passwordHash) return false;
  const h = await hashPassword(email, password);
  return h === passwordHash;
}

export function createAuthSession(
  userId: string,
  email: string,
  ttlMs = DEFAULT_SESSION_TTL_MS
): AuthSession {
  const now = Date.now();
  return {
    v: 1,
    userId,
    email: email.trim().toLowerCase(),
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
}

export function writeAuthSession(session: AuthSession): void {
  try {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEYS.LOGGED_IN, "true");
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, session.userId);
  } catch {
    /* ignore */
  }
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_SESSION_KEY);
    localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
    // Keep CURRENT_USER for optional recovery; clear on full logout callers may remove it
  } catch {
    /* ignore */
  }
}

export function readAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw) as AuthSession;
      if (s?.v === 1 && s.userId && s.email && typeof s.expiresAt === "number") {
        if (Date.now() > s.expiresAt) {
          clearAuthSession();
          return null;
        }
        return s;
      }
    }
  } catch {
    /* ignore */
  }

  // Legacy: LOGGED_IN=true without structured session → soft-upgrade if current user exists
  try {
    if (localStorage.getItem(STORAGE_KEYS.LOGGED_IN) !== "true") return null;
    const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!userId) return null;
    // Build provisional session (email filled on next login if missing)
    const session = createAuthSession(userId, "legacy@local");
    // Don't write yet — caller may hydrate email from accounts
    return { ...session, email: "" };
  } catch {
    return null;
  }
}

/** True if a non-expired session exists (or legacy logged-in flag with user id). */
export function isSessionAuthenticated(): boolean {
  const s = readAuthSession();
  if (s && s.userId && (s.email || s.email === "")) {
    // legacy soft session: email empty is ok if LOGGED_IN
    if (!s.email) {
      return localStorage.getItem(STORAGE_KEYS.LOGGED_IN) === "true";
    }
    return Date.now() <= s.expiresAt;
  }
  return false;
}

/**
 * Establish session after successful password verify.
 * Mirrors LOGGED_IN + CURRENT_USER for older hooks.
 */
export function establishSession(userId: string, email: string): AuthSession {
  const session = createAuthSession(userId, email);
  writeAuthSession(session);
  return session;
}

/** Minimum password rules for new accounts / production mode */
export function validatePasswordStrength(
  password: string,
  mode: AuthMode = getAuthMode()
): { ok: true } | { ok: false; error: string } {
  if (!password || password.length < 1) {
    return { ok: false, error: "Password is required." };
  }
  if (mode === "production") {
    if (password.length < 8) {
      return { ok: false, error: "Use at least 8 characters." };
    }
  } else if (password.length < 4) {
    // Demo still needs a non-trivial password so hashing isn't pointless
    return { ok: false, error: "Use at least 4 characters." };
  }
  return { ok: true };
}

/**
 * Status for docs / Settings UI.
 */
export function getAuthHardeningStatus(): {
  mode: AuthMode;
  passwordsHashedLocally: boolean;
  sessionExpires: boolean;
  plainPasswordInLocalStorage: boolean;
  notes: string[];
} {
  const mode = getAuthMode();
  const notes: string[] = [
    "Cloud household sync still needs the plaintext password in sessionStorage during the session (to re-auth push/pull).",
    "Email verification and OAuth are not implemented yet.",
    mode === "demo"
      ? "Demo mode may auto-create an account on first sign-in with a new email."
      : "Production mode requires an existing account (no auto-create on sign-in).",
  ];
  return {
    mode,
    passwordsHashedLocally: true,
    sessionExpires: true,
    plainPasswordInLocalStorage: false,
    notes,
  };
}
