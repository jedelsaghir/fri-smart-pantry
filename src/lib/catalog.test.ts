import { describe, expect, it } from "vitest";
import {
  findMergeGroups,
  mergeCatalogGroup,
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
});

describe("namesLookSimilar", () => {
  it("matches substring variants", () => {
    expect(namesLookSimilar("Milk", "Whole milk")).toBe(true);
  });
  it("rejects unrelated", () => {
    expect(namesLookSimilar("Milk", "Pasta")).toBe(false);
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
