"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import type {
  PantryItemsByStorage,
  ShoppingListItem,
  StorageKey,
} from "@/types/pantry";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { applyIncomingToStorage, sameProduct } from "@/lib/pantry-ops";
import { upsertShoppingListItem } from "@/lib/shopping";
import {
  getDefaultDaysLeft,
  getDefaultMinStock,
} from "@/hooks/usePantry";

type UseShoppingListOptions = {
  items: PantryItemsByStorage;
  setItems: Dispatch<SetStateAction<PantryItemsByStorage>>;
  rememberPantryItem: (
    item: { name: string; unit: string; emoji: string; minStock: number },
    source?: "pantry_add" | "pantry_delete" | "scan" | "manual" | "merge"
  ) => void;
  addActivity: (user: string, action: string) => void;
  setAddedBanner: (banner: { count: number; message: string } | null) => void;
  onGenerated?: () => void;
};

/**
 * Shopping list persistence + generate / purchase / export actions.
 */
export function useShoppingList({
  items,
  setItems,
  rememberPantryItem,
  addActivity,
  setAddedBanner,
  onGenerated,
}: UseShoppingListOptions) {
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SHOPPING_LIST);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as ShoppingListItem[];
      }
    } catch {
      /* ignore */
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SHOPPING_LIST, JSON.stringify(shoppingList));
    } catch {
      /* ignore */
    }
  }, [shoppingList]);

  const computeSuggestedItems = useCallback((): ShoppingListItem[] => {
    const needed: ShoppingListItem[] = [];

    (["fridge", "freezer", "pantry"] as StorageKey[]).forEach((storage) => {
      items[storage].forEach((item) => {
        const min = item.minStock ?? 2;
        const isBelowMin = item.qty < min;
        const isRunningLow =
          item.daysLeft <= 2 && item.qty <= Math.max(1, Math.floor(min / 2));

        if (isBelowMin || isRunningLow) {
          const buyQty = Math.max(min - item.qty, 1);
          // M-10: merge by same product identity (name+unit), not name alone
          const existing = needed.find((n) =>
            sameProduct(n, { name: item.name, unit: item.unit })
          );
          if (existing) {
            existing.qty = Math.max(existing.qty, buyQty);
          } else {
            needed.push({
              id: `shop-${item.id}-${Date.now()}`,
              name: item.name,
              qty: buyQty,
              unit: item.unit,
              emoji: item.emoji,
              checked: false,
            });
          }
        }
      });
    });

    return needed;
  }, [items]);

  const suggestedCount = useMemo(
    () => computeSuggestedItems().length,
    [computeSuggestedItems]
  );

  const generateShoppingList = useCallback(() => {
    const needed = computeSuggestedItems();

    if (needed.length > 0) {
      setShoppingList(needed);
      onGenerated?.();
    } else {
      setAddedBanner({ count: 0, message: "Everything looks well stocked!" });
      setTimeout(() => setAddedBanner(null), 2800);
    }
  }, [computeSuggestedItems, onGenerated, setAddedBanner]);

  const toggleShoppingItem = useCallback((id: string) => {
    setShoppingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  }, []);

  const updateShoppingQty = useCallback((id: string, delta: number) => {
    setShoppingList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );
  }, []);

  const removeFromShoppingList = useCallback((id?: string) => {
    if (id) {
      setShoppingList((prev) => prev.filter((item) => item.id !== id));
    } else {
      setShoppingList((prev) => prev.filter((item) => !item.checked));
    }
  }, []);

  const markPurchased = useCallback(() => {
    const purchased = shoppingList.filter((i) => i.checked);
    if (purchased.length === 0) return;

    setItems((prev) => {
      let next = { ...prev };
      purchased.forEach((p) => {
        let merged = false;
        (Object.keys(next) as StorageKey[]).forEach((storage) => {
          const has = next[storage].some((item) => sameProduct(item, p));
          if (has) {
            next = {
              ...next,
              [storage]: next[storage].map((item) =>
                sameProduct(item, p) ? { ...item, qty: item.qty + p.qty } : item
              ),
            };
            merged = true;
          }
        });
        if (!merged) {
          const incoming = {
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: p.name,
            qty: p.qty,
            unit: p.unit,
            emoji: p.emoji,
            daysLeft: getDefaultDaysLeft(p.name, "fridge"),
            minStock: getDefaultMinStock(p.name),
          };
          next = applyIncomingToStorage(next, "fridge", incoming);
        }
      });
      return next;
    });

    setShoppingList((prev) => prev.filter((item) => !item.checked));

    purchased.forEach((p) => {
      rememberPantryItem(
        {
          name: p.name,
          unit: p.unit,
          emoji: p.emoji,
          minStock: getDefaultMinStock(p.name),
        },
        "pantry_add"
      );
    });

    setAddedBanner({
      count: purchased.length,
      message: `Added ${purchased.length} item${purchased.length > 1 ? "s" : ""} to your pantry`,
    });
    addActivity("You", `purchased ${purchased.length} item${purchased.length > 1 ? "s" : ""}`);
    setTimeout(() => setAddedBanner(null), 3200);
  }, [
    shoppingList,
    setItems,
    rememberPantryItem,
    addActivity,
    setAddedBanner,
  ]);

  const exportShoppingList = useCallback(async () => {
    if (shoppingList.length === 0) return;

    const listText = shoppingList
      .map((item) => `${item.checked ? "☑" : "☐"} ${item.qty} ${item.unit}  ${item.name}`)
      .join("\n");

    const fullText = `🛒 Shopping List\n\n${listText}\n\nGenerated by Friġġ`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Shopping List",
          text: fullText,
        });
      } else {
        await navigator.clipboard.writeText(fullText);
        toast.success("Copied to clipboard", {
          description: "Your shopping list is ready to paste anywhere.",
        });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(fullText);
        toast.success("Copied to clipboard", {
          description: "Your shopping list is ready to paste anywhere.",
        });
      } catch {
        toast.error("Couldn't share", { description: "Please try again." });
      }
    }
  }, [shoppingList]);

  const addFromCatalog = useCallback(
    (c: { id: string; name: string; unit: string; emoji: string }) => {
      setShoppingList((prev) =>
        upsertShoppingListItem(prev, {
          id: `shop-cat-${c.id}-${Date.now()}`,
          name: c.name,
          qty: 1,
          unit: c.unit,
          emoji: c.emoji,
        })
      );
      toast.success("Added to list", { description: c.name });
    },
    []
  );

  const addManualToList = useCallback(
    (name: string, unit: string, emoji: string, qty: number) => {
      setShoppingList((prev) =>
        upsertShoppingListItem(prev, {
          id: `shop-manual-${Date.now()}`,
          name,
          qty,
          unit,
          emoji,
        })
      );
      toast.success("Added to list", { description: name });
    },
    []
  );

  const listCount = shoppingList.length;
  const checkedCount = shoppingList.filter((i) => i.checked).length;

  return {
    shoppingList,
    setShoppingList,
    suggestedCount,
    listCount,
    checkedCount,
    generateShoppingList,
    toggleShoppingItem,
    updateShoppingQty,
    removeFromShoppingList,
    markPurchased,
    exportShoppingList,
    addFromCatalog,
    addManualToList,
  };
}
