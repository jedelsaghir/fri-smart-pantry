/**
 * Wipe all Friġġ local data so the user can start fresh.
 * Does not touch unrelated localStorage keys from other sites.
 */

import { STORAGE_KEYS } from "@/lib/storage-keys";
import { LOCAL_SYNC_META_KEY } from "@/lib/household-sync";
import { clearSyncCreds } from "@/lib/sync-session";

const EXTRA_KEYS = [LOCAL_SYNC_META_KEY, "friggg-sync-creds"] as const;

/** List accounts currently on this device (for console / one-shot debug) */
export function listLocalAccounts(): Array<{
  id: string;
  name: string;
  email: string;
  emoji: string;
}> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{
      id?: string;
      name?: string;
      email?: string;
      emoji?: string;
    }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((a) => ({
      id: a.id || "",
      name: a.name || "",
      email: a.email || "",
      emoji: a.emoji || "👤",
    }));
  } catch {
    return [];
  }
}

/** Remove every friggg-* key + known app keys + sync session */
export function wipeAllFriggLocalData(): { removedKeys: string[] } {
  const removed: string[] = [];
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("friggg") || key.startsWith("friggg-")) {
        localStorage.removeItem(key);
        removed.push(key);
      }
    }
    for (const key of Object.values(STORAGE_KEYS)) {
      if (localStorage.getItem(key) != null) {
        localStorage.removeItem(key);
        if (!removed.includes(key)) removed.push(key);
      }
    }
    for (const key of EXTRA_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {}
  clearSyncCreds();
  try {
    sessionStorage.clear();
  } catch {}
  return { removedKeys: removed };
}
