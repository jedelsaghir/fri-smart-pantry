"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogItem, CatalogMergeGroup, PantryItem } from "@/types/pantry";
import {
  createCatalogId,
  findMergeGroups,
  loadCatalog,
  mergeCatalogGroup,
  saveCatalog,
  searchCatalog,
  upsertCatalogFromPantryItem,
} from "@/lib/catalog";

export function useItemCatalog() {
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => loadCatalog());

  useEffect(() => {
    saveCatalog(catalog);
  }, [catalog]);

  const rememberPantryItem = useCallback(
    (
      item: Pick<PantryItem, "name" | "unit" | "emoji" | "minStock" | "latestPrice">,
      source: CatalogItem["source"] = "pantry_add"
    ) => {
      setCatalog((prev) => upsertCatalogFromPantryItem(prev, item, source));
    },
    []
  );

  const addCatalogItem = useCallback(
    (input: { name: string; unit?: string; emoji?: string; defaultMinStock?: number }) => {
      const name = input.name.trim();
      if (!name) return null;
      const entry: CatalogItem = {
        id: createCatalogId(),
        name,
        unit: input.unit?.trim() || "pcs",
        emoji: input.emoji?.trim() || "🛒",
        defaultMinStock: input.defaultMinStock,
        updatedAt: new Date().toISOString(),
        source: "manual",
      };
      setCatalog((prev) => {
        // Prefer upsert if same name exists
        return upsertCatalogFromPantryItem(
          prev,
          {
            name: entry.name,
            unit: entry.unit,
            emoji: entry.emoji,
            minStock: entry.defaultMinStock ?? 1,
            latestPrice: undefined,
          },
          "manual"
        );
      });
      return entry;
    },
    []
  );

  const updateCatalogItem = useCallback((id: string, patch: Partial<CatalogItem>) => {
    setCatalog((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              ...patch,
              name: patch.name?.trim() || c.name,
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );
  }, []);

  const removeCatalogItem = useCallback((id: string) => {
    setCatalog((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const mergeGroups = useMemo(() => findMergeGroups(catalog), [catalog]);

  const applyMerge = useCallback((group: CatalogMergeGroup, primaryId: string) => {
    setCatalog((prev) => {
      const primary = prev.find((c) => c.id === primaryId);
      const next = mergeCatalogGroup(prev, primaryId, group.memberIds);
      // L-18: cascade primary name onto matching pantry rows (same unit)
      if (primary && typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem("friggg-items");
          if (raw) {
            const items = JSON.parse(raw) as {
              fridge: Array<{ name: string; unit: string }>;
              freezer: Array<{ name: string; unit: string }>;
              pantry: Array<{ name: string; unit: string }>;
            };
            const aliases = new Set(
              group.memberIds
                .map((id) => prev.find((c) => c.id === id)?.name.toLowerCase())
                .filter(Boolean) as string[]
            );
            aliases.add(primary.name.toLowerCase());
            const rename = (list: typeof items.fridge) =>
              list.map((row) =>
                aliases.has(row.name.toLowerCase()) &&
                row.unit.toLowerCase() === primary.unit.toLowerCase()
                  ? { ...row, name: primary.name, emoji: primary.emoji || (row as { emoji?: string }).emoji }
                  : row
              );
            const updated = {
              fridge: rename(items.fridge || []),
              freezer: rename(items.freezer || []),
              pantry: rename(items.pantry || []),
            };
            localStorage.setItem("friggg-items", JSON.stringify(updated));
            window.dispatchEvent(new Event("frigg-catalog-cascaded"));
          }
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, []);

  const suggest = useCallback(
    (query: string, limit = 8) => searchCatalog(catalog, query, limit),
    [catalog]
  );

  const sorted = useMemo(
    () =>
      [...catalog].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
      ),
    [catalog]
  );

  return {
    catalog: sorted,
    rememberPantryItem,
    addCatalogItem,
    updateCatalogItem,
    removeCatalogItem,
    mergeGroups,
    applyMerge,
    suggest,
  };
}

export type UseItemCatalogReturn = ReturnType<typeof useItemCatalog>;
