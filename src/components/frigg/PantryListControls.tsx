"use client";

import { Search, X, ArrowUpDown, CheckSquare } from "lucide-react";
import type { PantryFilterMode, PantrySortMode } from "@/lib/pantry-list";

const SORT_OPTIONS: { id: PantrySortMode; label: string }[] = [
  { id: "name", label: "Name A–Z" },
  { id: "expiry", label: "Expiry" },
  { id: "qty", label: "Qty low" },
];

const FILTER_OPTIONS: { id: PantryFilterMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "expiring", label: "Expiring" },
  { id: "low_stock", label: "Low stock" },
];

/**
 * Sticky search + sort + filter chips for pantry list.
 * ≥44px touch targets; elevated-card styling.
 */
export function PantryListControls({
  query,
  onQueryChange,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  selectMode,
  onToggleSelectMode,
  resultCount,
  searchingAll,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  sort: PantrySortMode;
  onSortChange: (s: PantrySortMode) => void;
  filter: PantryFilterMode;
  onFilterChange: (f: PantryFilterMode) => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
  resultCount?: number;
  searchingAll?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-1 space-y-2.5 bg-background/90 px-1 pb-2 pt-1 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="elevated-card relative flex min-h-11 flex-1 items-center gap-2 rounded-2xl px-3 ring-1 ring-border/40">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={searchingAll ? "Search all storage…" : "Search pantry…"}
            aria-label="Search pantry"
            className="min-h-11 w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-muted-foreground/70"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-secondary"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleSelectMode}
          aria-pressed={selectMode}
          aria-label={selectMode ? "Exit select mode" : "Select items"}
          className={
            "grid size-11 shrink-0 place-items-center rounded-2xl border transition " +
            (selectMode
              ? "border-brand bg-brand text-brand-foreground"
              : "border-border/50 bg-card text-foreground active:bg-secondary")
          }
        >
          <CheckSquare className="size-4" strokeWidth={2.25} />
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
          <ArrowUpDown className="size-3.5" aria-hidden />
          Sort
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSortChange(opt.id)}
            className={
              "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition " +
              (sort === opt.id
                ? "bg-brand text-brand-foreground"
                : "bg-secondary/70 text-muted-foreground active:bg-secondary")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onFilterChange(opt.id)}
            className={
              "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition " +
              (filter === opt.id
                ? "bg-secondary text-foreground ring-1 ring-border/60"
                : "bg-secondary/40 text-muted-foreground active:bg-secondary/70")
            }
          >
            {opt.label}
          </button>
        ))}
        {typeof resultCount === "number" && (query.trim() || filter !== "all") && (
          <span className="ml-auto shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            {resultCount} found
          </span>
        )}
      </div>
    </div>
  );
}
