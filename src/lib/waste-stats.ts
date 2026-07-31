/**
 * Lightweight used-vs-expired waste tracking (localStorage).
 */

import { STORAGE_KEYS } from "@/lib/storage-keys";

export type WasteDisposition = "used" | "expired";

export type WasteEvent = {
  disposition: WasteDisposition;
  name: string;
  qty: number;
  unit: string;
  at: string; // ISO
};

export type WasteMonthSummary = {
  yearMonth: string; // YYYY-MM
  usedCount: number;
  expiredCount: number;
  usedQty: number;
  expiredQty: number;
};

export type WasteStore = {
  v: 1;
  events: WasteEvent[];
};

const MAX_EVENTS = 200;

function yearMonth(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined" && !!localStorage;
  } catch {
    return false;
  }
}

export function loadWasteStore(): WasteStore {
  if (!storageAvailable()) return { v: 1, events: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WASTE_STATS);
    if (!raw) return { v: 1, events: [] };
    const parsed = JSON.parse(raw) as WasteStore;
    if (!parsed || !Array.isArray(parsed.events)) return { v: 1, events: [] };
    return { v: 1, events: parsed.events.filter((e) => e && e.disposition && e.at) };
  } catch {
    return { v: 1, events: [] };
  }
}

export function saveWasteStore(store: WasteStore): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.WASTE_STATS,
      JSON.stringify({ v: 1, events: store.events.slice(0, MAX_EVENTS) })
    );
  } catch {
    /* ignore */
  }
}

export function recordWasteEvent(
  disposition: WasteDisposition,
  item: { name: string; qty: number; unit: string }
): WasteStore {
  const store = loadWasteStore();
  store.events.unshift({
    disposition,
    name: item.name,
    qty: item.qty,
    unit: item.unit,
    at: new Date().toISOString(),
  });
  store.events = store.events.slice(0, MAX_EVENTS);
  saveWasteStore(store);
  return store;
}

/** Remove most recent matching event (for undo). */
export function undoLastWasteEvent(item: { name: string }): void {
  const store = loadWasteStore();
  const idx = store.events.findIndex((e) => e.name === item.name);
  if (idx < 0) return;
  store.events.splice(idx, 1);
  saveWasteStore(store);
}

export function summarizeWasteMonth(
  store: WasteStore = loadWasteStore(),
  ym = yearMonth()
): WasteMonthSummary {
  let usedCount = 0;
  let expiredCount = 0;
  let usedQty = 0;
  let expiredQty = 0;
  for (const e of store.events) {
    if (!e.at.startsWith(ym)) continue;
    if (e.disposition === "used") {
      usedCount += 1;
      usedQty += e.qty || 0;
    } else {
      expiredCount += 1;
      expiredQty += e.qty || 0;
    }
  }
  return { yearMonth: ym, usedCount, expiredCount, usedQty, expiredQty };
}
