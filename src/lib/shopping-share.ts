/**
 * Build plain-text shopping list for WhatsApp / share sheets.
 */

import type { ShoppingListItem } from "@/types/pantry";

export type ShareListMode = "unchecked" | "all";

/** Prefer unchecked items; fall back to full list if everything is checked. */
export function shoppingListShareLines(
  list: ShoppingListItem[],
  mode: ShareListMode = "unchecked"
): string[] {
  const source =
    mode === "all"
      ? list
      : list.filter((i) => !i.checked).length > 0
        ? list.filter((i) => !i.checked)
        : list;

  return source.map((item) => {
    const mark = item.checked ? "☑" : "☐";
    const emoji = item.emoji ? `${item.emoji} ` : "";
    return `${mark} ${emoji}${item.name} — ${item.qty} ${item.unit}`.trim();
  });
}

export function buildShoppingListShareText(
  list: ShoppingListItem[],
  mode: ShareListMode = "unchecked"
): string {
  const lines = shoppingListShareLines(list, mode);
  if (lines.length === 0) return "🛒 Shopping list is empty";
  return `🛒 Shopping list\n\n${lines.join("\n")}\n\n— Friġġ`;
}

/** WhatsApp share URL (opens app / web). */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
