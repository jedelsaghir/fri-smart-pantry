import { describe, expect, it } from "vitest";
import {
  classifyPantryEligibility,
  isPossiblyNonFood,
  shouldAutoExcludeNonPantry,
} from "./non-pantry";

describe("classifyPantryEligibility", () => {
  it("keeps real food as pantry", () => {
    for (const name of ["Whole milk", "Free-range eggs", "Olive oil", "Chicken thighs", "Greek yogurt"]) {
      const r = classifyPantryEligibility(name, { ocrConfidence: 0.95 });
      expect(r.kind).toBe("pantry");
    }
  });

  it("auto-excludes clear non-pantry items", () => {
    for (const name of [
      "Toilet paper 12 rolls",
      "Laundry detergent",
      "Shampoo 500ml",
      "AA batteries 8pk",
      "USB-C charger",
      "Fabric softener",
      "Toothpaste",
      "Bin bags",
    ]) {
      const r = classifyPantryEligibility(name, { ocrConfidence: 0.95 });
      expect(r.kind).toBe("non_pantry");
      expect(shouldAutoExcludeNonPantry(r)).toBe(true);
    }
  });

  it("flags soft/uncertain non-food for review", () => {
    const r = classifyPantryEligibility("Multi wipes", { ocrConfidence: 0.7 });
    // "wipes" soft under cleaning
    expect(["uncertain", "non_pantry"]).toContain(r.kind);
    if (r.kind === "uncertain") {
      expect(isPossiblyNonFood(r)).toBe(true);
      expect(shouldAutoExcludeNonPantry(r)).toBe(false);
    }
  });

  it("does not flag peanut butter as non-food cream", () => {
    const r = classifyPantryEligibility("Peanut butter", { ocrConfidence: 0.9 });
    expect(r.kind).toBe("pantry");
  });

  it("uses OCR category hints", () => {
    const r = classifyPantryEligibility("Unknown SKU 123", {
      category: "household",
      ocrConfidence: 0.9,
    });
    expect(r.kind).toBe("non_pantry");
  });
});
