import { describe, expect, it } from "vitest";
import {
  filterPantryRows,
  flattenPantryItems,
  itemMatchesQuery,
  preparePantryList,
  sortPantryRows,
  type PantryListRow,
} from "./pantry-list";

const row = (over: Partial<PantryListRow> & { id: string; name: string }): PantryListRow => ({
  id: over.id,
  name: over.name,
  qty: over.qty ?? 1,
  unit: over.unit ?? "pcs",
  emoji: over.emoji ?? "🛒",
  daysLeft: over.daysLeft ?? 10,
  minStock: over.minStock ?? 1,
  storage: over.storage ?? "fridge",
});

describe("itemMatchesQuery", () => {
  it("is case-insensitive and substring", () => {
    expect(itemMatchesQuery({ name: "Whole Milk" }, "milk")).toBe(true);
    expect(itemMatchesQuery({ name: "Whole Milk" }, "MILK")).toBe(true);
    expect(itemMatchesQuery({ name: "Eggs" }, "milk")).toBe(false);
  });
});

describe("sort + filter", () => {
  const rows = [
    row({ id: "a", name: "Zucchini", daysLeft: 2, qty: 5, minStock: 1 }),
    row({ id: "b", name: "Avocado", daysLeft: 1, qty: 1, minStock: 2 }),
    row({ id: "c", name: "Bread", daysLeft: 5, qty: 0, minStock: 1 }),
  ];

  it("sorts by expiry soonest", () => {
    const s = sortPantryRows(rows, "expiry");
    expect(s.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by qty low→high", () => {
    const s = sortPantryRows(rows, "qty");
    expect(s[0].id).toBe("c");
  });

  it("filters expiring and low stock", () => {
    expect(filterPantryRows(rows, "expiring").map((r) => r.id).sort()).toEqual(["a", "b"]);
    expect(filterPantryRows(rows, "low_stock").map((r) => r.id).sort()).toEqual(["b", "c"]);
  });

  it("preparePantryList chains search+filter+sort", () => {
    const flat = flattenPantryItems({
      fridge: [row({ id: "1", name: "Milk", storage: "fridge", daysLeft: 2 })],
      freezer: [row({ id: "2", name: "Ice", storage: "freezer" })],
      pantry: [],
    });
    const out = preparePantryList(flat, { query: "mi", filter: "expiring", sort: "name" });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Milk");
  });
});
