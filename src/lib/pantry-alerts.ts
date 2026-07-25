/**
 * Pure helpers for header alert rows (expiring + low stock).
 */

import type { PantryItemsByStorage, StorageKey } from "@/types/pantry";

export type AlertRow = {
  id: string;
  emoji: string;
  name: string;
  reason: string;
  storage: StorageKey;
};

export function buildAlertItems(items: PantryItemsByStorage): AlertRow[] {
  const rows: AlertRow[] = [];
  (["fridge", "freezer", "pantry"] as StorageKey[]).forEach((storage) => {
    items[storage].forEach((item) => {
      if (item.daysLeft <= 3) {
        rows.push({
          id: `${item.id}-exp`,
          emoji: item.emoji,
          name: item.name,
          reason:
            item.daysLeft <= 0
              ? "Expired"
              : item.daysLeft === 1
                ? "Use today"
                : `${item.daysLeft}d left`,
          storage,
        });
      } else if (item.qty < (item.minStock ?? 2)) {
        rows.push({
          id: `${item.id}-low`,
          emoji: item.emoji,
          name: item.name,
          reason: `Low stock (${item.qty} ${item.unit})`,
          storage,
        });
      }
    });
  });
  return rows;
}
