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
  /** Kept for API compatibility — qty/min controls live in details drawer only */
  onInc?: () => void;
  onDec?: () => void;
  onUpdateMinStock?: (newMin: number) => void;
  onUpdateDaysLeft?: (newDays: number) => void;
  onOpenDetails?: () => void;
}) {
  void storage;
  void onInc;
  void onDec;
  void onUpdateMinStock;
  void onUpdateDaysLeft;

  const status = getStatus(item.daysLeft);

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
      className="pantry-item-card elevated-card w-full max-w-full cursor-pointer select-none list-none rounded-[1.85rem] px-5 py-5 transition-[transform,box-shadow] duration-200 active:scale-[0.992]"
      style={{ display: "block", width: "100%" }}
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
      {/* Single-column Apple Health–style row: emoji | meta | qty */}
      <div className="flex w-full items-center gap-4">
        {/* Large emoji tile */}
        <div
          className="grid size-16 shrink-0 place-items-center rounded-[1.35rem] bg-secondary text-[2.15rem] leading-none shadow-[inset_0_1px_0_oklch(1_0_0_/_0.6)] ring-1 ring-border/20"
          aria-hidden
        >
          {item.emoji}
        </div>

        {/* Name + status only */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold leading-snug tracking-[-0.025em] text-foreground">
            {item.name}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
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
            <span className="text-[13px] font-medium tabular-nums tracking-[-0.01em] text-muted-foreground">
              {item.daysLeft}d left
            </span>
          </div>
        </div>

        {/* Current quantity only — no min stock, no stepper */}
        <div className="shrink-0 self-center rounded-2xl bg-secondary/50 px-3.5 py-2.5 text-right ring-1 ring-border/20">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Qty
          </p>
          <p className="mt-0.5 text-[16px] font-semibold tabular-nums leading-none tracking-[-0.02em] text-foreground">
            {item.qty}
            <span className="ml-1 text-[12px] font-medium text-muted-foreground">{item.unit}</span>
          </p>
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
