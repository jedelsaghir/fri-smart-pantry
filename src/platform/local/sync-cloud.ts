/**
 * Cloud household sync adapter — server RPC pull/push.
 * Same email + password on any device restores household state.
 */

import type { SyncProvider } from "@/platform/types";
import type { FamilyMember, PantryItemsByStorage } from "@/types/pantry";
import {
  buildSnapshotFromLocalStorage,
  type HouseholdSyncSnapshot,
  type SyncCreds,
} from "@/lib/household-sync";
import {
  getHouseholdSyncStatus,
  pullHouseholdSync,
  pushHouseholdSync,
} from "@/server/household-sync";

export type CloudSyncProvider = SyncProvider & {
  pullHousehold(creds: SyncCreds): Promise<HouseholdSyncSnapshot | null>;
  pushHousehold(
    creds: SyncCreds,
    snapshot?: HouseholdSyncSnapshot
  ): Promise<{ ok: boolean; reason?: string; backend?: string }>;
  getStatus(): Promise<{ configured: boolean; backend: string; durable: boolean }>;
};

export const cloudSyncProvider: CloudSyncProvider = {
  id: "cloud-sync",
  mode: "cloud",

  async getStatus() {
    try {
      return await getHouseholdSyncStatus();
    } catch {
      return { configured: false, backend: "none", durable: false };
    }
  },

  async pullHousehold(creds: SyncCreds) {
    const result = await pullHouseholdSync({
      data: { email: creds.email, password: creds.password },
    });
    if (!result.ok) throw new Error(result.reason);
    return result.snapshot;
  },

  async pushHousehold(creds: SyncCreds, snapshot?: HouseholdSyncSnapshot) {
    const snap =
      snapshot ||
      (typeof window !== "undefined"
        ? buildSnapshotFromLocalStorage(creds.email)
        : null);
    if (!snap) return { ok: false, reason: "No snapshot to push" };
    const result = await pushHouseholdSync({
      data: { email: creds.email, password: creds.password, snapshot: snap },
    });
    if (!result.ok) return { ok: false, reason: result.reason };
    return { ok: true, backend: result.backend };
  },

  // Narrow legacy methods — map onto full snapshot for partial updates
  async pullPantry(): Promise<PantryItemsByStorage | null> {
    return null;
  },
  async pushPantry(_items: PantryItemsByStorage) {
    return { ok: true, reason: "use pushHousehold" };
  },
  async pullFamily(): Promise<FamilyMember[] | null> {
    return null;
  },
  async pushFamily(_members: FamilyMember[]) {
    return { ok: true, reason: "use pushHousehold" };
  },
};
