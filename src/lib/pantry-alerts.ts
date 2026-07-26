/**
 * Pure helpers for header alert rows (expiring + low stock).
 */

import type { PantryItemsByStorage, StorageKey } from "@/types/pantry";
import { alertReasonForDaysLeft, isExpiringSoon } from "@/lib/item-status";

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
      if (isExpiringSoon(item.daysLeft)) {
        rows.push({
          id: `${item.id}-exp`,
          emoji: item.emoji,
          name: item.name,
          reason: alertReasonForDaysLeft(item.daysLeft),
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
