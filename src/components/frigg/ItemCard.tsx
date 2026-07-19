"use client";

import { Minus, Plus } from "lucide-react";
import { useRef } from "react";
import type { PantryItem, ItemStatus, StorageKey } from "@/types/pantry";

export type { PantryItem, ItemStatus };

/** Compact status copy for dense cards */
function shortStatusLabel(label: string): string {
  if (label === "Expiring soon") return "Soon";
  if (label === "Use today") return "Today";
  return label;
}

export function ItemCard({
  item,
  storage,
  onInc,
  onDec,
  onUpdateMinStock,
  onUpdateDaysLeft,
  onOpenDetails,
}: {
  item: PantryItem;
  storage?: StorageKey;
  onInc: () => void;
  onDec: () => void;
  onUpdateMinStock?: (newMin: number) => void;
  onUpdateDaysLeft?: (newDays: number) => void;
  onOpenDetails?: () => void;
}) {
  const status = getStatus(item.daysLeft);
  const isLow = item.qty < item.minStock;

  // Long-press timer ref for opening details
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (e: React.PointerEvent) => {
    // Don't long-press from controls
    if ((e.target as HTMLElement).closest("button")) return;
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onOpenDetails?.();
      // Optional light haptic on supported devices
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, 520);
  };

  const endLongPress = () => {
    clearLongPress();
  };

  // Tap the main content (emoji + info) to open details drawer for expiration / move actions
  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent opening details when tapping the qty stepper or min controls
    if ((e.target as HTMLElement).closest("button")) return;
    // If a long-press just fired, suppress the click
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onOpenDetails?.();
  };

  return (
    <li
      className="elevated-card flex flex-col gap-3.5 rounded-[1.65rem] px-3.5 py-4 text-sm select-none"
      onPointerDown={startLongPress}
      onPointerUp={endLongPress}
      onPointerLeave={endLongPress}
      onPointerCancel={endLongPress}
    >
      {/* Header: larger emoji + name hierarchy + quiet status */}
      <div className="flex items-start gap-3 cursor-pointer" onClick={handleContentClick}>
        <div
          className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-[28px] leading-none shadow-[inset_0_1px_0_oklch(1_0_0_/_0.55)] ring-1 ring-border/25"
          aria-label={`View details for ${item.name}`}
        >
          {item.emoji}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[15px] font-semibold leading-snug tracking-[-0.02em] text-foreground">
            {item.name}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[-0.01em]"
              style={{
                backgroundColor: `color-mix(in oklab, ${status.color} 12%, var(--color-card))`,
                color: status.color,
                border: `1px solid color-mix(in oklab, ${status.color} 16%, transparent)`,
              }}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              {shortStatusLabel(status.label)}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {item.daysLeft}d left
            </span>
          </div>
        </div>
      </div>

      {/* Single neat metrics row: Qty + Min Stock */}
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-secondary/45 px-3 py-2 ring-1 ring-border/20">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Qty
          </p>
          <p className="mt-0.5 truncate text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-foreground">
            {item.qty}
            <span className="ml-1 font-medium text-muted-foreground">{item.unit}</span>
          </p>
        </div>

        <div className="h-8 w-px shrink-0 bg-border/50" aria-hidden />

        <div className="flex min-w-0 items-center gap-1.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Min
            </p>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-foreground">
              {item.minStock}
              {isLow && (
                <span className="ml-1.5 text-[10px] font-semibold text-[var(--color-soon)]">
                  Low
                </span>
              )}
            </p>
          </div>
          <div className="ml-0.5 flex items-center rounded-full bg-card/80 p-0.5 ring-1 ring-border/30">
            <button
              type="button"
              aria-label="Decrease min stock"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateMinStock?.(Math.max(0, item.minStock - 1));
              }}
              className="grid size-7 place-items-center rounded-full text-[13px] font-semibold text-foreground/65 active:bg-secondary/80 transition"
            >
              –
            </button>
            <button
              type="button"
              aria-label="Increase min stock"
              onClick={(e) => {
                e.stopPropagation();
                onUpdateMinStock?.(item.minStock + 1);
              }}
              className="grid size-7 place-items-center rounded-full text-[13px] font-semibold text-foreground/65 active:bg-secondary/80 transition"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Clean quantity stepper */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground tracking-[-0.01em]">
          Adjust stock
        </span>
        <div className="flex items-center gap-0.5 rounded-full bg-secondary/70 p-1 ring-1 ring-border/25">
          <button
            type="button"
            aria-label={`Decrease ${item.name}`}
            onClick={onDec}
            className="grid size-8 place-items-center rounded-full text-foreground/70 active:scale-[0.96] active:bg-background/55 transition-all"
          >
            <Minus className="size-3.5" strokeWidth={2.5} />
          </button>
          <span className="min-w-7 px-1 text-center text-[13px] font-semibold tabular-nums tracking-[-0.01em] text-foreground">
            {item.qty}
          </span>
          <button
            type="button"
            aria-label={`Increase ${item.name}`}
            onClick={onInc}
            className="grid size-8 place-items-center rounded-full bg-brand text-brand-foreground shadow-sm active:scale-[0.96] active:brightness-105 transition-all"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </li>
  );
}

function getStatus(daysLeft: number): ItemStatus {
  if (daysLeft <= 0) {
    return { label: "Expired", color: "var(--color-expiring)" };
  }
  if (daysLeft <= 1) {
    return { label: "Use today", color: "var(--color-expiring)" };
  }
  if (daysLeft <= 3) {
    return { label: "Expiring soon", color: "var(--color-soon)" };
  }
  if (daysLeft <= 7) {
    return { label: "Warning", color: "var(--color-soon)" };
  }
  return { label: "Fresh", color: "var(--color-fresh)" };
}

export { getStatus };
