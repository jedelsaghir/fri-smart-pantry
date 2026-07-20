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
    expect(sameProduct(base(), base({ unit: "ml" }))).toBe(false);
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
