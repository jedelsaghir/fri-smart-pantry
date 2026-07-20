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
import { applyIncomingToStorage, applyPriceToMatchingItems } from "@/lib/pantry-ops";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { defaultPriceUnit as priceUnitFromUnit, estimateLinePrice } from "@/lib/receipts";

// Re-export for existing imports from usePantry
export function defaultPriceUnit(unit: string): string {
  return priceUnitFromUnit(unit);
}

// ---------------------------------------------------------------------------
// Empty defaults + shelf-life helpers (pure; no React)
// ---------------------------------------------------------------------------

/** Empty pantry — never auto-fill demo groceries */
export const EMPTY_PANTRY: PantryItemsByStorage = {
  fridge: [],
  freezer: [],
  pantry: [],
};

/** @deprecated Legacy name; same as EMPTY_PANTRY (no demo seed). */
export const SEED = EMPTY_PANTRY;

/** Old demo item ids — stripped once so existing installs lose bogus stock */
const LEGACY_SEED_ITEM_IDS = new Set(["1", "2", "3", "4", "5", "6", "f1"]);

function stripLegacySeedItems(data: PantryItemsByStorage): PantryItemsByStorage {
  const clean = (list: PantryItem[] | undefined) =>
    (list || []).filter((item) => !LEGACY_SEED_ITEM_IDS.has(item.id));
  return {
    fridge: clean(data.fridge),
    freezer: clean(data.freezer),
    pantry: clean(data.pantry),
  };
}

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
    if (typeof window === "undefined") return EMPTY_PANTRY;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ITEMS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.fridge)) {
          const cleaned = stripLegacySeedItems(parsed as PantryItemsByStorage);
          try {
            localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(cleaned));
          } catch {}
          return cleaned;
        }
      }
    } catch {}
    return EMPTY_PANTRY;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    } catch {}
  }, [items]);

  const [detailsItem, setDetailsItem] = useState<DetailsItemState | null>(null);
  const [addedBanner, setAddedBanner] = useState<AddedBanner | null>(null);

  const current = items[active];

  /**
   * Patch any fields on an item across all storages and keep the open
   * details drawer in sync (live save).
   * Qty is clamped to ≥ 1 — removal must go through removeItem + confirm (P0-1).
   */
  const patchItem = useCallback((id: string, patch: Partial<PantryItem>) => {
    const normalized: Partial<PantryItem> = { ...patch };
    if (typeof normalized.qty === "number") {
      // Never auto-delete via qty; keep at least 1. Use removeItem to delete.
      normalized.qty = Math.max(1, Math.floor(normalized.qty));
    }
    if (typeof normalized.minStock === "number") {
      normalized.minStock = Math.max(0, normalized.minStock);
    }
    if (typeof normalized.daysLeft === "number") {
      normalized.daysLeft = Math.max(0, Math.floor(normalized.daysLeft));
    }
    if (typeof normalized.latestPrice === "number") {
      normalized.latestPrice = Math.max(0, Math.round(normalized.latestPrice * 100) / 100);
    }
    if (typeof normalized.name === "string") {
      const trimmed = normalized.name.trim();
      if (!trimmed) {
        // Don't allow empty names — drop the name patch
        delete normalized.name;
      } else {
        normalized.name = trimmed;
      }
    }

    const apply = (item: PantryItem): PantryItem => {
      const next = { ...item, ...normalized };
      // Allow explicitly clearing optional price
      if ("latestPrice" in patch && patch.latestPrice === undefined) {
        delete next.latestPrice;
      }
      return next;
    };

    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(next) as StorageKey[]).forEach((storage) => {
        next[storage] = next[storage].map((i) => (i.id === id ? apply(i) : i));
      });
      return next;
    });

    setDetailsItem((prev) => {
      if (!prev || prev.item.id !== id) return prev;
      return { ...prev, item: apply(prev.item) };
    });
  }, []);

  /**
   * Remove an item from pantry. Returns a snapshot for Undo restore.
   * Closes the details drawer if that item was open.
   */
  const removeItem = useCallback(
    (id: string): { item: PantryItem; storage: StorageKey } | null => {
      let snapshot: { item: PantryItem; storage: StorageKey } | null = null;

      for (const storage of Object.keys(items) as StorageKey[]) {
        const found = items[storage].find((i) => i.id === id);
        if (found) {
          snapshot = { item: { ...found }, storage };
          break;
        }
      }

      if (!snapshot) return null;

      const { storage: fromStorage } = snapshot;
      setItems((prev) => ({
        ...prev,
        [fromStorage]: prev[fromStorage].filter((i) => i.id !== id),
      }));

      setDetailsItem((prev) => (prev && prev.item.id === id ? null : prev));
      onActivity?.("You", `removed ${snapshot.item.name}`);
      return snapshot;
    },
    [items, onActivity]
  );

  /** Restore a previously removed item (Undo). */
  const restoreItem = useCallback((item: PantryItem, storage: StorageKey) => {
    setItems((prev) => {
      if (prev[storage].some((i) => i.id === item.id)) return prev;
      return {
        ...prev,
        [storage]: [...prev[storage], item],
      };
    });
  }, []);

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

  const openItemDetails = useCallback((item: PantryItem, storage: StorageKey) => {
    setDetailsItem({ item: { ...item }, storage });
  }, []);

  const closeItemDetails = useCallback(() => setDetailsItem(null), []);

  /**
   * Core: add scanned items (can target any storage).
   * P1-1: merge qty when name+unit match in same storage.
   * P1-8: set latestPrice on matching items.
   */
  const addScannedItems = useCallback(
    (scanned: ScannedItemInput[], options: { silent?: boolean } = {}) => {
      if (scanned.length === 0) return;

      setItems((prev) => {
        let next = { ...prev };
        scanned.forEach((s, index) => {
          const target = s.storage;
          // Prefer real OCR line price; only estimate when OCR had no price
          const lineTotal =
            typeof s.price === "number" && Number.isFinite(s.price) && s.price > 0
              ? s.price
              : estimateLinePrice(s.name, s.qty);
          const latestPrice =
            s.unit === "g" || s.unit === "kg" || s.unit === "ml"
              ? Math.round((lineTotal / Math.max(1, s.qty / 100)) * 100) / 100
              : Math.round((lineTotal / Math.max(1, s.qty)) * 100) / 100;
          const newItem: PantryItem = {
            id: `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            name: s.name,
            qty: s.qty,
            unit: s.unit,
            emoji: s.emoji,
            daysLeft: getDefaultDaysLeft(s.name, target),
            minStock: getDefaultMinStock(s.name),
            latestPrice,
            priceUnit: defaultPriceUnit(s.unit),
          };
          next = applyIncomingToStorage(next, target, newItem, { mergePrice: true });
          next = applyPriceToMatchingItems(
            next,
            { name: s.name, unit: s.unit },
            latestPrice,
            defaultPriceUnit(s.unit)
          );
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
    addedBanner,
    setAddedBanner,

    // Derived
    expiringSoon,
    lowStockCount,

    // Actions
    patchItem,
    removeItem,
    restoreItem,
    moveItem,
    openItemDetails,
    closeItemDetails,
    addScannedItems,
    dismissBanner,
  };
}

export type UsePantryReturn = ReturnType<typeof usePantry>;
