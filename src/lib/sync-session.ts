/**
 * Client-side sync session — remembers credentials for background push
 * (sessionStorage only; never long-lived cookies / localStorage).
 *
 * H-02: When sessionStorage is empty after tab restore, cloud push stops.
 * We surface `needsSyncPassword()` so Settings can re-prompt calmly.
 * Plain password is never written to localStorage accounts (hashed only).
 */

import type { SyncCreds } from "@/lib/household-sync";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const SESSION_CREDS_KEY = "friggg-sync-creds";
const SYNC_NEEDS_PASSWORD_KEY = "friggg-sync-needs-password";

export function saveSyncCreds(creds: SyncCreds): void {
  try {
    sessionStorage.setItem(
      SESSION_CREDS_KEY,
      JSON.stringify({
        email: creds.email.trim().toLowerCase(),
        password: creds.password,
      })
    );
    sessionStorage.removeItem(SYNC_NEEDS_PASSWORD_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSyncCreds(): void {
  try {
    sessionStorage.removeItem(SESSION_CREDS_KEY);
    sessionStorage.removeItem(SYNC_NEEDS_PASSWORD_KEY);
  } catch {
    /* ignore */
  }
}

/** Mark that the user is signed in but must re-enter password for cloud sync. */
export function markSyncNeedsPassword(): void {
  try {
    sessionStorage.setItem(SYNC_NEEDS_PASSWORD_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * True when local auth session exists but sync credentials are missing
 * (typical after new tab / browser restart with hashed accounts only).
 */
export function needsSyncPassword(): boolean {
  try {
    if (loadSyncCreds()) return false;
    if (sessionStorage.getItem(SYNC_NEEDS_PASSWORD_KEY) === "1") return true;
    // Signed-in locally but no session password
    const loggedIn = localStorage.getItem(STORAGE_KEYS.LOGGED_IN) === "true";
    const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return Boolean(loggedIn && userId);
  } catch {
    return false;
  }
}

/**
 * Load sync credentials for background push/pull.
 * Prefers sessionStorage. Legacy fallback only if an old install still has a
 * plain password on the account (will be stripped on next successful sign-in).
 */
export function loadSyncCreds(): SyncCreds | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CREDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SyncCreds;
      if (parsed?.email && parsed?.password) {
        return { email: parsed.email.trim().toLowerCase(), password: parsed.password };
      }
    }
  } catch {
    /* ignore */
  }

  // Legacy: plain password still on local account (pre-hardening installs only)
  try {
    const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const accountsRaw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!userId || !accountsRaw) {
      markSyncNeedsPasswordIfSignedIn();
      return null;
    }
    const accounts = JSON.parse(accountsRaw) as Array<{
      id: string;
      email?: string;
      password?: string;
    }>;
    const account = accounts.find((a) => a.id === userId);
    if (account?.email && account?.password) {
      const creds = {
        email: account.email.trim().toLowerCase(),
        password: account.password,
      };
      saveSyncCreds(creds);
      return creds;
    }
  } catch {
    /* ignore */
  }

  markSyncNeedsPasswordIfSignedIn();
  return null;
}

function markSyncNeedsPasswordIfSignedIn(): void {
  try {
    if (localStorage.getItem(STORAGE_KEYS.LOGGED_IN) === "true") {
      markSyncNeedsPassword();
    }
  } catch {
    /* ignore */
  }
}
