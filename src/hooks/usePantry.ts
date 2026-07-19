"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type {
  StorageKey,
  PantryItem,
  PantryItemsByStorage,
  ScannedItemInput,
  DetailsItemState,
  AddedBanner,
} from "@/types/pantry";

// ---------------------------------------------------------------------------
// Seed data + shelf-life helpers (pure; no React)
// ---------------------------------------------------------------------------

export const SEED: PantryItemsByStorage = {
  fridge: [
    { id: "1", name: "Whole milk", qty: 2, unit: "L", emoji: "🥛", daysLeft: 12, minStock: 2 },
    { id: "2", name: "Free-range eggs", qty: 8, unit: "pcs", emoji: "🥚", daysLeft: 19, minStock: 6 },
    { id: "3", name: "Greek yogurt", qty: 1, unit: "tub", emoji: "🥣", daysLeft: 2, minStock: 2 },
    { id: "4", name: "Cherry tomatoes", qty: 1, unit: "pack", emoji: "🍅", daysLeft: 5, minStock: 2 },
    { id: "5", name: "Aged cheddar", qty: 220, unit: "g", emoji: "🧀", daysLeft: 18, minStock: 150 },
    { id: "6", name: "Baby spinach", qty: 1, unit: "bag", emoji: "🥬", daysLeft: 1, minStock: 1 },
  ],
  freezer: [
    { id: "f1", name: "Chicken thighs", qty: 600, unit: "g", emoji: "🍗", daysLeft: 95, minStock: 1 },
  ],
  pantry: [],
};

export function getDefaultMinStock(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("milk") || lower.includes("yogurt")) return 2;
  if (lower.includes("egg")) return 6;
  if (lower.includes("cheese")) return 150;
  if (lower.includes("frozen") || lower.includes("chicken")) return 1;
  if (lower.includes("bread") || lower.includes("pasta")) return 1;
  if (lower.includes("oil")) return 1;
  if (
    lower.includes("tomato") ||
    lower.includes("spinach") ||
    lower.includes("avocado") ||
    lower.includes("herb")
  )
    return 1;
  return 2;
}

/** Realistic default fridge shelf life (days) for newly scanned / added items */
export function getDefaultDaysLeft(name: string, targetStorage: StorageKey = "fridge"): number {
  const lower = name.toLowerCase();
  const isFreezer = targetStorage === "freezer";

  // Meats / proteins
  if (lower.includes("chicken") || lower.includes("thigh") || lower.includes("breast")) {
    return isFreezer ? 120 + Math.floor(Math.random() * 30) : 4 + Math.floor(Math.random() * 2);
  }
  if (lower.includes("beef") || lower.includes("steak") || lower.includes("ground")) {
    return isFreezer ? 150 : 3 + Math.floor(Math.random() * 2);
  }
  if (lower.includes("fish") || lower.includes("salmon") || lower.includes("shrimp")) {
    return isFreezer ? 90 : 2 + Math.floor(Math.random() * 1);
  }

  // Dairy
  if (lower.includes("milk")) return isFreezer ? 90 : 12 + Math.floor(Math.random() * 4);
  if (lower.includes("yogurt") || lower.includes("greek"))
    return isFreezer ? 75 : 8 + Math.floor(Math.random() * 4);
  if (lower.includes("cheese") || lower.includes("cheddar"))
    return isFreezer ? 180 : 18 + Math.floor(Math.random() * 6);
  if (lower.includes("egg")) return isFreezer ? 180 : 18 + Math.floor(Math.random() * 6);

  // Produce
  if (
    lower.includes("spinach") ||
    lower.includes("lettuce") ||
    lower.includes("herb") ||
    lower.includes("basil")
  ) {
    return isFreezer ? 180 : 4 + Math.floor(Math.random() * 3);
  }
  if (lower.includes("tomato") || lower.includes("cherry"))
    return isFreezer ? 120 : 5 + Math.floor(Math.random() * 3);
  if (lower.includes("avocado")) return isFreezer ? 90 : 4 + Math.floor(Math.random() * 2);
  if (lower.includes("berry") || lower.includes("frozen"))
    return isFreezer ? 200 : 5 + Math.floor(Math.random() * 3);

  // Pantry staples
  if (lower.includes("bread")) return isFreezer ? 120 : 6 + Math.floor(Math.random() * 3);
  if (lower.includes("pasta") || lower.includes("rice")) return 45 + Math.floor(Math.random() * 15);
  if (lower.includes("oil")) return 120 + Math.floor(Math.random() * 30);

  const base = isFreezer ? 120 : 7 + Math.floor(Math.random() * 5);
  return Math.max(1, base);
}

