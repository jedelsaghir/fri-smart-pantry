import { describe, expect, it } from "vitest";
import { ingredientMatchesPantry, pantryHasIngredientQty } from "./recipe-helpers";
import type { PantryItemsByStorage } from "@/types/pantry";

describe("ingredientMatchesPantry", () => {
  it("matches simplified pesto", () => {
    expect(ingredientMatchesPantry("Pesto", "pesto")).toBe(true);
    expect(ingredientMatchesPantry("Barilla Pesto", "pesto")).toBe(true);
  });

  it("matches milk variants", () => {
    expect(ingredientMatchesPantry("Whole milk", "milk")).toBe(true);
    expect(ingredientMatchesPantry("Milk", "whole milk")).toBe(true);
  });

  it("matches mozzarella / cheese loosely", () => {
    expect(ingredientMatchesPantry("Mozzarella", "mozzarella")).toBe(true);
  });
});

describe("pantryHasIngredientQty", () => {
  const items: PantryItemsByStorage = {
    fridge: [
      {
        id: "1",
        name: "Pesto",
        qty: 100,
        unit: "g",
        emoji: "🌿",
        daysLeft: 10,
        minStock: 1,
      },
    ],
    freezer: [],
    pantry: [],
  };

  it("finds pesto stock", () => {
    expect(pantryHasIngredientQty(items, { name: "pesto", qty: 80, unit: "g" })).toBe(true);
  });
});
