import type { SyncProvider } from "@/platform/types";

/** Local-only sync: data never leaves the device (D-1 deferred). */
export const localSyncProvider: SyncProvider = {
  id: "local-sync",
  mode: "local",
  async pullPantry() {
    return null;
  },
  async pushPantry() {
    return { ok: true, reason: "local-only" };
  },
  async pullFamily() {
    return null;
  },
  async pushFamily() {
    return { ok: true, reason: "local-only" };
  },
};
