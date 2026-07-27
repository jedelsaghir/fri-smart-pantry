import { describe, expect, it } from "vitest";
import { upsertShoppingListItem } from "./shopping";

describe("upsertShoppingListItem", () => {
  it("merges by name+unit", () => {
    const list = [
      { id: "1", name: "Milk", qty: 1, unit: "L", emoji: "🥛", checked: false },
    ];
    const next = upsertShoppingListItem(list, {
      name: "milk",
      unit: "L",
      emoji: "🥛",
      qty: 2,
    });
    expect(next).toHaveLength(1);
    expect(next[0].qty).toBe(3);
  });

  it("merges convertible units (ml into L)", () => {
    const list = [
      { id: "1", name: "Milk", qty: 1, unit: "L", emoji: "🥛", checked: false },
    ];
    const next = upsertShoppingListItem(list, {
      name: "Milk",
      unit: "ml",
      emoji: "🥛",
      qty: 500,
    });
    expect(next).toHaveLength(1);
    expect(next[0].qty).toBe(1.5);
    expect(next[0].unit).toBe("L");
  });

  it("keeps incompatible units as separate rows", () => {
    const list = [
      { id: "1", name: "Eggs", qty: 6, unit: "pcs", emoji: "🥚", checked: false },
    ];
    const next = upsertShoppingListItem(list, {
      name: "Eggs",
      unit: "pack",
      emoji: "🥚",
      qty: 1,
    });
    expect(next).toHaveLength(2);
  });
});
