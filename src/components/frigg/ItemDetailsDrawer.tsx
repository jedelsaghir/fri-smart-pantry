"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Package, Snowflake, Thermometer } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getStatus } from "./ItemCard";
import { defaultPriceUnit, getFreezerExtensionDays } from "@/hooks/usePantry";
import type { DetailsItemState, PantryItem, StorageKey } from "@/types/pantry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Calendar date for a daysLeft offset (local noon to avoid TZ edge cases) */
function expirationDateFromDaysLeft(daysLeft: number): Date {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() + Math.max(0, Math.floor(daysLeft)));
  return d;
}

/** YYYY-MM-DD for <input type="date"> */
function toDateInputValue(daysLeft: number): string {
  const d = expirationDateFromDaysLeft(daysLeft);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert YYYY-MM-DD → whole days from today (clamped ≥ 0) */
function daysLeftFromDateInput(iso: string): number {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, day] = parts;
  const target = new Date(y, m - 1, day, 12, 0, 0, 0);
  const today = startOfTodayLocal();
  const diffMs = target.getTime() - today.getTime();
  return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
}

function formatExpiresLabel(daysLeft: number): string {
  const formatted = expirationDateFromDaysLeft(daysLeft).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (daysLeft <= 0) return `Expired ${formatted}`;
  return `Expires ${formatted}`;
}

function formatPrice(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return "";
  return value.toFixed(2);
}

function parseNonNegNumber(raw: string, fallback: number, allowDecimal = false): number {
  const cleaned = raw.replace(",", ".").trim();
  if (cleaned === "" || cleaned === ".") return fallback;
  const n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  if (Number.isNaN(n) || n < 0) return fallback;
  return allowDecimal ? Math.round(n * 100) / 100 : Math.floor(n);
}

// ---------------------------------------------------------------------------
// Tappable number control (–  [value]  +) with inline edit on value tap
// ---------------------------------------------------------------------------

function TapNumberControl({
  value,
  onChange,
  step = 1,
  min = 0,
  allowDecimal = false,
  displayWidthClass = "w-16",
  valueClassName = "text-2xl",
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  allowDecimal?: boolean;
  displayWidthClass?: string;
  valueClassName?: string;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(allowDecimal ? formatPrice(value) || String(value) : String(value));
  }, [value, editing, allowDecimal]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = parseNonNegNumber(draft, value, allowDecimal);
    const clamped = Math.max(min, next);
    onChange(clamped);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-3xl bg-secondary/70 p-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, allowDecimal ? Math.round((value - step) * 100) / 100 : value - step))}
        className="touch-target flex-1 grid h-11 place-items-center rounded-3xl text-xl font-medium active:bg-background/70 active:scale-[0.985] transition"
        aria-label={`Decrease ${ariaLabel}`}
      >
        –
      </button>

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode={allowDecimal ? "decimal" : "numeric"}
          pattern={allowDecimal ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setDraft(String(value));
              setEditing(false);
            }
          }}
          aria-label={`Edit ${ariaLabel}`}
          className={`${displayWidthClass} h-11 rounded-2xl bg-background/80 text-center ${valueClassName} font-semibold tabular-nums text-foreground outline-none ring-1 ring-brand/30`}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`${displayWidthClass} h-11 rounded-2xl text-center ${valueClassName} font-semibold tabular-nums text-foreground active:bg-background/50 transition`}
          aria-label={`Edit ${ariaLabel} — tap to type`}
          title="Tap to type a number"
        >
          {allowDecimal ? formatPrice(value) || value : value}
        </button>
      )}

      <button
        type="button"
        onClick={() =>
          onChange(allowDecimal ? Math.round((value + step) * 100) / 100 : value + step)
        }
        className="touch-target flex-1 grid h-11 place-items-center rounded-3xl bg-brand text-brand-foreground text-xl font-medium active:brightness-105 active:scale-[0.985] transition"
        aria-label={`Increase ${ariaLabel}`}
      >
        +
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline text field (name / price)
// ---------------------------------------------------------------------------

