import { describe, expect, it } from "vitest";
import { getDefaultDaysLeft } from "./usePantry";

describe("getDefaultDaysLeft (H-03 deterministic)", () => {
  it("is stable for the same name and storage", () => {
    const a = getDefaultDaysLeft("Whole milk", "fridge");
    const b = getDefaultDaysLeft("Whole milk", "fridge");
    expect(a).toBe(b);
    expect(a).toBe(12);
  });

  it("uses longer life in freezer for proteins", () => {
    expect(getDefaultDaysLeft("Chicken breast", "freezer")).toBeGreaterThan(
      getDefaultDaysLeft("Chicken breast", "fridge")
    );
  });
});
