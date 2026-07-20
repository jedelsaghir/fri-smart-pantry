import type { ShoppingListItem } from "@/types/pantry";
import { sameProduct } from "@/lib/pantry-ops";

/** Add or merge qty into shopping list by name+unit (N-4). */
export function upsertShoppingListItem(
  list: ShoppingListItem[],
  incoming: Omit<ShoppingListItem, "id" | "checked"> & { id?: string; checked?: boolean }
): ShoppingListItem[] {
  const idx = list.findIndex((i) => sameProduct(i, incoming));
  if (idx >= 0) {
    const next = [...list];
    next[idx] = {
      ...next[idx],
      qty: next[idx].qty + Math.max(1, incoming.qty),
      emoji: next[idx].emoji || incoming.emoji,
    };
    return next;
  }
  return [
    ...list,
    {
      id: incoming.id || `shop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: incoming.name,
      qty: Math.max(1, incoming.qty),
      unit: incoming.unit,
      emoji: incoming.emoji,
      checked: incoming.checked ?? false,
    },
  ];
}
