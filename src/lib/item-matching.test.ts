import { describe, expect, it } from "vitest";
import {
  findBestItemMatch,
  fuzzyNameSimilarity,
  isStrongUpdateCandidate,
  levenshteinRatio,
  normalizeMatchName,
  normalizeMatchUnit,
  scoreItemAgainstPantry,
  STRONG_MATCH_THRESHOLD,
} from "./item-matching";
import type { MatchablePantryItem } from "./item-matching";

const stock = (rows: Array<Partial<MatchablePantryItem> & { name: string }>): MatchablePantryItem[] =>
  rows.map((r, i) => ({
    id: r.id ?? `p-${i}`,
    name: r.name,
    unit: r.unit ?? "pcs",
    qty: r.qty ?? 1,
    emoji: r.emoji ?? "🛒",
    storage: r.storage ?? "fridge",
  }));

describe("normalizeMatchName", () => {
  it("lowercases, strips punctuation, expands abbreviations", () => {
    expect(normalizeMatchName("  Whole  Milk! ")).toBe("whole milk");
    expect(normalizeMatchName("Free-range eggs")).toBe("free range eggs");
    expect(normalizeMatchName("Org milk 1L")).toBe("organic milk");
    expect(normalizeMatchName("Wh milk")).toBe("whole milk");
  });
});

describe("normalizeMatchUnit", () => {
  it("maps aliases", () => {
    expect(normalizeMatchUnit("litre")).toBe("L");
    expect(normalizeMatchUnit("liter")).toBe("L");
    expect(normalizeMatchUnit("pieces")).toBe("pcs");
    expect(normalizeMatchUnit("grams")).toBe("g");
    expect(normalizeMatchUnit("gr")).toBe("g");
  });
});

describe("levenshteinRatio / fuzzyNameSimilarity", () => {
  it("scores near-identical strings high", () => {
    expect(levenshteinRatio("whole milk", "whole milk")).toBe(1);
    expect(fuzzyNameSimilarity("Whole milk 1L", "Whole Milk")).toBeGreaterThanOrEqual(0.9);
  });

  it("matches free range ≈ free-range", () => {
    expect(fuzzyNameSimilarity("Free range eggs", "Free-range eggs")).toBeGreaterThanOrEqual(
      0.9
    );
  });

  it("matches typos with Levenshtein", () => {
    expect(fuzzyNameSimilarity("Chiken thighs", "Chicken thighs")).toBeGreaterThanOrEqual(0.78);
  });

  it("rejects unrelated products", () => {
    expect(fuzzyNameSimilarity("Olive oil", "Pasta")).toBeLessThan(0.5);
  });
});

describe("findBestItemMatch", () => {
  it("finds Whole milk 1L against Whole Milk litre", () => {
    const match = findBestItemMatch(
      { name: "Whole milk 1L", unit: "L", qty: 2 },
      stock([{ id: "1", name: "Whole Milk", unit: "litre", qty: 1, emoji: "🥛" }])
    );
    expect(match).not.toBeNull();
    expect(match!.id).toBe("1");
    expect(match!.score).toBeGreaterThanOrEqual(STRONG_MATCH_THRESHOLD);
  });

  it("finds free range eggs with pieces unit", () => {
    const match = findBestItemMatch(
      { name: "Free range eggs", unit: "pieces", qty: 12 },
      stock([{ id: "e", name: "Free-range eggs", unit: "pcs", qty: 6, emoji: "🥚" }])
    );
    expect(match).not.toBeNull();
    expect(match!.id).toBe("e");
  });

  it("returns null for unrelated", () => {
    const match = findBestItemMatch(
      { name: "Olive oil", unit: "bottle" },
      stock([{ name: "Pasta", unit: "pack" }])
    );
    expect(match).toBeNull();
  });
});

describe("isStrongUpdateCandidate", () => {
  it("true for high OCR conf + strong match", () => {
    const match = findBestItemMatch(
      { name: "Whole Milk", unit: "L" },
      stock([{ id: "1", name: "Whole milk", unit: "L", qty: 2 }])
    );
    expect(isStrongUpdateCandidate(0.95, match)).toBe(true);
  });

  it("false for low OCR conf", () => {
    const match = findBestItemMatch(
      { name: "Whole Milk", unit: "L" },
      stock([{ id: "1", name: "Whole milk", unit: "L", qty: 2 }])
    );
    expect(isStrongUpdateCandidate(0.5, match)).toBe(false);
  });
});

describe("scoreItemAgainstPantry", () => {
  it("penalizes unit family mismatch", () => {
    const same = scoreItemAgainstPantry(
      { name: "Milk", unit: "L" },
      { id: "1", name: "Milk", unit: "L", qty: 1, storage: "fridge" }
    );
    const diff = scoreItemAgainstPantry(
      { name: "Milk", unit: "L" },
      { id: "1", name: "Milk", unit: "pcs", qty: 1, storage: "fridge" }
    );
    expect(same.score).toBeGreaterThan(diff.score);
  });
});
