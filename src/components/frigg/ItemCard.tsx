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
 * Premium single-column pantry card.
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
        display: "block",
        width: "100%",
        maxWidth: "100%",
        minHeight: "9.5rem",
        boxSizing: "border-box",
        borderRadius: "1.85rem",
        padding: "1.5rem 1.5rem 1.35rem",
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
      {/* Top: large emoji + name — tall, spacious card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.15rem",
          width: "100%",
        }}
      >
        <div
          aria-hidden
          style={{
            width: "4.75rem",
            height: "4.75rem",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "1.4rem",
            fontSize: "2.5rem",
            lineHeight: 1,
            background: "var(--color-secondary)",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.55)",
          }}
          className="ring-1 ring-border/20"
        >
          {item.emoji}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            className="truncate text-foreground"
            style={{
              margin: 0,
              fontSize: "1.2rem",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.25,
            }}
          >
            {item.name}
          </p>

          {/* Status + days — only meta on card */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.5rem 0.75rem",
              marginTop: "0.75rem",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                borderRadius: "999px",
                padding: "0.28rem 0.75rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                backgroundColor: `color-mix(in oklab, ${status.color} 11%, var(--color-card))`,
                color: status.color,
                border: `1px solid color-mix(in oklab, ${status.color} 14%, transparent)`,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
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
                fontSize: "0.875rem",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {item.daysLeft}d left
            </span>
          </div>
        </div>
      </div>

      {/* Bottom: quantity only (no min stock, no stepper) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "1.35rem",
          paddingTop: "1.1rem",
          borderTop: "1px solid color-mix(in oklab, var(--color-border) 55%, transparent)",
        }}
      >
        <span
          className="text-muted-foreground"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Quantity
        </span>
        <span
          className="text-foreground"
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.02em",
          }}
        >
          {item.qty}
          <span
            className="text-muted-foreground"
            style={{ marginLeft: "0.35rem", fontSize: "0.875rem", fontWeight: 500 }}
          >
            {item.unit}
          </span>
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
