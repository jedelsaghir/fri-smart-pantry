"use client";

import { useRef } from "react";
import type { PantryItem, ItemStatus, StorageKey } from "@/types/pantry";

export type { PantryItem, ItemStatus };

function shortStatusLabel(label: string): string {
  if (label === "Expiring soon") return "Soon";
  if (label === "Use today") return "Today";
  return label;
}

/**
 * Compact premium single-column pantry card.
 * Shows ONLY: emoji, name, status, days left, quantity.
 * Min stock + steppers live exclusively in the details drawer.
 */
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
      if (navigator.vibrate) navigator.vibrate(10);
    }, 520);
  };

  const endLongPress = () => clearLongPress();

  const open = () => {
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
      data-pantry-card="single-column"
      aria-label={`${item.name}, ${item.qty} ${item.unit}, ${status.label}, ${item.daysLeft} days left. Tap for details.`}
      className="pantry-item-card elevated-card cursor-pointer select-none list-none col-span-1 w-full"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        borderRadius: "1.25rem",
        padding: "0.7rem 0.85rem",
        margin: 0,
        gridColumn: "1 / -1",
      }}
      onPointerDown={startLongPress}
      onPointerUp={endLongPress}
      onPointerLeave={endLongPress}
      onPointerCancel={endLongPress}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails?.();
        }
      }}
    >
      {/* Compact emoji — ~50px */}
      <div
        aria-hidden
        style={{
          width: "50px",
          height: "50px",
          flexShrink: 0,
          display: "grid",
          placeItems: "center",
          borderRadius: "0.9rem",
          fontSize: "1.5rem",
          lineHeight: 1,
          background: "var(--color-secondary)",
          boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.55)",
        }}
        className="ring-1 ring-border/20"
      >
        {item.emoji}
      </div>

      {/* Name + status / days */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          className="truncate text-foreground"
          style={{
            margin: 0,
            fontSize: "0.975rem",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}
        >
          {item.name}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.35rem 0.55rem",
            marginTop: "0.3rem",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.28rem",
              borderRadius: "999px",
              padding: "0.12rem 0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              backgroundColor: `color-mix(in oklab, ${status.color} 11%, var(--color-card))`,
              color: status.color,
              border: `1px solid color-mix(in oklab, ${status.color} 14%, transparent)`,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "999px",
                backgroundColor: status.color,
                flexShrink: 0,
              }}
            />
            {shortStatusLabel(status.label)}
          </span>
          <span
            className="text-muted-foreground"
            style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.daysLeft}d left
          </span>
        </div>
      </div>

      {/* Quantity — right-aligned, no full-width footer */}
      <div
        style={{
          flexShrink: 0,
          textAlign: "right",
          paddingLeft: "0.25rem",
        }}
      >
        <span
          className="text-foreground"
          style={{
            display: "block",
            fontSize: "0.975rem",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {item.qty}
        </span>
        <span
          className="text-muted-foreground"
          style={{
            display: "block",
            marginTop: "0.1rem",
            fontSize: "0.6875rem",
            fontWeight: 500,
          }}
        >
          {item.unit}
        </span>
      </div>
    </li>
  );
}

function getStatus(daysLeft: number): ItemStatus {
  if (daysLeft <= 0) return { label: "Expired", color: "var(--color-expiring)" };
  if (daysLeft <= 1) return { label: "Use today", color: "var(--color-expiring)" };
  if (daysLeft <= 3) return { label: "Expiring soon", color: "var(--color-soon)" };
  if (daysLeft <= 7) return { label: "Warning", color: "var(--color-soon)" };
  return { label: "Fresh", color: "var(--color-fresh)" };
}

export { getStatus };
