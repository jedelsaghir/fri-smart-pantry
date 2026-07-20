import type { PantryItem, PantryItemsByStorage, StorageKey } from "@/types/pantry";
import { normalizeItemName } from "@/lib/catalog";

/** Same product identity: name + unit (case/space insensitive) */
export function sameProduct(a: { name: string; unit: string }, b: { name: string; unit: string }): boolean {
  return (
    normalizeItemName(a.name) === normalizeItemName(b.name) &&
    a.unit.trim().toLowerCase() === b.unit.trim().toLowerCase()
  );
}

/**
 * Add or merge qty into a storage bucket (P1-1).
 * Merges when name+unit match; optionally applies price fields.
 */
export function upsertPantryItem(
  list: PantryItem[],
  incoming: PantryItem,
  opts?: { mergePrice?: boolean }
): PantryItem[] {
  const idx = list.findIndex((i) => sameProduct(i, incoming));
  if (idx < 0) return [...list, incoming];
  const existing = list[idx];
  const next = [...list];
  next[idx] = {
    ...existing,
    qty: existing.qty + incoming.qty,
    emoji: existing.emoji || incoming.emoji,
    daysLeft: Math.min(existing.daysLeft, incoming.daysLeft),
    minStock: existing.minStock ?? incoming.minStock,
    latestPrice:
      opts?.mergePrice && incoming.latestPrice != null
        ? incoming.latestPrice
        : existing.latestPrice ?? incoming.latestPrice,
    priceUnit:
      opts?.mergePrice && incoming.priceUnit
        ? incoming.priceUnit
        : existing.priceUnit ?? incoming.priceUnit,
  };
  return next;
}

export function applyIncomingToStorage(
  prev: PantryItemsByStorage,
  storage: StorageKey,
  incoming: PantryItem,
  opts?: { mergePrice?: boolean }
): PantryItemsByStorage {
  return {
    ...prev,
    [storage]: upsertPantryItem(prev[storage], incoming, opts),
  };
}

/** Best-effort set latestPrice on matching pantry items (any storage) */
export function applyPriceToMatchingItems(
  prev: PantryItemsByStorage,
  match: { name: string; unit?: string },
  latestPrice: number,
  priceUnit?: string
): PantryItemsByStorage {
  const next = { ...prev };
  (Object.keys(next) as StorageKey[]).forEach((storage) => {
    next[storage] = next[storage].map((item) => {
      if (normalizeItemName(item.name) !== normalizeItemName(match.name)) return item;
      if (match.unit && item.unit.trim().toLowerCase() !== match.unit.trim().toLowerCase()) {
        return item;
      }
      return {
        ...item,
        latestPrice,
        priceUnit: priceUnit ?? item.priceUnit,
      };
    });
  });
  return next;
}
