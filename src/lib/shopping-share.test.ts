import { describe, expect, it } from "vitest";
import {
  buildShoppingListShareText,
  shoppingListShareLines,
  whatsAppShareUrl,
} from "./shopping-share";

describe("shoppingListShareLines", () => {
  const list = [
    { id: "1", name: "Milk", qty: 1, unit: "L", emoji: "🥛", checked: false },
    { id: "2", name: "Eggs", qty: 6, unit: "pcs", emoji: "🥚", checked: true },
  ];

  it("prefers unchecked items", () => {
    const lines = shoppingListShareLines(list, "unchecked");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/Milk/);
  });

  it("builds WhatsApp URL", () => {
    const text = buildShoppingListShareText(list);
    expect(text).toMatch(/Shopping list/);
    expect(whatsAppShareUrl(text)).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});
