/**
 * Orchestrate pull-on-login and debounced push-on-change.
 */

import { getPlatform } from "@/platform";
import {
  applySnapshotToLocalStorage,
  buildSnapshotFromLocalStorage,
  writeLocalSyncMeta,
  type SyncCreds,
} from "@/lib/household-sync";
import { saveSyncCreds, loadSyncCreds, clearSyncCreds } from "@/lib/sync-session";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export type PullOnLoginResult = {
  applied: boolean;
  hadRemote: boolean;
  error?: string;
  backend?: string;
};

/**
 * After successful local auth: pull cloud household and apply if newer/present.
 * Then push local so this device seeds the cloud for other devices.
 */
export async function pullAndMergeOnLogin(creds: SyncCreds): Promise<PullOnLoginResult> {
  saveSyncCreds(creds);
  const platform = getPlatform();
  if (!platform.sync.pullHousehold) {
    writeLocalSyncMeta({ mode: "local", lastError: "Sync adapter missing pullHousehold" });
    return { applied: false, hadRemote: false, error: "Sync not available" };
  }

  try {
    const remote = await platform.sync.pullHousehold(creds);
    let applied = false;

    // On login: if cloud has a household for this email, restore it on this device
    // (PC ↔ iOS seamless restore). Then we push so cloud stays current.
    if (remote) {
      const currentUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      applySnapshotToLocalStorage(remote, { currentUserId });
      writeLocalSyncMeta({
        lastPulledAt: new Date().toISOString(),
        lastRemoteUpdatedAt: remote.updatedAt,
        mode: "cloud",
        lastError: undefined,
      });
      applied = true;
    }

    // Always push after login so cloud has this device's latest
    if (platform.sync.pushHousehold) {
      const snapshot = buildSnapshotFromLocalStorage(creds.email);
      const push = await platform.sync.pushHousehold(creds, snapshot);
      if (push.ok) {
        writeLocalSyncMeta({
          lastPushedAt: new Date().toISOString(),
          lastRemoteUpdatedAt: snapshot.updatedAt,
          mode: "cloud",
          lastError: undefined,
        });
      } else {
        writeLocalSyncMeta({ lastError: push.reason || "Push failed", mode: "cloud" });
      }
      return {
        applied,
        hadRemote: Boolean(remote),
        backend: push.backend,
        error: push.ok ? undefined : push.reason,
      };
    }

    return { applied, hadRemote: Boolean(remote) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    writeLocalSyncMeta({ lastError: msg, mode: "cloud" });
    return { applied: false, hadRemote: false, error: msg };
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;

/** Debounced background push of current localStorage snapshot */
export function scheduleHouseholdPush(delayMs = 1200): void {
  const creds = loadSyncCreds();
  if (!creds) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void flushHouseholdPush();
  }, delayMs);
}

export async function flushHouseholdPush(): Promise<{ ok: boolean; reason?: string }> {
  const creds = loadSyncCreds();
  if (!creds) return { ok: false, reason: "Not signed in for sync" };
  if (pushInFlight) return { ok: true, reason: "busy" };
  const platform = getPlatform();
  if (!platform.sync.pushHousehold) return { ok: false, reason: "No push adapter" };

  pushInFlight = true;
  try {
    const snapshot = buildSnapshotFromLocalStorage(creds.email);
    const result = await platform.sync.pushHousehold(creds, snapshot);
    if (result.ok) {
      writeLocalSyncMeta({
        lastPushedAt: new Date().toISOString(),
        lastRemoteUpdatedAt: snapshot.updatedAt,
        mode: "cloud",
        lastError: undefined,
      });
    } else {
      writeLocalSyncMeta({ lastError: result.reason || "Push failed", mode: "cloud" });
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Push failed";
    writeLocalSyncMeta({ lastError: msg });
    return { ok: false, reason: msg };
  } finally {
    pushInFlight = false;
  }
}

export function logoutSyncSession(): void {
  clearSyncCreds();
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}
