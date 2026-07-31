import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  loadWasteStore,
  recordWasteEvent,
  summarizeWasteMonth,
  undoLastWasteEvent,
} from "./waste-stats";
import { STORAGE_KEYS } from "./storage-keys";

const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  });
  mem.delete(STORAGE_KEYS.WASTE_STATS);
});

describe("waste-stats", () => {
  it("records used and expired and summarizes month", () => {
    recordWasteEvent("used", { name: "Milk", qty: 1, unit: "L" });
    recordWasteEvent("expired", { name: "Yogurt", qty: 1, unit: "tub" });
    recordWasteEvent("used", { name: "Eggs", qty: 2, unit: "pcs" });
    const s = summarizeWasteMonth();
    expect(s.usedCount).toBe(2);
    expect(s.expiredCount).toBe(1);
  });

  it("undo removes latest matching name", () => {
    recordWasteEvent("expired", { name: "Bread", qty: 1, unit: "pcs" });
    undoLastWasteEvent({ name: "Bread" });
    expect(loadWasteStore().events).toHaveLength(0);
  });
});
