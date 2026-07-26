"use client";

import { useMemo, useState } from "react";
import type { PantryItem, StorageKey } from "@/types/pantry";
import { ItemCard } from "./ItemCard";

/** Soft window for large pantries (M-16) — avoids mounting hundreds of cards at once. */
const WINDOW = 48;

export function PantryItemList({
  items,
  storage,
  onOpenDetails,
  onDelete,
}: {
  items: PantryItem[];
  storage: StorageKey;
  onOpenDetails: (item: PantryItem, storage: StorageKey) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(
    () =>
      [...items].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        })
      ),
    [items]
  );
  const visible = expanded || sorted.length <= WINDOW ? sorted : sorted.slice(0, WINDOW);
  const hidden = Math.max(0, sorted.length - visible.length);

  return (
    <div className="mt-5 flex flex-col gap-4" style={{ width: "100%" }}>
      {visible.map((item) => (
        <div key={item.id} className="w-full" style={{ width: "100%" }}>
          <ItemCard
            item={item}
            storage={storage}
            onOpenDetails={() => onOpenDetails(item, storage)}
            onDelete={() => onDelete(item.id)}
          />
        </div>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full rounded-2xl border border-border/50 bg-secondary/40 py-3 text-sm font-semibold text-muted-foreground active:bg-secondary/70"
        >
          Show {hidden} more item{hidden === 1 ? "" : "s"}
        </button>
      )}
      {expanded && sorted.length > WINDOW && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-full py-2 text-xs font-medium text-muted-foreground"
        >
          Show fewer
        </button>
      )}
    </div>
  );
}
