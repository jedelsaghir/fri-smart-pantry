import { describe, expect, it } from "vitest";
import type { StoredReceipt } from "@/types/pantry";
import {
  analyzeMonthStores,
  normalizeStoreName,
  pickBestStore,
} from "./store-insights";

function receipt(
  store: string,
  total: number,
  date: string,
  id = `r-${store}-${date}-${total}`
): StoredReceipt {
  return {
    id,
    store,
    total,
    date,
    currency: "EUR",
    imageDataUrl: "",
    items: [],
    createdAt: date,
  };
}

describe("normalizeStoreName", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeStoreName("  Lidl  ")).toBe("Lidl");
  });
});

describe("pickBestStore", () => {
  it("picks lowest average basket", () => {
    const { store } = pickBestStore([
      { store: "Tesco", visits: 2, totalSpend: 100, avgBasket: 50, share: 0.5 },
      { store: "Aldi", visits: 2, totalSpend: 60, avgBasket: 30, share: 0.3 },
      { store: "Lidl", visits: 1, totalSpend: 40, avgBasket: 40, share: 0.2 },
    ]);
    expect(store).toBe("Aldi");
  });
});

describe("analyzeMonthStores", () => {
  it("aggregates current month and recommends value store", () => {
    // Fixed month: July 2026
    const ref = new Date(2026, 6, 15);
    const receipts = [
      receipt("Tesco", 80, "2026-07-02T12:00:00.000Z"),
      receipt("Tesco", 70, "2026-07-10T12:00:00.000Z"),
      receipt("Aldi", 25, "2026-07-05T12:00:00.000Z"),
      receipt("Aldi", 30, "2026-07-12T12:00:00.000Z"),
      receipt("Lidl", 200, "2026-06-01T12:00:00.000Z"), // previous month — ignored
    ];
    const insight = analyzeMonthStores(receipts, ref);
    expect(insight.monthKey).toBe("2026-07");
    expect(insight.receiptCount).toBe(4);
    expect(insight.recommendedStore).toBe("Aldi");
    expect(insight.recommendation.toLowerCase()).toContain("aldi");
    expect(insight.stores.find((s) => s.store === "Aldi")?.avgBasket).toBe(27.5);
  });

  it("handles empty month", () => {
    const insight = analyzeMonthStores([], new Date(2026, 0, 1));
    expect(insight.recommendedStore).toBeNull();
    expect(insight.receiptCount).toBe(0);
  });
});
