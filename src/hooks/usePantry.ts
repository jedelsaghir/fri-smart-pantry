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
import {
  applyIncomingToStorage,
  applyPriceToMatchingItems,
  sameProduct,
} from "@/lib/pantry-ops";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { defaultPriceUnit as priceUnitFromUnit, estimateLinePrice } from "@/lib/receipts";
import { safeSetItem, stripLocalPhotosToFreeSpace } from "@/lib/storage-quota";

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

/** Old demo item ids — stripped once so existing installs lose bogus stock (N-17). */
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

/**
 * Deterministic default shelf life (days) — H-03: no Math.random().
 * Same name + storage always yields the same baseline so alerts stay stable.
 */
export function getDefaultDaysLeft(name: string, targetStorage: StorageKey = "fridge"): number {
  const lower = name.toLowerCase();
  const isFreezer = targetStorage === "freezer";
  const isPantry = targetStorage === "pantry";

  // Meats / proteins
  if (lower.includes("chicken") || lower.includes("thigh") || lower.includes("breast")) {
    return isFreezer ? 180 : 4;
  }
  if (lower.includes("beef") || lower.includes("steak") || lower.includes("ground")) {
    return isFreezer ? 150 : 3;
  }
  if (lower.includes("fish") || lower.includes("salmon") || lower.includes("shrimp")) {
    return isFreezer ? 90 : 2;
  }

  // Dairy
  if (lower.includes("milk")) return isFreezer ? 90 : 12;
  if (lower.includes("yogurt") || lower.includes("greek")) return isFreezer ? 75 : 10;
  if (lower.includes("cheese") || lower.includes("cheddar")) return isFreezer ? 180 : 21;
  if (lower.includes("egg")) return isFreezer ? 180 : 21;

  // Produce
  if (
    lower.includes("spinach") ||
    lower.includes("lettuce") ||
    lower.includes("herb") ||
    lower.includes("basil")
  ) {
    return isFreezer ? 180 : 5;
  }
  if (lower.includes("tomato") || lower.includes("cherry")) return isFreezer ? 120 : 6;
  if (lower.includes("avocado")) return isFreezer ? 90 : 4;
  if (lower.includes("berry") || lower.includes("frozen")) return isFreezer ? 200 : 5;

  // Pantry staples
  if (lower.includes("bread")) return isFreezer ? 120 : 6;
  if (lower.includes("pasta") || lower.includes("rice")) return isPantry || isFreezer ? 180 : 45;
  if (lower.includes("oil")) return 180;

  return isFreezer ? 120 : isPantry ? 90 : 7;
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
    const payload = JSON.stringify(items);
    const result = safeSetItem(STORAGE_KEYS.ITEMS, payload, {
      freeSpace: stripLocalPhotosToFreeSpace,
    });
    if (!result.ok && result.reason === "quota") {
      // Prefer pantry rows without label photos over failing entirely
      const strip = (list: PantryItem[]) =>
        list.map(({ labelPhotoDataUrl: _p, ...rest }) => rest);
      safeSetItem(
        STORAGE_KEYS.ITEMS,
        JSON.stringify({
          fridge: strip(items.fridge),
          freezer: strip(items.freezer),
          pantry: strip(items.pantry),
        })
      );
    }
  }, [items]);

  const [detailsItem, setDetailsItem] = useState<DetailsItemState | null>(null);
  const [addedBanner, setAddedBanner] = useState<AddedBanner | null>(null);

  const current = items[active];

  /**
   * Patch any fields on an item across all storages and keep the open
   * details drawer in sync (live save).
   * M-03: qty may be 0 (empty stock) without deleting; removal still uses removeItem + confirm.
   */
  const patchItem = useCallback((id: string, patch: Partial<PantryItem>) => {
    const normalized: Partial<PantryItem> = { ...patch };
    if (typeof normalized.qty === "number") {
      normalized.qty = Math.max(0, Math.floor(normalized.qty));
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

  /**
   * Move item between storages.
   * L-06: moving *into* freezer extends days; moving *out* of freezer reverses
   * the same heuristic extension (not a full shelf-life recalculation).
   */
  const moveItem = useCallback(
    (id: string, fromStorage: StorageKey, toStorage: StorageKey) => {
      if (fromStorage === toStorage) return;

      const sourceItem = items[fromStorage].find((i) => i.id === id);
      if (!sourceItem) return;

      const freezeExtension =
        toStorage === "freezer" && fromStorage !== "freezer"
          ? getFreezerExtensionDays(sourceItem.name)
          : 0;
      const unfreezeReduction =
        fromStorage === "freezer" && toStorage !== "freezer"
          ? getFreezerExtensionDays(sourceItem.name)
          : 0;

      setItems((prev) => {
        const source = [...prev[fromStorage]];
        const idx = source.findIndex((i) => i.id === id);
        if (idx === -1) return prev;

        const item = { ...source[idx] };
        if (freezeExtension > 0) {
          item.daysLeft = item.daysLeft + freezeExtension;
        } else if (unfreezeReduction > 0) {
          item.daysLeft = Math.max(0, item.daysLeft - unfreezeReduction);
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

      if (freezeExtension > 0) {
        toast.success(`Moved to Freezer`, {
          description: `Expiration extended by +${freezeExtension} days`,
        });
        onActivity?.("You", `moved ${sourceItem.name} to freezer`);
      } else if (unfreezeReduction > 0) {
        const dest =
          toStorage === "pantry" ? "Pantry" : toStorage === "freezer" ? "Freezer" : "Fridge";
        toast.success(`Moved to ${dest}`, {
          description: `Freezer extension reversed (−${unfreezeReduction} days)`,
        });
        onActivity?.("You", `moved ${sourceItem.name} to ${dest.toLowerCase()}`);
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
   * P1-1: merge qty when name+unit match in same storage (or explicit pantryMatch + disposition).
   * disposition:
   *   - merge (default with match): add scanned qty onto matched row
   *   - update: set matched row qty to scanned qty
   *   - add_new: always create a new row
   * P1-8: set latestPrice on matching items.
   */
  /**
   * Add scanned items. Returns pantry item ids touched (created or merged) in
   * the same order as `scanned` so expiry photos can attach by id (H-04).
   */
  const addScannedItems = useCallback(
    (
      scanned: ScannedItemInput[],
      options: { silent?: boolean } = {}
    ): Array<{ scanIndex: number; pantryItemId: string; storage: StorageKey }> => {
      if (scanned.length === 0) return [];

      let mergedCount = 0;
      let updatedCount = 0;
      let createdCount = 0;
      const results: Array<{ scanIndex: number; pantryItemId: string; storage: StorageKey }> =
        [];

      setItems((prev) => {
        let next: PantryItemsByStorage = {
          fridge: [...prev.fridge],
          freezer: [...prev.freezer],
          pantry: [...prev.pantry],
        };

        scanned.forEach((s, index) => {
          const target = s.storage;
          const lineTotal =
            typeof s.price === "number" && Number.isFinite(s.price) && s.price > 0
              ? s.price
              : estimateLinePrice(s.name, s.qty);
          const latestPrice =
            s.unit === "g" || s.unit === "kg" || s.unit === "ml"
              ? Math.round((lineTotal / Math.max(1, s.qty / 100)) * 100) / 100
              : Math.round((lineTotal / Math.max(1, s.qty)) * 100) / 100;
          const priceUnit = defaultPriceUnit(s.unit);

          const disposition = s.disposition ?? (s.pantryMatch ? "merge" : "add_new");
          const matchId = s.pantryMatch?.id;

          // Explicit merge / update against a known pantry row
          if ((disposition === "merge" || disposition === "update") && matchId) {
            let foundStorage: StorageKey | null = null;
            let foundItem: PantryItem | null = null;

            for (const st of ["fridge", "freezer", "pantry"] as StorageKey[]) {
              const hit = next[st].find((i) => i.id === matchId);
              if (hit) {
                foundStorage = st;
                foundItem = hit;
                break;
              }
            }

            if (foundItem && foundStorage) {
              const newQty =
                disposition === "update"
                  ? Math.max(0, s.qty)
                  : foundItem.qty + s.qty;

              const brand =
                (s.brand && s.brand.trim()) ||
                (foundItem.brand && foundItem.brand.trim()) ||
                undefined;
              const updated: PantryItem = {
                ...foundItem,
                qty: newQty,
                emoji: s.emoji || foundItem.emoji,
                latestPrice,
                priceUnit: priceUnit || foundItem.priceUnit,
                // Keep pantry name; scanned name may be noisier OCR text
                name: foundItem.name,
                unit: foundItem.unit,
                ...(brand ? { brand } : {}),
              };

              // Move to target storage if user changed it in review
              if (foundStorage !== target) {
                next = {
                  ...next,
                  [foundStorage]: next[foundStorage].filter((i) => i.id !== matchId),
                  [target]: [...next[target], { ...updated }],
                };
              } else {
                next = {
                  ...next,
                  [foundStorage]: next[foundStorage].map((i) =>
                    i.id === matchId ? updated : i
                  ),
                };
              }

              results.push({
                scanIndex: index,
                pantryItemId: matchId,
                storage: target,
              });
              if (disposition === "update") updatedCount += 1;
              else mergedCount += 1;

              next = applyPriceToMatchingItems(
                next,
                { name: updated.name, unit: updated.unit },
                latestPrice,
                priceUnit
              );
              return;
            }
          }

          // add_new or match not found → create / fuzzy upsert by name+unit
          const newItem: PantryItem = {
            id: `item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            name: s.name,
            qty: s.qty,
            unit: s.unit,
            emoji: s.emoji,
            daysLeft: getDefaultDaysLeft(s.name, target),
            minStock: getDefaultMinStock(s.name),
            latestPrice,
            priceUnit,
            ...(s.brand?.trim() ? { brand: s.brand.trim() } : {}),
          };

          if (disposition === "add_new") {
            // Force a distinct row even if name matches
            next = {
              ...next,
              [target]: [...next[target], newItem],
            };
            createdCount += 1;
            results.push({
              scanIndex: index,
              pantryItemId: newItem.id,
              storage: target,
            });
          } else {
            const beforeLen = next[target].length;
            next = applyIncomingToStorage(next, target, newItem, { mergePrice: true });
            if (next[target].length === beforeLen) {
              mergedCount += 1;
              // Merged into existing — find by name+unit
              const hit = next[target].find((i) => sameProduct(i, newItem));
              results.push({
                scanIndex: index,
                pantryItemId: hit?.id || newItem.id,
                storage: target,
              });
            } else {
              createdCount += 1;
              results.push({
                scanIndex: index,
                pantryItemId: newItem.id,
                storage: target,
              });
            }
          }

          next = applyPriceToMatchingItems(
            next,
            { name: s.name, unit: s.unit },
            latestPrice,
            priceUnit
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
      const activity =
        mergedCount + updatedCount > 0 && createdCount === 0
          ? `restocked ${mergedCount + updatedCount} item${mergedCount + updatedCount > 1 ? "s" : ""}`
          : mergedCount + updatedCount > 0
            ? `added ${createdCount}, restocked ${mergedCount + updatedCount}`
            : `added ${count} item${count > 1 ? "s" : ""}`;
      onActivity?.("You", activity);
      return results;
    },
    [onActivity]
  );

  const dismissBanner = useCallback(() => setAddedBanner(null), []);

  /**
   * Attach post-scan label photos / days-left.
   * H-04: prefer pantryItemId when present; fall back to name+unit+storage.
   */
  const applyExpirySignals = useCallback(
    (
      signals: Array<{
        pantryItemId?: string;
        name: string;
        unit: string;
        storage: StorageKey;
        labelPhotoDataUrl?: string;
        daysLeft?: number;
      }>
    ) => {
      if (!signals.length) return;
      setItems((prev) => {
        const next: PantryItemsByStorage = {
          fridge: [...prev.fridge],
          freezer: [...prev.freezer],
          pantry: [...prev.pantry],
        };

        for (const signal of signals) {
          const patch: Partial<PantryItem> = {};
          if (signal.labelPhotoDataUrl) {
            // L-25: drop oversized label photos rather than bloating local/sync
            const photo =
              signal.labelPhotoDataUrl.length <= 100_000
                ? signal.labelPhotoDataUrl
                : undefined;
            if (photo) {
              patch.labelPhotoDataUrl = photo;
              patch.labelPhotoAt = new Date().toISOString();
            }
          }
          if (typeof signal.daysLeft === "number" && Number.isFinite(signal.daysLeft)) {
            patch.daysLeft = Math.max(0, Math.floor(signal.daysLeft));
          }
          if (Object.keys(patch).length === 0) continue;

          let foundStorage: StorageKey | null = null;
          let idx = -1;

          if (signal.pantryItemId) {
            for (const st of ["fridge", "freezer", "pantry"] as StorageKey[]) {
              const i = next[st].findIndex((row) => row.id === signal.pantryItemId);
              if (i >= 0) {
                foundStorage = st;
                idx = i;
                break;
              }
            }
          }

          if (foundStorage == null) {
            const tryMatch = (list: PantryItem[]): number =>
              list.findIndex((i) => sameProduct(i, { name: signal.name, unit: signal.unit }));
            idx = tryMatch(next[signal.storage]);
            if (idx >= 0) foundStorage = signal.storage;
            else {
              for (const st of ["fridge", "freezer", "pantry"] as StorageKey[]) {
                idx = tryMatch(next[st]);
                if (idx >= 0) {
                  foundStorage = st;
                  break;
                }
              }
            }
          }

          if (foundStorage == null || idx < 0) continue;
          next[foundStorage] = next[foundStorage].map((item, i) =>
            i === idx ? { ...item, ...patch } : item
          );
        }
        return next;
      });
    },
    []
  );

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
    applyExpirySignals,
    dismissBanner,
  };
}

export type UsePantryReturn = ReturnType<typeof usePantry>;
