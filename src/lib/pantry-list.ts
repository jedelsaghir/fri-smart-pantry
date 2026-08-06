/**
 * Pure pantry list search / sort / filter helpers.
 */

import type { PantryItem, StorageKey } from "@/types/pantry";
import { EXPIRING_SOON_DAYS } from "@/lib/item-status";

export type PantrySortMode = "name" | "expiry" | "qty";
export type PantryFilterMode = "all" | "expiring" | "low_stock";

export type PantryListRow = PantryItem & { storage: StorageKey };

export function flattenPantryItems(items: {
  fridge: PantryItem[];
  freezer: PantryItem[];
  pantry: PantryItem[];
}): PantryListRow[] {
  return [
    ...items.fridge.map((i) => ({ ...i, storage: "fridge" as const })),
    ...items.freezer.map((i) => ({ ...i, storage: "freezer" as const })),
    ...items.pantry.map((i) => ({ ...i, storage: "pantry" as const })),
  ];
}

/** Case-insensitive, numeric-aware name match. */
export function itemMatchesQuery(item: Pick<PantryItem, "name">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.name.toLowerCase().includes(q);
}

export function filterPantryRows(
  rows: PantryListRow[],
  filter: PantryFilterMode
): PantryListRow[] {
  if (filter === "all") return rows;
  if (filter === "expiring") {
    return rows.filter(
      (i) => typeof i.daysLeft === "number" && i.daysLeft <= EXPIRING_SOON_DAYS
    );
  }
  // low stock
  return rows.filter((i) => i.qty <= (i.minStock ?? 0));
}

export function sortPantryRows(
  rows: PantryListRow[],
  sort: PantrySortMode
): PantryListRow[] {
  const next = [...rows];
  if (sort === "expiry") {
    next.sort((a, b) => {
      const aN = typeof a.daysLeft === "number" ? a.daysLeft : Number.POSITIVE_INFINITY;
      const bN = typeof b.daysLeft === "number" ? b.daysLeft : Number.POSITIVE_INFINITY;
      return aN - bN || a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  } else if (sort === "qty") {
    next.sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name, undefined, { numeric: true }));
  } else {
    next.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
    );
  }
  return next;
}

export function preparePantryList(
  rows: PantryListRow[],
  opts: { query?: string; filter?: PantryFilterMode; sort?: PantrySortMode }
): PantryListRow[] {
  const q = opts.query ?? "";
  let out = rows.filter((r) => itemMatchesQuery(r, q));
  out = filterPantryRows(out, opts.filter ?? "all");
  out = sortPantryRows(out, opts.sort ?? "name");
  return out;
}

export function storageLabel(storage: StorageKey): string {
  if (storage === "fridge") return "Fridge";
  if (storage === "freezer") return "Freezer";
  return "Pantry";
}
