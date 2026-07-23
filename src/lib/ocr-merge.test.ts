import { describe, expect, it } from "vitest";
import {
  mergeOcrLineItems,
  mergeOcrResults,
  splitAutoAndReview,
  ocrLinesToDetected,
} from "./ocr-merge";
import type { OcrDetectResult, OcrLineItem } from "@/platform/types";

const line = (partial: Partial<OcrLineItem> & { name: string }): OcrLineItem => ({
  qty: 1,
  unit: "pcs",
  confidence: 0.9,
  ...partial,
});

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

describe("splitAutoAndReview", () => {
  it("sends low confidence and pantry matches to review", () => {
    const items = ocrLinesToDetected([
      line({ name: "New Juice", confidence: 0.95 }),
      line({ name: "Fuzzy Item", confidence: 0.5 }),
      line({ name: "Whole Milk", confidence: 0.99, unit: "L" }),
    ]);
    const { autoItems, reviewItems } = splitAutoAndReview(items, [
      { name: "whole milk", unit: "L" },
    ]);
    expect(autoItems.map((i) => i.name)).toEqual(["New Juice"]);
    expect(reviewItems.map((i) => i.name).sort()).toEqual(["Fuzzy Item", "Whole Milk"]);
  });
});
