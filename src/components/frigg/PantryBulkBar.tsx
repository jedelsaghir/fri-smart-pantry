"use client";

import { Snowflake, Package, Trash2, X } from "lucide-react";
import type { StorageKey } from "@/types/pantry";

/** Bottom action bar when multi-select has ≥1 item selected. */
export function PantryBulkBar({
  count,
  total,
  onSelectAll,
  onClear,
  onMove,
  onDelete,
  onDone,
  showMoveSheet,
  onToggleMoveSheet,
}: {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  onMove: (to: StorageKey) => void;
  onDelete: () => void;
  onDone: () => void;
  showMoveSheet: boolean;
  onToggleMoveSheet: () => void;
}) {
  if (count < 1) {
    return (
      <div className="fixed inset-x-0 bottom-[max(5.25rem,calc(4.25rem+env(safe-area-inset-bottom)))] z-40 mx-auto max-w-md px-4">
        <div className="elevated-card flex items-center justify-between gap-2 rounded-2xl border border-border/50 px-3 py-2.5 shadow-lg">
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
    <div className="fixed inset-x-0 bottom-[max(5.25rem,calc(4.25rem+env(safe-area-inset-bottom)))] z-40 mx-auto max-w-md px-4">
      <div className="elevated-card space-y-2 rounded-3xl border border-border/50 p-3 shadow-[0_12px_40px_-12px_oklch(0.2_0.02_150/0.28)]">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-sm font-semibold tabular-nums">
            {count} selected
          </span>
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

        {showMoveSheet && (
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
                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-2xl bg-secondary/70 py-2 text-[11px] font-semibold active:bg-secondary"
              >
                <Icon className="size-4" strokeWidth={2.25} />
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleMoveSheet}
            className="min-h-11 flex-1 rounded-2xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground active:scale-[0.985]"
          >
            {showMoveSheet ? "Hide move" : "Move…"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-2xl border border-destructive/35 px-4 text-sm font-semibold text-destructive active:bg-destructive/10"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/** Lucide has no Fridge — use Package variant alias */
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
