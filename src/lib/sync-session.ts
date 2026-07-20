/**
 * Client-side sync session — remembers credentials for background push
 * (sessionStorage only; never long-lived cookies).
 */

import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { SyncCreds } from "@/lib/household-sync";

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
  } catch {}
}

export function clearSyncCreds(): void {
  try {
    sessionStorage.removeItem(SESSION_CREDS_KEY);
  } catch {}
}

export function loadSyncCreds(): SyncCreds | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CREDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SyncCreds;
      if (parsed?.email && parsed?.password) {
        return { email: parsed.email.trim().toLowerCase(), password: parsed.password };
      }
    }
  } catch {}

  // Demo recovery: accounts already store password locally — re-enable background push
  // after a refresh without forcing re-login.
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
  } catch {}

  return null;
}