/** Days to add to expiration when moving an item into the freezer */
export function getFreezerExtensionDays(name: string): number {
  const lower = name.toLowerCase();
  if (
    lower.includes("chicken") ||
    lower.includes("thigh") ||
    lower.includes("breast") ||
    lower.includes("beef") ||
    lower.includes("steak")
  ) {
    return 90;
  }
  if (lower.includes("fish") || lower.includes("salmon") || lower.includes("shrimp")) {
    return 75;
  }
  if (lower.includes("milk") || lower.includes("yogurt")) {
    return 60;
  }
  if (
    lower.includes("spinach") ||
    lower.includes("vegetable") ||
    lower.includes("berry") ||
    lower.includes("fruit") ||
    lower.includes("tomato")
  ) {
    return 180;
  }
  if (lower.includes("bread")) return 90;
  if (lower.includes("egg")) return 150;
  if (lower.includes("cheese")) return 120;
  return 90;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UsePantryOptions = {
  /** Optional family activity logger (user, action) */
  onActivity?: (user: string, action: string) => void;
};

export function usePantry(options: UsePantryOptions = {}) {
  const { onActivity } = options;

  const [active, setActive] = useState<StorageKey>("fridge");

  // Persist pantry to localStorage so the app works offline and shows cached data on reload
  const [items, setItems] = useState<PantryItemsByStorage>(() => {
    if (typeof window === "undefined") return SEED;
    try {
      const saved = localStorage.getItem("friggg-items");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && parsed.fridge) return parsed;
      }
    } catch {}
    return SEED;
  });

  useEffect(() => {
    try {
      localStorage.setItem("friggg-items", JSON.stringify(items));
    } catch {}
  }, [items]);

  const [detailsItem, setDetailsItem] = useState<DetailsItemState | null>(null);
  const [addedBanner, setAddedBanner] = useState<AddedBanner | null>(null);

  const current = items[active];

  const updateQty = useCallback(
    (id: string, delta: number) => {
      setItems((prev) => {
        const item = prev[active].find((i) => i.id === id);
        const newItems = prev[active]
          .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
          .filter((i) => i.qty > 0);
        if (item) {
          const verb = delta > 0 ? "added" : "used";
          onActivity?.("You", `${verb} ${Math.abs(delta)} ${item.unit} ${item.name}`);
        }
        return { ...prev, [active]: newItems };
      });
    },
    [active, onActivity]
  );

  const updateMinStock = useCallback((id: string, newMin: number) => {
    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(next) as StorageKey[]).forEach((storage) => {
        next[storage] = next[storage].map((i) =>
          i.id === id ? { ...i, minStock: Math.max(0, newMin) } : i
        );
      });
      return next;
    });
  }, []);

  const updateDaysLeft = useCallback((id: string, newDays: number) => {
    const clamped = Math.max(0, Math.floor(newDays));
    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(next) as StorageKey[]).forEach((storage) => {
        next[storage] = next[storage].map((i) =>
          i.id === id ? { ...i, daysLeft: clamped } : i
        );
      });
      return next;
    });
  }, []);

  /** Cross-storage qty update used by details drawer (keeps drawer state in sync) */
  const updateItemQty = useCallback(
    (id: string, delta: number) => {
      setItems((prev) => {
        const next = { ...prev };
        (Object.keys(next) as StorageKey[]).forEach((storage) => {
          next[storage] = next[storage]
            .map((i) => {
              if (i.id === id) {
                const newQty = Math.max(0, i.qty + delta);
                return { ...i, qty: newQty };
              }
              return i;
            })
            .filter((i) => i.qty > 0);
        });
        return next;
      });

      // Sync the open drawer preview (activity is logged via main card steppers)
      setDetailsItem((prev) => {
        if (!prev || prev.item.id !== id) return prev;
        const newQty = Math.max(0, prev.item.qty + delta);
        if (newQty <= 0) {
          setTimeout(() => setDetailsItem(null), 60);
          return null;
        }
        return { ...prev, item: { ...prev.item, qty: newQty } };
      });
    },
    []
  );

  /** Move item to a different storage; extend expiration when freezing */
  const moveItem = useCallback(
    (id: string, fromStorage: StorageKey, toStorage: StorageKey) => {
      if (fromStorage === toStorage) return;

      const sourceItem = items[fromStorage].find((i) => i.id === id);
      if (!sourceItem) return;

      const extension =
        toStorage === "freezer" && fromStorage !== "freezer"
          ? getFreezerExtensionDays(sourceItem.name)
          : 0;

      setItems((prev) => {
        const source = [...prev[fromStorage]];
        const idx = source.findIndex((i) => i.id === id);
        if (idx === -1) return prev;

        const item = { ...source[idx] };
        if (extension > 0) {
          item.daysLeft = item.daysLeft + extension;
        }

        source.splice(idx, 1);
        const target = [...prev[toStorage], item];

        return {
          ...prev,
          [fromStorage]: source,
          [toStorage]: target,
        };
      });

      setDetailsItem((prev) => (prev && prev.item.id === id ? null : prev));

      if (extension > 0) {
        toast.success(`Moved to Freezer`, {
          description: `Expiration extended by +${extension} days`,
        });
        onActivity?.("You", `moved ${sourceItem.name} to freezer`);
      } else {
        const dest =
          toStorage === "pantry" ? "Pantry" : toStorage === "freezer" ? "Freezer" : "Fridge";
        toast.success(`Moved to ${dest}`);
        onActivity?.("You", `moved ${sourceItem.name} to ${dest.toLowerCase()}`);
      }
    },
    [items, onActivity]
  );

  const moveToFreezer = useCallback(
    (id: string, fromStorage: StorageKey = "fridge") => {
      moveItem(id, fromStorage, "freezer");
    },
    [moveItem]
  );

  const openItemDetails = useCallback((item: PantryItem, storage: StorageKey) => {
    setDetailsItem({ item: { ...item }, storage });
  }, []);

  const closeItemDetails = useCallback(() => setDetailsItem(null), []);

  /** Core: add scanned items (can target any storage) */
  const addScannedItems = useCallback(
    (scanned: ScannedItemInput[], options: { silent?: boolean } = {}) => {
      if (scanned.length === 0) return;

      const newItemsByStorage: Partial<Record<StorageKey, PantryItem[]>> = {};

      scanned.forEach((s) => {
        const target = s.storage;
        const newItem: PantryItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: s.name,
          qty: s.qty,
          unit: s.unit,
          emoji: s.emoji,
          daysLeft: getDefaultDaysLeft(s.name, target),
          minStock: getDefaultMinStock(s.name),
        };

        if (!newItemsByStorage[target]) newItemsByStorage[target] = [];
        newItemsByStorage[target]!.push(newItem);
      });

      setItems((prev) => {
        const next = { ...prev };
        (Object.keys(newItemsByStorage) as StorageKey[]).forEach((storage) => {
          next[storage] = [...(next[storage] || []), ...(newItemsByStorage[storage] || [])];
        });
        return next;
      });

      if (!options.silent) {
        const storages = Array.from(new Set(scanned.map((s) => s.storage)));
        const storageLabel =
          storages.length === 1
            ? storages[0] === "fridge"
              ? "Fridge"
              : storages[0] === "freezer"
                ? "Freezer"
                : "Pantry"
            : "pantry";

        const count = scanned.length;
        const message = `Added ${count} item${count > 1 ? "s" : ""} to your ${storageLabel.toLowerCase()}`;
        setAddedBanner({ count, message });
        setTimeout(() => setAddedBanner(null), 5200);
      }

      const count = scanned.length;
      onActivity?.("You", `added ${count} item${count > 1 ? "s" : ""}`);
    },
    [onActivity]
  );

  const dismissBanner = useCallback(() => setAddedBanner(null), []);

  const expiringSoon = current.filter((i) => i.daysLeft <= 3).length;

  /** Global low stock count (items currently below their minStock) */
  const lowStockCount = (["fridge", "freezer", "pantry"] as StorageKey[]).reduce((sum, s) => {
    return sum + items[s].filter((i) => i.qty < (i.minStock ?? 2)).length;
  }, 0);

  return {
    // State
    active,
    setActive,
    items,
    setItems,
    current,
    detailsItem,
    setDetailsItem,
    addedBanner,
    setAddedBanner,

    // Derived
    expiringSoon,
    lowStockCount,

    // Actions
    updateQty,
    updateMinStock,
    updateDaysLeft,
    updateItemQty,
    moveItem,
    moveToFreezer,
    openItemDetails,
    closeItemDetails,
    addScannedItems,
    dismissBanner,
  };
}

export type UsePantryReturn = ReturnType<typeof usePantry>;
