import { describe, expect, it } from "vitest";
import {
  baseUnit,
  canToggleUnit,
  convertQty,
  convertQtyOrKeep,
  mergeQuantities,
  normalizeUnit,
  toggleMassUnit,
  toggleVolumeUnit,
  unitFamily,
  unitsCompatible,
} from "./units";

describe("normalizeUnit", () => {
  it("maps aliases", () => {
    expect(normalizeUnit("litre")).toBe("L");
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("kilo")).toBe("kg");
    expect(normalizeUnit("pieces")).toBe("pcs");
    expect(normalizeUnit("millilitre")).toBe("ml");
  });
});

describe("convertQty g↔kg ml↔L", () => {
  it("converts mass", () => {
    expect(convertQty(500, "g", "kg")).toBe(0.5);
    expect(convertQty(0.5, "kg", "g")).toBe(500);
    expect(convertQty(1, "kg", "kg")).toBe(1);
  });

  it("converts volume", () => {
    expect(convertQty(500, "ml", "L")).toBe(0.5);
    expect(convertQty(1.5, "L", "ml")).toBe(1500);
    expect(convertQty(10, "cl", "ml")).toBe(100);
  });

  it("returns null for incompatible units", () => {
    expect(convertQty(1, "pcs", "g")).toBeNull();
    expect(convertQty(1, "L", "g")).toBeNull();
  });
});

describe("unitsCompatible", () => {
  it("treats g and kg as compatible", () => {
    expect(unitsCompatible("g", "kg")).toBe(true);
    expect(unitsCompatible("gram", "kg")).toBe(true);
    expect(unitsCompatible("ml", "L")).toBe(true);
    expect(unitsCompatible("pcs", "L")).toBe(false);
  });

  it("baseUnit collapses families", () => {
    expect(baseUnit("kg")).toBe("g");
    expect(baseUnit("L")).toBe("ml");
    expect(baseUnit("pcs")).toBe("pcs");
  });
});

describe("mergeQuantities", () => {
  it("merges 500g into 0.5kg as 1kg", () => {
    const m = mergeQuantities(0.5, "kg", 500, "g");
    expect(m).toEqual({ qty: 1, unit: "kg" });
  });

  it("merges 500ml into 1L as 1.5L", () => {
    const m = mergeQuantities(1, "L", 500, "ml");
    expect(m).toEqual({ qty: 1.5, unit: "L" });
  });
});

describe("toggles", () => {
  it("toggles mass and volume", () => {
    expect(toggleMassUnit(500, "g")).toEqual({ qty: 0.5, unit: "kg" });
    expect(toggleMassUnit(1, "kg")).toEqual({ qty: 1000, unit: "g" });
    expect(toggleVolumeUnit(750, "ml")).toEqual({ qty: 0.75, unit: "L" });
    expect(canToggleUnit("g")).toBe(true);
    expect(canToggleUnit("pcs")).toBe(false);
  });
});

describe("convertQtyOrKeep / family", () => {
  it("keeps incompatible as-is", () => {
    expect(convertQtyOrKeep(3, "pcs", "g")).toEqual({
      qty: 3,
      unit: "pcs",
      converted: false,
    });
  });
  it("classifies families", () => {
    expect(unitFamily("kg")).toBe("mass");
    expect(unitFamily("L")).toBe("volume");
    expect(unitFamily("pcs")).toBe("count");
  });
});
