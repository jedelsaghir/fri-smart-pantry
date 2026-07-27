"use client";

import { useMemo, useState } from "react";
import type { PantryItem, StorageKey } from "@/types/pantry";
import { ItemCard } from "./ItemCard";
import type { PantryListRow } from "@/lib/pantry-list";

/** Soft window for large pantries (M-16) — avoids mounting hundreds of cards at once. */
const WINDOW = 48;

export function PantryItemList({
  items,
  storage,
  onOpenDetails,
  onDelete,
  /** Pre-built rows (search-all mode) — when set, `items`+`storage` are ignored for identity */
  rows,
  selectMode = false,
  selectedIds,
  onToggleSelect,
  onLongPressSelect,
  showStoragePill = false,
}: {
  items?: PantryItem[];
  storage?: StorageKey;
  onOpenDetails: (item: PantryItem, storage: StorageKey) => void;
  onDelete: (id: string) => void;
  rows?: PantryListRow[];
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onLongPressSelect?: (id: string) => void;
  showStoragePill?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const list: PantryListRow[] = useMemo(() => {
    if (rows) return rows;
    const st = storage || "fridge";
    return (items || []).map((i) => ({ ...i, storage: st }));
  }, [rows, items, storage]);

  const visible = expanded || list.length <= WINDOW ? list : list.slice(0, WINDOW);
  const hidden = Math.max(0, list.length - visible.length);

  return (
    <div className="mt-5 flex flex-col gap-4" style={{ width: "100%" }} role="list">
      {visible.map((item) => (
        <div key={`${item.storage}-${item.id}`} className="w-full" style={{ width: "100%" }}>
          <ItemCard
            item={item}
            storage={item.storage}
            showStoragePill={showStoragePill}
            selectMode={selectMode}
            selected={selectedIds?.has(item.id) ?? false}
            onToggleSelect={() => onToggleSelect?.(item.id)}
            onLongPressSelect={() => onLongPressSelect?.(item.id)}
            onOpenDetails={() => onOpenDetails(item, item.storage)}
            onDelete={selectMode ? undefined : () => onDelete(item.id)}
          />
        </div>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-11 w-full rounded-2xl border border-border/50 bg-secondary/40 py-3 text-sm font-semibold text-muted-foreground active:bg-secondary/70"
        >
          Show {hidden} more item{hidden === 1 ? "" : "s"}
        </button>
      )}
      {expanded && list.length > WINDOW && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="min-h-11 w-full py-2 text-xs font-medium text-muted-foreground"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
