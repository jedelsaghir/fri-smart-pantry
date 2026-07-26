/**
 * Orchestrate pull-on-login and debounced push-on-change.
 */

import { getPlatform } from "@/platform";
import {
  applySnapshotToLocalStorage,
  buildSnapshotFromLocalStorage,
  isLocalPantryEmpty,
  readLocalSyncMeta,
  shouldApplyRemote,
  writeLocalSyncMeta,
  type SyncCreds,
} from "@/lib/household-sync";
import { saveSyncCreds, loadSyncCreds, clearSyncCreds } from "@/lib/sync-session";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export type PullOnLoginResult = {
  applied: boolean;
  hadRemote: boolean;
  skippedStaleRemote?: boolean;
  error?: string;
  backend?: string;
};

/**
 * After successful local auth: pull cloud household and apply only when remote
 * is newer/equal to last known cloud clock (or local pantry is empty).
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
    let skippedStaleRemote = false;

    if (remote) {
      const meta = readLocalSyncMeta();
      const localClock = meta.lastRemoteUpdatedAt || meta.lastPushedAt;
      const empty = isLocalPantryEmpty();
      // Empty device always takes cloud. Otherwise only apply when remote ≥ local clock.
      const apply =
        empty || !localClock || shouldApplyRemote(localClock, remote.updatedAt);

      if (apply) {
        const currentUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        applySnapshotToLocalStorage(remote, { currentUserId });
        writeLocalSyncMeta({
          lastPulledAt: new Date().toISOString(),
          lastRemoteUpdatedAt: remote.updatedAt,
          mode: "cloud",
          lastError: undefined,
        });
        applied = true;
      } else {
        skippedStaleRemote = true;
        writeLocalSyncMeta({
          lastPulledAt: new Date().toISOString(),
          mode: "cloud",
          lastError: undefined,
        });
      }
    }

    // Always push after login so cloud has this device's latest (fresh updatedAt)
    if (platform.sync.pushHousehold) {
      const snapshot = buildSnapshotFromLocalStorage(creds.email);
      const push = await platform.sync.pushHousehold(creds, snapshot);
      if (push.ok) {
        writeLocalSyncMeta({
          lastPushedAt: new Date().toISOString(),
          lastRemoteUpdatedAt: push.updatedAt || snapshot.updatedAt,
          mode: "cloud",
          lastError: undefined,
        });
      } else {
        writeLocalSyncMeta({ lastError: push.reason || "Push failed", mode: "cloud" });
      }
      return {
        applied,
        hadRemote: Boolean(remote),
        skippedStaleRemote,
        backend: push.backend,
        error: push.ok ? undefined : push.reason,
      };
    }

    return { applied, hadRemote: Boolean(remote), skippedStaleRemote };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    writeLocalSyncMeta({ lastError: msg, mode: "cloud" });
    return { applied: false, hadRemote: false, error: msg };
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushInFlight = false;
/** When a push is skipped because another is in flight, run once more after. */
let trailingPushNeeded = false;

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
  if (pushInFlight) {
    // H-12: ensure latest state still uploads after the in-flight push finishes
    trailingPushNeeded = true;
    return { ok: false, reason: "busy" };
  }
  const platform = getPlatform();
  if (!platform.sync.pushHousehold) return { ok: false, reason: "No push adapter" };

  pushInFlight = true;
  try {
    const snapshot = buildSnapshotFromLocalStorage(creds.email);
    const result = await platform.sync.pushHousehold(creds, snapshot);
    if (result.ok) {
      writeLocalSyncMeta({
        lastPushedAt: new Date().toISOString(),
        lastRemoteUpdatedAt: result.updatedAt || snapshot.updatedAt,
        mode: "cloud",
        lastError: undefined,
      });
    } else {
      writeLocalSyncMeta({ lastError: result.reason || "Push failed", mode: "cloud" });
      // If cloud is newer, try a pull so the next trailing push is based on fresh base
      if (result.reason && /newer|pull first|stale/i.test(result.reason) && platform.sync.pullHousehold) {
        try {
          const remote = await platform.sync.pullHousehold(creds);
          if (remote) {
            const meta = readLocalSyncMeta();
            if (
              isLocalPantryEmpty() ||
              shouldApplyRemote(meta.lastRemoteUpdatedAt || meta.lastPushedAt, remote.updatedAt)
            ) {
              const currentUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
              applySnapshotToLocalStorage(remote, { currentUserId });
              writeLocalSyncMeta({
                lastPulledAt: new Date().toISOString(),
                lastRemoteUpdatedAt: remote.updatedAt,
                lastError: result.reason,
              });
            }
          }
        } catch {
          /* ignore pull recovery errors */
        }
      }
    }
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Push failed";
    writeLocalSyncMeta({ lastError: msg });
    return { ok: false, reason: msg };
  } finally {
    pushInFlight = false;
    if (trailingPushNeeded) {
      trailingPushNeeded = false;
      // Small delay so callers can finish writing localStorage first
      pushTimer = setTimeout(() => {
        void flushHouseholdPush();
      }, 80);
    }
  }
}

export function logoutSyncSession(): void {
  clearSyncCreds();
  trailingPushNeeded = false;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}
