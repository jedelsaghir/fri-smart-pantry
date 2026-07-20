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

/** Match recipe/shopping names to pantry (name only, normalized) */
export function namesMatchLoose(a: string, b: string): boolean {
  return normalizeItemName(a) === normalizeItemName(b);
}

/**
 * Deduct ingredient qty from first matching pantry rows (R-1/R-4).
 * Returns names deducted and next state. Items at 0 are removed (after cook confirm).
 */
export function deductIngredients(
  prev: PantryItemsByStorage,
  ingredients: Array<{ name: string; qty: number; unit?: string }>
): { next: PantryItemsByStorage; used: string[] } {
  const next: PantryItemsByStorage = {
    fridge: [...prev.fridge],
    freezer: [...prev.freezer],
    pantry: [...prev.pantry],
  };
  const used: string[] = [];

  for (const ing of ingredients) {
    let remaining = ing.qty;
    for (const storage of Object.keys(next) as StorageKey[]) {
      if (remaining <= 0) break;
      next[storage] = next[storage].map((item) => {
        if (remaining <= 0) return item;
        if (!namesMatchLoose(item.name, ing.name)) return item;
        if (ing.unit && item.unit.trim().toLowerCase() !== ing.unit.trim().toLowerCase()) {
          // unit mismatch: still allow name-only deduct for recipes with loose units
        }
        const take = Math.min(item.qty, remaining);
        if (take <= 0) return item;
        remaining -= take;
        if (!used.includes(item.name)) used.push(item.name);
        return { ...item, qty: item.qty - take };
      });
      // drop zeros after each ingredient pass per storage
      next[storage] = next[storage].filter((i) => i.qty > 0);
    }
  }

  return { next, used };
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
