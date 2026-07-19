"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import type { PantryItem, ItemStatus, StorageKey } from "@/types/pantry";

export type { PantryItem, ItemStatus };

function shortStatusLabel(label: string): string {
  if (label === "Expiring soon") return "Soon";
  if (label === "Use today") return "Today";
  return label;
}

const SWIPE_DELETE_THRESHOLD = 88;
const SWIPE_MAX = 112;

/**
 * Minimal premium single-column pantry card.
 * Shows ONLY: emoji, name, status pill, "Xd left", quantity.
 * Min stock / steppers / price live in the details drawer.
 * Swipe left or tap × to delete (parent handles undo toast).
 */
export function ItemCard({
  item,
  storage,
  onOpenDetails,
  onDelete,
}: {
  item: PantryItem;
  storage?: StorageKey;
  onInc?: () => void;
  onDec?: () => void;
  onUpdateMinStock?: (newMin: number) => void;
  onUpdateDaysLeft?: (newDays: number) => void;
  onOpenDetails?: () => void;
  onDelete?: () => void;
}) {
  void storage;

  const status = getStatus(item.daysLeft);

  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axisLock = useRef<"x" | "y" | null>(null);
  const didSwipe = useRef(false);
  const offsetRef = useRef(0);

  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const setOffset = (x: number) => {
    offsetRef.current = x;
    setOffsetX(x);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-delete-btn]")) return;

    longPressTriggered.current = false;
    didSwipe.current = false;
    axisLock.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    setIsDragging(true);

    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      if (didSwipe.current || axisLock.current === "x") return;
      longPressTriggered.current = true;
      onOpenDetails?.();
      if (navigator.vibrate) navigator.vibrate(10);
    }, 520);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!axisLock.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisLock.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axisLock.current === "x") clearLongPress();
    }

    if (axisLock.current === "y") return;

    // Swipe left only
    const next = Math.min(0, Math.max(-SWIPE_MAX, dx));
    if (Math.abs(next) > 8) didSwipe.current = true;
    setOffset(next);
  };

  const finishGesture = () => {
    clearLongPress();
    setIsDragging(false);

    if (offsetRef.current <= -SWIPE_DELETE_THRESHOLD && onDelete) {
      setOffset(-SWIPE_MAX);
      // slight delay so the reveal reads, then delete
      window.setTimeout(() => {
        setOffset(0);
        onDelete();
      }, 120);
      return;
    }

    setOffset(0);
  };

  const onPointerUp = () => finishGesture();
  const onPointerCancel = () => {
    clearLongPress();
    setIsDragging(false);
    setOffset(0);
  };

  const open = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    if (didSwipe.current || Math.abs(offsetRef.current) > 6) return;
    onOpenDetails?.();
  };

  const handleDeleteClick = (e: ReactMouseEvent | ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    clearLongPress();
    onDelete?.();
  };

  return (
    <li
      className="pantry-item-row list-none w-full"
      data-layout="single-column"
      data-cols="1"
      style={{
        display: "block",
        width: "100%",
        maxWidth: "100%",
        flex: "0 0 auto",
        position: "relative",
        overflow: "hidden",
        borderRadius: "1.25rem",
        margin: 0,
        padding: 0,
        touchAction: "pan-y",
      }}
    >
      {/* Swipe-left delete reveal */}
      <div
        aria-hidden
        className="pantry-swipe-delete-bg"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: "1.1rem",
          background:
            "linear-gradient(90deg, transparent 20%, color-mix(in oklab, var(--color-expiring) 18%, var(--color-card)) 55%, color-mix(in oklab, var(--color-expiring) 55%, var(--color-card)))",
          color: "var(--color-expiring)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.02em",
          borderRadius: "1.25rem",
        }}
      >
        Delete
      </div>

      <div
        role="button"
        tabIndex={0}
        data-pantry-card="single-column"
        aria-label={`${item.name}, ${item.qty} ${item.unit}, ${status.label}, ${item.daysLeft} days left. Tap for details. Swipe left to delete.`}
        className="pantry-item-card elevated-card cursor-pointer select-none w-full"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          borderRadius: "1.25rem",
          padding: "0.65rem 0.55rem 0.65rem 0.75rem",
          margin: 0,
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)",
          willChange: "transform",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDetails?.();
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            onDelete?.();
          }
        }}
      >
        {/* Compact emoji — ~48px */}
        <div
          aria-hidden
          style={{
            width: "48px",
            height: "48px",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: "0.85rem",
            fontSize: "1.4rem",
            lineHeight: 1,
            background: "var(--color-secondary)",
            boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.55)",
          }}
          className="ring-1 ring-border/20"
        >
          {item.emoji}
        </div>

        {/* Name + status / days only */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            className="truncate text-foreground"
            style={{
              margin: 0,
              fontSize: "0.95rem",
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
              gap: "0.3rem 0.5rem",
              marginTop: "0.28rem",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                borderRadius: "999px",
                padding: "0.1rem 0.45rem",
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
                fontSize: "0.72rem",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {item.daysLeft}d left
            </span>
          </div>
        </div>

        {/* Current quantity only — no steppers, no min stock */}
        <div
          style={{
            flexShrink: 0,
            textAlign: "right",
            paddingLeft: "0.15rem",
            minWidth: "2.25rem",
          }}
        >
          <span
            className="text-foreground"
            style={{
              display: "block",
              fontSize: "0.95rem",
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
              marginTop: "0.08rem",
              fontSize: "0.65rem",
              fontWeight: 500,
            }}
          >
            {item.unit}
          </span>
        </div>

        {/* Quick delete × */}
        {onDelete && (
          <button
            type="button"
            data-delete-btn
            onClick={handleDeleteClick}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Delete ${item.name}`}
            title="Delete"
            className="touch-target shrink-0 grid place-items-center rounded-full text-muted-foreground/70 active:bg-secondary active:text-foreground transition"
            style={{
              width: "1.85rem",
              height: "1.85rem",
              minWidth: "1.85rem",
              minHeight: "1.85rem",
              fontSize: "0.95rem",
              lineHeight: 1,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ×
          </button>
        )}
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
