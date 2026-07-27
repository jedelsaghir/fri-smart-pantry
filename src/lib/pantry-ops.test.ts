import { describe, expect, it } from "vitest";
import {
  applyIncomingToStorage,
  deductIngredients,
  namesMatchLoose,
  sameProduct,
  upsertPantryItem,
} from "./pantry-ops";
import type { PantryItem, PantryItemsByStorage } from "@/types/pantry";

const base = (over: Partial<PantryItem> = {}): PantryItem => ({
  id: "1",
  name: "Whole milk",
  qty: 1,
  unit: "L",
  emoji: "🥛",
  daysLeft: 5,
  minStock: 2,
  ...over,
});

describe("sameProduct", () => {
  it("matches name+unit ignoring case", () => {
    expect(sameProduct(base(), base({ name: "whole milk", id: "2" }))).toBe(true);
    expect(sameProduct(base(), base({ unit: "pcs" }))).toBe(false);
  });
  it("matches unit aliases and size-stripped names", () => {
    expect(
      sameProduct(
        { name: "Whole milk 1L", unit: "L" },
        { name: "Whole Milk", unit: "litre" }
      )
    ).toBe(true);
    expect(
      sameProduct({ name: "Free-range eggs", unit: "pcs" }, { name: "Free range eggs", unit: "pieces" })
    ).toBe(true);
  });
  it("treats g and kg as same product (convertible)", () => {
    expect(sameProduct({ name: "Flour", unit: "g" }, { name: "Flour", unit: "kg" })).toBe(true);
    expect(sameProduct({ name: "Milk", unit: "ml" }, { name: "Milk", unit: "L" })).toBe(true);
  });
});

describe("upsertPantryItem conversion", () => {
  it("merges 500g into 1kg stock as 1.5kg", () => {
    const list = [base({ name: "Flour", unit: "kg", qty: 1 })];
    const next = upsertPantryItem(list, base({ id: "x", name: "Flour", unit: "g", qty: 500 }));
    expect(next).toHaveLength(1);
    expect(next[0].qty).toBe(1.5);
    expect(next[0].unit).toBe("kg");
  });
});

describe("namesMatchLoose", () => {
  it("normalizes punctuation", () => {
    expect(namesMatchLoose("Whole milk", "whole  milk")).toBe(true);
  });
});

describe("upsertPantryItem", () => {
  it("merges qty for same product", () => {
    const list = [base({ qty: 2 })];
    const next = upsertPantryItem(list, base({ id: "x", qty: 3 }));
    expect(next).toHaveLength(1);
    expect(next[0].qty).toBe(5);
  });
});

describe("applyIncomingToStorage", () => {
  it("merges into fridge bucket", () => {
    const prev: PantryItemsByStorage = {
      fridge: [base()],
      freezer: [],
      pantry: [],
    };
    const next = applyIncomingToStorage(prev, "fridge", base({ id: "n", qty: 2 }));
    expect(next.fridge[0].qty).toBe(3);
  });
});

describe("deductIngredients", () => {
  it("deducts and removes zero qty", () => {
    const prev: PantryItemsByStorage = {
      fridge: [base({ qty: 2 }), base({ id: "2", name: "Eggs", unit: "pcs", qty: 6 })],
      freezer: [],
      pantry: [],
    };
    const { next, used } = deductIngredients(prev, [
      { name: "Whole milk", qty: 2, unit: "L" },
    ]);
    expect(used).toContain("Whole milk");
    expect(next.fridge.find((i) => i.name === "Whole milk")).toBeUndefined();
    expect(next.fridge.find((i) => i.name === "Eggs")?.qty).toBe(6);
  });
});
