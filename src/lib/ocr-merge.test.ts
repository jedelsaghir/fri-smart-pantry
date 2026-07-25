import { describe, expect, it } from "vitest";
import {
  findBestPantryMatch,
  mergeOcrLineItems,
  mergeOcrResults,
  scorePantryCandidate,
  splitAutoAndReview,
  ocrLinesToDetected,
  type FlatPantryRef,
} from "./ocr-merge";
import type { OcrDetectResult, OcrLineItem } from "@/platform/types";

const line = (partial: Partial<OcrLineItem> & { name: string }): OcrLineItem => ({
  qty: 1,
  unit: "pcs",
  confidence: 0.9,
  ...partial,
});

const pantry = (rows: Array<Partial<FlatPantryRef> & { name: string }>): FlatPantryRef[] =>
  rows.map((r, i) => ({
    id: r.id ?? `p-${i}`,
    name: r.name,
    unit: r.unit ?? "pcs",
    qty: r.qty ?? 1,
    emoji: r.emoji ?? "🛒",
    storage: r.storage ?? "fridge",
  }));

describe("mergeOcrLineItems", () => {
  it("deduplicates the same product across photos without summing qty", () => {
    const merged = mergeOcrLineItems([
      [line({ name: "Whole Milk", qty: 1, unit: "L", confidence: 0.7 })],
      [line({ name: "Whole Milk", qty: 1, unit: "L", confidence: 0.95, price: 1.29 })],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].confidence).toBe(0.95);
    expect(merged[0].price).toBe(1.29);
    expect(merged[0].qty).toBe(1);
  });

  it("dedupes unit aliases (litre vs L)", () => {
    const merged = mergeOcrLineItems([
      [line({ name: "Milk", unit: "litre", confidence: 0.8 })],
      [line({ name: "Milk", unit: "L", confidence: 0.9 })],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].unit).toBe("L");
  });

  it("keeps distinct products", () => {
    const merged = mergeOcrLineItems([
      [line({ name: "Milk", unit: "L" }), line({ name: "Eggs", unit: "pcs", qty: 12 })],
      [line({ name: "Bread", unit: "pcs" })],
    ]);
    expect(merged.map((m) => m.name).sort()).toEqual(["Bread", "Eggs", "Milk"]);
  });
});

describe("mergeOcrResults", () => {
  it("returns failure when every photo fails", () => {
    const r = mergeOcrResults([
      {
        ok: false,
        mode: "live",
        provider: "xai",
        items: [],
        reason: "Blurry image",
      },
    ]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Blurry/i);
  });

  it("merges successful batches", () => {
    const a: OcrDetectResult = {
      ok: true,
      mode: "live",
      provider: "xai",
      items: [line({ name: "Yogurt" })],
      store: "Lidl",
    };
    const b: OcrDetectResult = {
      ok: true,
      mode: "live",
      provider: "xai",
      items: [line({ name: "Butter" })],
    };
    const r = mergeOcrResults([a, b]);
    expect(r.ok).toBe(true);
    expect(r.store).toBe("Lidl");
    expect(r.items).toHaveLength(2);
  });
});

describe("scorePantryCandidate / findBestPantryMatch", () => {
  it("matches Whole milk 1L to Whole Milk with L / litre units", () => {
    const stock = pantry([{ id: "1", name: "Whole Milk", unit: "litre", qty: 2, emoji: "🥛" }]);
    const match = findBestPantryMatch({ name: "Whole milk 1L", unit: "L", qty: 1 }, stock);
    expect(match).not.toBeNull();
    expect(match!.id).toBe("1");
    expect(match!.kind).toBe("exact");
    expect(match!.score).toBeGreaterThanOrEqual(0.9);
  });

  it("matches free range eggs ≈ Free-range eggs", () => {
    const stock = pantry([{ id: "e", name: "Free-range eggs", unit: "pcs", qty: 6, emoji: "🥚" }]);
    const match = findBestPantryMatch(
      { name: "Free range eggs", unit: "pieces", qty: 12 },
      stock
    );
    expect(match).not.toBeNull();
    expect(match!.id).toBe("e");
    expect(match!.score).toBeGreaterThanOrEqual(0.7);
  });

  it("does not match unrelated products", () => {
    const stock = pantry([{ name: "Pasta", unit: "pack" }]);
    const match = findBestPantryMatch({ name: "Olive oil", unit: "bottle" }, stock);
    expect(match).toBeNull();
  });

  it("scores exact name+unit highly", () => {
    const { score, kind } = scorePantryCandidate(
      { name: "Greek yogurt", unit: "tub", qty: 2 },
      { name: "Greek yogurt", unit: "tub", qty: 1 }
    );
    expect(score).toBeGreaterThanOrEqual(0.95);
    expect(kind).toBe("exact");
  });
});

describe("splitAutoAndReview", () => {
  it("sends low confidence and pantry matches to review", () => {
    const items = ocrLinesToDetected([
      line({ name: "New Juice", confidence: 0.95 }),
      line({ name: "Fuzzy Item", confidence: 0.5 }),
      line({ name: "Whole Milk", confidence: 0.99, unit: "L" }),
    ]);
    const stock = pantry([
      { id: "m1", name: "whole milk", unit: "L", qty: 1, emoji: "🥛", storage: "fridge" },
    ]);
    const { autoItems, reviewItems } = splitAutoAndReview(items, stock);
    expect(autoItems.map((i) => i.name)).toEqual(["New Juice"]);
    expect(reviewItems.map((i) => i.name).sort()).toEqual(["Fuzzy Item", "Whole Milk"]);

    const milk = reviewItems.find((i) => i.name === "Whole Milk")!;
    expect(milk.pantryMatch?.id).toBe("m1");
    expect(milk.disposition).toBe("merge");
  });

  it("defaults exact high-confidence matches to merge disposition", () => {
    const items = ocrLinesToDetected([
      line({ name: "Whole milk 1L", confidence: 0.96, unit: "L", qty: 2 }),
    ]);
    const stock = pantry([{ id: "m1", name: "Whole Milk", unit: "L", qty: 1, emoji: "🥛" }]);
    const { autoItems, reviewItems } = splitAutoAndReview(items, stock);
    expect(autoItems).toHaveLength(0);
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].pantryMatch?.kind).toBe("exact");
    expect(reviewItems[0].disposition).toBe("merge");
  });

  it("keeps high-confidence new items on auto path", () => {
    const items = ocrLinesToDetected([line({ name: "Sparkling water", confidence: 0.93 })]);
    const { autoItems, reviewItems } = splitAutoAndReview(items, pantry([]));
    expect(autoItems).toHaveLength(1);
    expect(reviewItems).toHaveLength(0);
  });
});
