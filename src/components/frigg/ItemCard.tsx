"use client";

import { useRef } from "react";
import type { PantryItem, ItemStatus, StorageKey } from "@/types/pantry";

export type { PantryItem, ItemStatus };

/** Compact status copy for calm cards */
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
  /** Kept for API compatibility — controls live in details drawer */
  onInc?: () => void;
  onDec?: () => void;
  onUpdateMinStock?: (newMin: number) => void;
  onUpdateDaysLeft?: (newDays: number) => void;
  onOpenDetails?: () => void;
}) {
  // Suppress unused-props warnings while preserving call-site API
  void storage;
  void onInc;
  void onDec;
  void onUpdateMinStock;
  void onUpdateDaysLeft;

  const status = getStatus(item.daysLeft);

  // Long-press timer ref for opening details
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      onOpenDetails?.();
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }, 520);
  };

  const endLongPress = () => {
    clearLongPress();
  };

  const handleClick = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onOpenDetails?.();
  };

  return (
    <li
      role="button"
      tabIndex={0}
      aria-label={`${item.name}, ${item.qty} ${item.unit}, ${status.label}, ${item.daysLeft} days left. Tap for details.`}
      className="elevated-card flex cursor-pointer items-center gap-4 rounded-[1.75rem] px-4 py-4 select-none active:scale-[0.99] transition-transform"
      onPointerDown={startLongPress}
      onPointerUp={endLongPress}
      onPointerLeave={endLongPress}
      onPointerCancel={endLongPress}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails?.();
        }
      }}
    >
      {/* Emoji */}
      <div
        className="grid size-[3.75rem] shrink-0 place-items-center rounded-[1.25rem] bg-secondary text-[2rem] leading-none shadow-[inset_0_1px_0_oklch(1_0_0_/_0.55)] ring-1 ring-border/20"
        aria-hidden
      >
        {item.emoji}
      </div>

      {/* Name + status */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold leading-snug tracking-[-0.02em] text-foreground">
          {item.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em]"
            style={{
              backgroundColor: `color-mix(in oklab, ${status.color} 11%, var(--color-card))`,
              color: status.color,
              border: `1px solid color-mix(in oklab, ${status.color} 14%, transparent)`,
            }}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            {shortStatusLabel(status.label)}
          </span>
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
            {item.daysLeft}d left
          </span>
        </div>
      </div>

      {/* Current quantity — quiet, right-aligned */}
      <div className="shrink-0 text-right pl-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
          Qty
        </p>
        <p className="mt-0.5 text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
          {item.qty}
          <span className="ml-1 text-[12px] font-medium text-muted-foreground">{item.unit}</span>
        </p>
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
