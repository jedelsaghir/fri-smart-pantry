"use client";

import { Snowflake, Package, Trash2, X } from "lucide-react";
import type { StorageKey } from "@/types/pantry";

/**
 * Bottom action bar for multi-select.
 * When items are selected, Move destinations (Fridge / Freezer / Pantry) are
 * always visible — no extra tap to expand.
 */
export function PantryBulkBar({
  count,
  total,
  onSelectAll,
  onClear,
  onMove,
  onDelete,
  onDone,
}: {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  onMove: (to: StorageKey) => void;
  onDelete: () => void;
  onDone: () => void;
  /** @deprecated destinations are always shown when count ≥ 1 */
  showMoveSheet?: boolean;
  onToggleMoveSheet?: () => void;
}) {
  if (count < 1) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] z-50 mx-auto max-w-md px-4">
        <div className="pointer-events-auto elevated-card flex items-center justify-between gap-2 rounded-2xl border border-border/50 px-3 py-2.5 shadow-lg">
          <span className="text-sm font-medium text-muted-foreground">Select items</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="min-h-11 rounded-2xl bg-secondary px-3 text-xs font-semibold active:bg-secondary/80"
            >
              Select all ({total})
            </button>
            <button
              type="button"
              onClick={onDone}
              className="grid size-11 place-items-center rounded-2xl border active:bg-secondary"
              aria-label="Exit select"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] z-50 mx-auto max-w-md px-4">
      <div className="pointer-events-auto elevated-card space-y-2.5 rounded-3xl border border-border/50 p-3 shadow-[0_12px_40px_-12px_oklch(0.2_0.02_150/0.28)]">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-sm font-semibold tabular-nums">{count} selected</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onSelectAll}
              className="min-h-9 rounded-full bg-secondary/80 px-3 text-[11px] font-semibold active:bg-secondary"
            >
              All
            </button>
            <button
              type="button"
              onClick={onClear}
              className="min-h-9 rounded-full bg-secondary/80 px-3 text-[11px] font-semibold active:bg-secondary"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onDone}
              className="grid size-9 place-items-center rounded-full border active:bg-secondary"
              aria-label="Done selecting"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        <p className="px-0.5 text-[11px] font-medium text-muted-foreground">Move to</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { key: "fridge" as const, label: "Fridge", Icon: FridgeIcon },
              { key: "freezer" as const, label: "Freezer", Icon: Snowflake },
              { key: "pantry" as const, label: "Pantry", Icon: Package },
            ] as const
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onMove(key)}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl border border-brand/25 bg-[color-mix(in_oklab,var(--color-brand)_10%,var(--color-card))] py-2 text-[12px] font-semibold text-foreground active:scale-[0.98] active:bg-[color-mix(in_oklab,var(--color-brand)_18%,var(--color-card))]"
            >
              <Icon className="size-4" strokeWidth={2.25} />
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-destructive/35 px-4 text-sm font-semibold text-destructive active:bg-destructive/10"
        >
          <Trash2 className="size-4" />
          Delete selected
        </button>
      </div>
    </div>
  );
}

function FridgeIcon({ className, strokeWidth }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M5 10h14" />
      <path d="M9 6v2" />
      <path d="M9 14v2" />
    </svg>
  );
}
