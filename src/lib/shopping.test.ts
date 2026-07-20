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

  it("adds distinct unit as new row", () => {
    const list = [
      { id: "1", name: "Milk", qty: 1, unit: "L", emoji: "🥛", checked: false },
    ];
    const next = upsertShoppingListItem(list, {
      name: "Milk",
      unit: "ml",
      emoji: "🥛",
      qty: 500,
    });
    expect(next).toHaveLength(2);
  });
});