function InlineEditableText({
  value,
  onCommit,
  className,
  inputClassName,
  placeholder,
  ariaLabel,
  as: Tag = "button",
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
  as?: "button" | "span";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        aria-label={ariaLabel}
        className={
          inputClassName ??
          "w-full min-w-0 rounded-xl bg-background/80 px-2 py-1 text-[21px] font-semibold tracking-[-0.015em] leading-tight outline-none ring-1 ring-brand/30"
        }
      />
    );
  }

  if (Tag === "span") {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={className}
        aria-label={ariaLabel}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={className}
      aria-label={ariaLabel}
    >
      {value || placeholder}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

export function ItemDetailsDrawer({
  detailsItem,
  onClose,
  onPatch,
  onMove,
}: {
  detailsItem: DetailsItemState | null;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<PantryItem>) => void;
  onMove: (id: string, from: StorageKey, to: StorageKey) => void;
}) {
  const open = !!detailsItem;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-w-md mx-auto">
        {detailsItem && (
          <DetailsBody
            key={detailsItem.item.id}
            item={detailsItem.item}
            storage={detailsItem.storage}
            onPatch={onPatch}
            onMove={onMove}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function DetailsBody({
  item,
  storage,
  onPatch,
  onMove,
}: {
  item: PantryItem;
  storage: StorageKey;
  onPatch: (id: string, patch: Partial<PantryItem>) => void;
  onMove: (id: string, from: StorageKey, to: StorageKey) => void;
}) {
  const status = getStatus(item.daysLeft);
  const isCurrent = (target: StorageKey) => storage === target;
  const priceBasis = item.priceUnit || defaultPriceUnit(item.unit);
  const expiresLabel = formatExpiresLabel(item.daysLeft);

  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState(
    item.latestPrice !== undefined ? formatPrice(item.latestPrice) : ""
  );
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingPrice) {
      setPriceDraft(item.latestPrice !== undefined ? formatPrice(item.latestPrice) : "");
    }
  }, [item.latestPrice, editingPrice]);

  useEffect(() => {
    if (editingPrice) {
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    }
  }, [editingPrice]);

  const commitPrice = () => {
    const raw = priceDraft.replace(",", ".").trim();
    if (raw === "") {
      onPatch(item.id, { latestPrice: undefined });
    } else {
      const n = parseFloat(raw);
      if (!Number.isNaN(n) && n >= 0) {
        onPatch(item.id, {
          latestPrice: Math.round(n * 100) / 100,
          priceUnit: priceBasis,
        });
      }
    }
    setEditingPrice(false);
  };

  const quickAction = (to: StorageKey) => {
    if (isCurrent(to)) return;
    onMove(item.id, storage, to);
  };

  return (
    <>
      <DrawerHeader className="text-left pb-2">
        <div className="flex items-start gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-[1.15rem] bg-secondary text-3xl shadow-inner ring-1 ring-border/40">
            {item.emoji}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            {/* Inline rename */}
            <DrawerTitle className="sr-only">{item.name}</DrawerTitle>
            <InlineEditableText
              value={item.name}
              onCommit={(name) => onPatch(item.id, { name })}
              ariaLabel="Rename item"
              className="block w-full text-left text-[20px] font-semibold tracking-[-0.015em] leading-tight text-foreground rounded-lg active:bg-secondary/50 px-0.5 -mx-0.5 transition"
              inputClassName="w-full min-w-0 rounded-xl bg-background/80 px-2 py-1 text-[20px] font-semibold tracking-[-0.015em] leading-tight outline-none ring-1 ring-brand/30"
            />

            {/* Weight / unit • latest price */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted-foreground px-0.5">
              <span className="font-medium text-foreground/80 tabular-nums">
                {item.qty} {item.unit}
              </span>
              <span className="opacity-40">•</span>
              {editingPrice ? (
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground">€</span>
                  <input
                    ref={priceInputRef}
                    type="text"
                    inputMode="decimal"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    onBlur={commitPrice}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitPrice();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingPrice(false);
                      }
                    }}
                    placeholder="0.00"
                    aria-label="Edit latest price"
                    className="w-14 rounded-md bg-background/80 px-1 py-0.5 text-[12px] font-medium tabular-nums text-foreground outline-none ring-1 ring-brand/30"
                  />
                  <span className="text-muted-foreground">/ {priceBasis}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingPrice(true)}
                  className="rounded-md px-0.5 font-medium text-foreground/75 active:bg-secondary/60 transition"
                  aria-label="Edit latest price"
                  title="Tap to edit price"
                >
                  {item.latestPrice !== undefined ? (
                    <>
                      €{formatPrice(item.latestPrice)}{" "}
                      <span className="text-muted-foreground font-normal">/ {priceBasis}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/80">Add latest price</span>
                  )}
                </button>
              )}
            </div>

            {/* Storage + status */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 px-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                {storage === "fridge" ? "Fridge" : storage === "freezer" ? "Freezer" : "Pantry"}
              </span>
              <span
                className="status-pill text-[10px] px-2.5 py-px inline-flex"
                style={{
                  backgroundColor: `color-mix(in oklab, ${status.color} 13%, var(--color-card))`,
                  color: status.color,
                  borderColor: `color-mix(in oklab, ${status.color} 22%, transparent)`,
                }}
              >
                <span
                  className="size-1 rounded-full mr-1.5"
                  style={{ backgroundColor: status.color }}
                />
                {status.label}
              </span>
            </div>
          </div>
        </div>
      </DrawerHeader>

      <div className="px-5 pb-1 space-y-4">
        {/* Quantity */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <div className="text-sm font-semibold tracking-[-0.01em]">Quantity</div>
            <div className="text-sm font-semibold tabular-nums text-foreground/90">
              {item.qty} {item.unit}
            </div>
          </div>
          <TapNumberControl
            value={item.qty}
            onChange={(qty) => onPatch(item.id, { qty })}
            min={0}
            ariaLabel="quantity"
            valueClassName="text-2xl"
          />
          <p className="mt-1 px-0.5 text-[11px] text-muted-foreground">
            Tap the number to type a value.
          </p>
        </div>

        {/* Expiration — real calendar date (no +/−) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="size-4" />
              Expiration
            </div>
            <span className="text-sm font-semibold tracking-[-0.01em]">{expiresLabel}</span>
          </div>

          <label className="flex items-center gap-3 rounded-3xl bg-secondary/70 px-4 py-2.5 active:bg-secondary/80 transition">
            <Calendar className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="date"
              value={toDateInputValue(item.daysLeft)}
              min={toDateInputValue(0)}
              onChange={(e) => {
                const iso = e.target.value;
                if (!iso) return;
                onPatch(item.id, { daysLeft: daysLeftFromDateInput(iso) });
              }}
              aria-label="Expiration date"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tabular-nums text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </label>
          <p className="mt-1 px-0.5 text-[11px] text-muted-foreground">
            {expiresLabel}
            {item.daysLeft > 0
              ? ` · ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`
              : " · expired or expires today"}
            . Pick a date; freezers last 3–6× longer.
          </p>
        </div>

        {/* Minimum stock */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <div className="text-sm font-semibold">Minimum stock</div>
            <div className="text-sm font-semibold tabular-nums">
              {item.minStock} {item.unit}
            </div>
          </div>
          <TapNumberControl
            value={item.minStock}
            onChange={(minStock) => onPatch(item.id, { minStock })}
            min={0}
            ariaLabel="minimum stock"
            valueClassName="text-2xl"
          />
        </div>

        {/* Latest price (full row control for convenience) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <div className="text-sm font-semibold">Latest price</div>
            <div className="text-sm font-medium tabular-nums text-muted-foreground">
              / {priceBasis}
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-3xl bg-secondary/70 p-1">
            <span className="pl-3 text-sm font-medium text-muted-foreground">€</span>
            <input
              type="text"
              inputMode="decimal"
              value={
                editingPrice
                  ? priceDraft
                  : item.latestPrice !== undefined
                    ? formatPrice(item.latestPrice)
                    : priceDraft
              }
              onFocus={() => {
                setEditingPrice(true);
                setPriceDraft(
                  item.latestPrice !== undefined ? formatPrice(item.latestPrice) : ""
                );
              }}
              onChange={(e) => {
                setEditingPrice(true);
                setPriceDraft(e.target.value);
              }}
              onBlur={commitPrice}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="0.00"
              aria-label="Latest price"
              className="flex-1 h-11 bg-transparent text-center text-2xl font-semibold tabular-nums text-foreground outline-none"
            />
            <span className="pr-3 text-xs font-medium text-muted-foreground shrink-0">
              / {priceBasis}
            </span>
          </div>
          <p className="mt-1 px-0.5 text-[11px] text-muted-foreground">
            Shown under the title as weight • price.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="pt-0.5">
          <div className="px-0.5 mb-1.5 text-sm font-semibold tracking-[-0.01em]">
            Quick Actions
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => quickAction("fridge")}
              disabled={isCurrent("fridge")}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-3xl border py-3 text-sm font-medium active:scale-[0.985] transition disabled:opacity-60 disabled:active:scale-100 ${
                isCurrent("fridge")
                  ? "bg-secondary border-border/70 text-foreground/70"
                  : "bg-card active:bg-secondary/60 border-border/60"
              }`}
            >
              <Thermometer className="size-4" />
              <span>Fridge</span>
              {isCurrent("fridge") && (
                <span className="text-[10px] text-muted-foreground">Current</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => quickAction("freezer")}
              disabled={isCurrent("freezer")}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-3xl border py-3 text-sm font-medium active:scale-[0.985] transition disabled:opacity-60 disabled:active:scale-100 ${
                isCurrent("freezer")
                  ? "bg-secondary border-border/70 text-foreground/70"
                  : "bg-[color-mix(in_oklab,var(--color-fresh)_8%,var(--color-card))] border-[color-mix(in_oklab,var(--color-fresh)_25%,transparent)]"
              }`}
            >
              <Snowflake className="size-4" />
              <span>Freezer</span>
              {!isCurrent("freezer") && (
                <span className="text-[10px] text-muted-foreground">
                  +{getFreezerExtensionDays(item.name)}d
                </span>
              )}
              {isCurrent("freezer") && (
                <span className="text-[10px] text-muted-foreground">Current</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => quickAction("pantry")}
              disabled={isCurrent("pantry")}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-3xl border py-3 text-sm font-medium active:scale-[0.985] transition disabled:opacity-60 disabled:active:scale-100 ${
                isCurrent("pantry")
                  ? "bg-secondary border-border/70 text-foreground/70"
                  : "bg-card active:bg-secondary/60 border-border/60"
              }`}
            >
              <Package className="size-4" />
              <span>Pantry</span>
              {isCurrent("pantry") && (
                <span className="text-[10px] text-muted-foreground">Current</span>
              )}
            </button>
          </div>
          <p className="px-0.5 mt-2 text-[11px] text-muted-foreground">
            Moving to freezer automatically extends expiration.
          </p>
        </div>
      </div>

      <DrawerFooter className="pt-2 pb-6">
        <DrawerClose asChild>
          <button
            type="button"
            className="w-full rounded-3xl py-3.5 text-sm font-semibold border active:bg-secondary/60"
          >
            Done
          </button>
        </DrawerClose>
      </DrawerFooter>
    </>
  );
}
