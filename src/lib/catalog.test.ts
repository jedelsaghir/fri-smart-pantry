import { describe, expect, it } from "vitest";
import {
  coreItemName,
  findMergeGroups,
  mergeCatalogGroup,
  nameSimilarityScore,
  namesLookSimilar,
  normalizeItemName,
  searchCatalog,
} from "./catalog";
import type { CatalogItem } from "@/types/pantry";

const item = (id: string, name: string): CatalogItem => ({
  id,
  name,
  unit: "pcs",
  emoji: "🛒",
  updatedAt: new Date().toISOString(),
});

describe("normalizeItemName", () => {
  it("lowercases and collapses spaces", () => {
    expect(normalizeItemName("  Whole  Milk! ")).toBe("whole milk");
  });
  it("treats hyphens as spaces", () => {
    expect(normalizeItemName("Free-range eggs")).toBe("free range eggs");
  });
});

describe("coreItemName", () => {
  it("strips size suffixes", () => {
    expect(coreItemName("Whole milk 1L")).toBe("whole milk");
    expect(coreItemName("Eggs 12pcs")).toBe("eggs");
    expect(coreItemName("Chicken 500g")).toBe("chicken");
  });
});

describe("namesLookSimilar", () => {
  it("matches substring variants", () => {
    expect(namesLookSimilar("Milk", "Whole milk")).toBe(true);
  });
  it("matches free-range vs free range", () => {
    expect(namesLookSimilar("Free range eggs", "Free-range eggs")).toBe(true);
  });
  it("matches names with size noise", () => {
    expect(namesLookSimilar("Whole milk 1L", "Whole Milk")).toBe(true);
  });
  it("rejects unrelated", () => {
    expect(namesLookSimilar("Milk", "Pasta")).toBe(false);
  });
  it("scores exact cores near 1", () => {
    expect(nameSimilarityScore("Whole milk 1L", "Whole Milk")).toBeGreaterThanOrEqual(0.95);
  });
});

describe("findMergeGroups / mergeCatalogGroup", () => {
  it("groups similar names and merges to primary", () => {
    const catalog = [item("a", "Milk"), item("b", "Whole milk"), item("c", "Pasta")];
    const groups = findMergeGroups(catalog);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const g = groups[0];
    const merged = mergeCatalogGroup(catalog, g.primaryId, g.memberIds);
    expect(merged.find((x) => x.name === "Pasta")).toBeTruthy();
    expect(merged.filter((x) => namesLookSimilar(x.name, "milk")).length).toBe(1);
  });
});

describe("searchCatalog", () => {
  it("ranks prefix matches first", () => {
    const catalog = [item("1", "Greek yogurt"), item("2", "Yogurt"), item("3", "Milk")];
    const hits = searchCatalog(catalog, "yog");
    expect(hits[0].name.toLowerCase()).toContain("yog");
  });
});
