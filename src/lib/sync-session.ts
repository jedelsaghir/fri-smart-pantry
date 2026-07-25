/**
 * Client-side sync session — remembers credentials for background push
 * (sessionStorage only; never long-lived cookies / localStorage).
 *
 * Plain password is held only for the browser tab session so multi-device
 * household push/pull can re-auth. It is never written to localStorage accounts.
 */

import type { SyncCreds } from "@/lib/household-sync";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const SESSION_CREDS_KEY = "friggg-sync-creds";

export function saveSyncCreds(creds: SyncCreds): void {
  try {
    sessionStorage.setItem(
      SESSION_CREDS_KEY,
      JSON.stringify({
        email: creds.email.trim().toLowerCase(),
        password: creds.password,
      })
    );
  } catch {
    /* ignore */
  }
}

export function clearSyncCreds(): void {
  try {
    sessionStorage.removeItem(SESSION_CREDS_KEY);
  } catch {
    /* ignore */
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
    if (!userId || !accountsRaw) return null;
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

  return null;
}
