import type { ShoppingListItem } from "@/types/pantry";
import { sameProduct } from "@/lib/pantry-ops";
import { mergeQuantities } from "@/lib/units";

/** Add or merge qty into shopping list by name+compatible unit (g↔kg, ml↔L). */
export function upsertShoppingListItem(
  list: ShoppingListItem[],
  incoming: Omit<ShoppingListItem, "id" | "checked"> & { id?: string; checked?: boolean }
): ShoppingListItem[] {
  const idx = list.findIndex((i) => sameProduct(i, incoming));
  if (idx >= 0) {
    const next = [...list];
    const merged = mergeQuantities(next[idx].qty, next[idx].unit, incoming.qty, incoming.unit);
    next[idx] = {
      ...next[idx],
      qty: merged ? merged.qty : next[idx].qty + Math.max(0, incoming.qty),
      unit: merged ? merged.unit : next[idx].unit,
      emoji: next[idx].emoji || incoming.emoji,
    };
    return next;
  }
  return [
    ...list,
    {
      id: incoming.id || `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: incoming.name,
      qty: Math.max(0, incoming.qty) || 1,
      unit: incoming.unit,
      emoji: incoming.emoji,
      checked: incoming.checked ?? false,
    },
  ];
}
