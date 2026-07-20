"use client";

import type { CatalogItem, ShoppingListItem } from "@/types/pantry";
import { ItemDatabaseSection } from "./ItemDatabaseSection";
import type { CatalogMergeGroup } from "@/types/pantry";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function ShoppingListView({
  shoppingList,
  listCount,
  checkedCount,
  suggestedCount,
  catalog,
  mergeGroups,
  onExport,
  onRegenerate,
  onUpdateQty,
  onToggle,
  onMarkPurchased,
  onClear,
  onAddFromCatalog,
  onAddManualToList,
  onCatalogAdd,
  onCatalogUpdate,
  onCatalogRemove,
  onCatalogMerge,
  onCatalogRequestDelete,
}: {
  shoppingList: ShoppingListItem[];
  listCount: number;
  checkedCount: number;
  suggestedCount: number;
  catalog: CatalogItem[];
  mergeGroups: CatalogMergeGroup[];
  onExport: () => void;
  onRegenerate: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onToggle: (id: string) => void;
  onMarkPurchased: () => void;
  onClear: () => void;
  onAddFromCatalog: (item: CatalogItem) => void;
  onAddManualToList: (name: string, unit: string, emoji: string, qty: number) => void;
  onCatalogAdd: (input: { name: string; unit: string; emoji: string }) => void;
  onCatalogUpdate: (id: string, patch: Partial<CatalogItem>) => void;
  onCatalogRemove: (id: string) => void;
  onCatalogMerge: (group: CatalogMergeGroup, primaryId: string) => void;
  onCatalogRequestDelete: (item: CatalogItem) => void;
}) {
  const [showPick, setShowPick] = useState(false);
  const [pickQuery, setPickQuery] = useState("");

  const filteredCatalog = catalog.filter((c) =>
    c.name.toLowerCase().includes(pickQuery.trim().toLowerCase())
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-sm text-muted-foreground">Shopping List</div>
          <div className="font-display text-[28px] leading-tight font-medium tracking-[-0.015em]">
            {listCount} item{listCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            className="rounded-2xl border px-3.5 py-2 text-sm font-semibold active:bg-secondary/60 transition"
          >
            Share
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
          >
            Regenerate
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowPick((v) => !v)}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-3xl border border-border/60 bg-card py-3 text-sm font-semibold active:bg-secondary/50 transition"
      >
        <Plus className="size-4" />
        Add from Database
      </button>

      {showPick && (
        <div className="elevated-card mb-4 space-y-2 rounded-3xl p-3">
          <Input
            value={pickQuery}
            onChange={(e) => setPickQuery(e.target.value)}
            placeholder="Search Database…"
            className="h-10 rounded-2xl"
          />
          <ul className="max-h-48 overflow-y-auto space-y-1">
            {filteredCatalog.slice(0, 20).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAddFromCatalog(c);
                    setShowPick(false);
                    setPickQuery("");
                  }}
                  className="flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left active:bg-secondary/70"
                >
                  <span className="text-xl">{c.emoji}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                  <span className="text-[11px] text-muted-foreground">{c.unit}</span>
                </button>
              </li>
            ))}
            {filteredCatalog.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                No matches — add items in Database below.
              </li>
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              const n = pickQuery.trim();
              if (!n) return;
              onAddManualToList(n, "pcs", "🛒", 1);
              setShowPick(false);
              setPickQuery("");
            }}
            disabled={!pickQuery.trim()}
            className="w-full rounded-2xl border py-2 text-xs font-semibold disabled:opacity-40"
          >
            Add “{pickQuery.trim() || "…"}” as new list item
          </button>
        </div>
      )}

      {shoppingList.length === 0 ? (
        <div className="mt-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-secondary/70 text-3xl">
            🛒
          </div>
          <p className="mt-4 font-display text-xl text-foreground">Your list is empty</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-[240px] mx-auto">
            Generate from pantry needs, or add from Database.
          </p>
          <button
            type="button"
            onClick={onRegenerate}
            className="mt-6 w-full flex items-center justify-center gap-2 rounded-3xl bg-[color-mix(in_oklab,var(--color-brand)_8%,var(--color-card))] border border-[color-mix(in_oklab,var(--color-brand)_25%,transparent)] py-3 text-sm font-semibold text-foreground active:scale-[0.985] transition"
          >
            🛒 Generate Shopping List
            {suggestedCount > 0 && (
              <span className="ml-1 rounded-full bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] px-2 py-px text-[11px] font-bold tabular-nums">
                {suggestedCount}
              </span>
            )}
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-3 mt-2">
            {shoppingList.map((item) => (
              <li
                key={item.id}
                className="elevated-card flex items-center gap-4 rounded-3xl px-4 py-4"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                  {item.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[15px] tracking-[-0.01em]">{item.name}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Buy {item.qty} {item.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-full bg-secondary/70 p-0.5">
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, -1)}
                      className="touch-target grid size-8 place-items-center rounded-full active:bg-background/60"
                    >
                      –
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQty(item.id, +1)}
                      className="touch-target grid size-8 place-items-center rounded-full active:bg-background/60"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className={`touch-target grid size-9 place-items-center rounded-2xl border text-lg transition ${
                      item.checked
                        ? "bg-brand text-brand-foreground border-brand"
                        : "bg-card border-border/60"
                    }`}
                    aria-label={item.checked ? "Uncheck" : "Check off"}
                  >
                    {item.checked ? "✓" : ""}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onMarkPurchased}
              disabled={checkedCount === 0}
              className="flex-1 rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] disabled:opacity-50 transition"
            >
              Mark {checkedCount || ""} as purchased
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-3xl border px-4 py-3.5 text-sm font-medium active:bg-secondary/60"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onExport}
              className="rounded-3xl border px-4 py-3.5 text-sm font-medium active:bg-secondary/60"
              aria-label="Share shopping list"
            >
              Share
            </button>
          </div>
        </>
      )}

      <ItemDatabaseSection
        catalog={catalog}
        mergeGroups={mergeGroups}
        onAdd={onCatalogAdd}
        onUpdate={onCatalogUpdate}
        onRemove={onCatalogRemove}
        onMerge={onCatalogMerge}
        onRequestDelete={onCatalogRequestDelete}
      />
    </>
  );
}
