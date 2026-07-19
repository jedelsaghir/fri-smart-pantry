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
 * Full-width minimal pantry card (1-column list only).
 * Face: emoji, name, status, days left, quantity.
 * Min stock / steppers / price → details drawer only.
 */
export function ItemCard({
  item,
  storage,
  onOpenDetails,
  onDelete,
}: {
  item: PantryItem;
  storage?: StorageKey;
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

  const setOffset = (x: number) => {
    offsetRef.current = x;
    setOffsetX(x);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-delete-btn]")) return;
    didSwipe.current = false;
    axisLock.current = null;
    startX.current = e.clientX;
    startY.current = e.clientY;
    setIsDragging(true);
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
    }
    if (axisLock.current === "y") return;
    const next = Math.min(0, Math.max(-SWIPE_MAX, dx));
    if (Math.abs(next) > 8) didSwipe.current = true;
    setOffset(next);
  };

  const finishGesture = () => {
    setIsDragging(false);
    if (offsetRef.current <= -SWIPE_DELETE_THRESHOLD && onDelete) {
      setOffset(-SWIPE_MAX);
      window.setTimeout(() => {
        setOffset(0);
        onDelete();
      }, 120);
      return;
    }
    setOffset(0);
  };

  const open = () => {
    if (didSwipe.current || Math.abs(offsetRef.current) > 6) return;
    onOpenDetails?.();
  };

  const handleDeleteClick = (e: ReactMouseEvent | ReactPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.();
  };

  return (
    <div
      role="listitem"
      className="pantry-item-row w-full shrink-0"
      style={{
        display: "block",
        width: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: "1.15rem",
      }}
    >
      {/* Swipe-left delete hint */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-end pr-4 text-xs font-semibold"
        style={{
          color: "var(--color-expiring)",
          background:
            "linear-gradient(90deg, transparent 30%, color-mix(in oklab, var(--color-expiring) 45%, var(--color-card)))",
          borderRadius: "1.15rem",
        }}
      >
        Delete
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={`${item.name}, ${item.qty} ${item.unit}, ${status.label}, ${item.daysLeft} days left. Tap for details.`}
        className="pantry-item-card elevated-card relative flex w-full cursor-pointer select-none items-center gap-3 px-3 py-2.5"
        style={{
          width: "100%",
          boxSizing: "border-box",
          borderRadius: "1.15rem",
          transform: `translate3d(${offsetX}px, 0, 0)`,
          transition: isDragging ? "none" : "transform 0.2s cubic-bezier(0.23, 1, 0.32, 1)",
          touchAction: "pan-y",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishGesture}
        onPointerCancel={() => {
          setIsDragging(false);
          setOffset(0);
        }}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDetails?.();
          }
        }}
      >
        {/* Emoji */}
        <div
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-[1.35rem] ring-1 ring-border/20"
        >
          {item.emoji}
        </div>

        {/* Name + status + days */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.95rem] font-semibold tracking-[-0.02em] text-foreground leading-snug">
            {item.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
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
            <span className="text-[0.72rem] font-medium tabular-nums text-muted-foreground">
              {item.daysLeft}d left
            </span>
          </div>
        </div>

        {/* Quantity only */}
        <div className="shrink-0 text-right pl-1 min-w-[2.25rem]">
          <span className="block text-[0.95rem] font-semibold tabular-nums tracking-[-0.02em] text-foreground leading-none">
            {item.qty}
          </span>
          <span className="mt-0.5 block text-[0.65rem] font-medium text-muted-foreground">
            {item.unit}
          </span>
        </div>

        {onDelete && (
          <button
            type="button"
            data-delete-btn
            onClick={handleDeleteClick}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Delete ${item.name}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-lg leading-none text-muted-foreground/70 active:bg-secondary active:text-foreground"
          >
            ×
          </button>
        )}
      </div>
    </div>
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
