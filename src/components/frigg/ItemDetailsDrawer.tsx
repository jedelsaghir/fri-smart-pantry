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
import { moneySymbol } from "@/lib/money";
import {
  canToggleUnit,
  priceAfterUnitToggle,
  toggleMassUnit,
  toggleVolumeUnit,
} from "@/lib/units";
import { hapticLight } from "@/lib/haptics";
import type { DetailsItemState, PantryItem, StorageKey } from "@/types/pantry";

const PRICE_CURRENCY = "EUR";

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function expirationDateFromDaysLeft(daysLeft: number): Date {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() + Math.floor(daysLeft));
  return d;
}

function toDateInputValue(daysLeft: number | null | undefined): string {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return "";
  const d = expirationDateFromDaysLeft(daysLeft);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function minDateInputValue(): string {
  const d = startOfTodayLocal();
  d.setFullYear(d.getFullYear() - 2);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysLeftFromDateInput(iso: string): number {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return 0;
  const [y, m, day] = parts;
  const target = new Date(y, m - 1, day, 12, 0, 0, 0);
  const today = startOfTodayLocal();
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

const UNIT_OPTIONS = ["pcs", "g", "ml"] as const;

function isDecimalUnit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  return u === "g" || u === "ml" || u === "kg" || u === "l";
}

function formatExpiresLabel(daysLeft: number | null | undefined): string {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return "No expiry";
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
    onChange(Math.max(min, next));
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-3xl bg-secondary/70 p-1">
      <button
        type="button"
        onClick={() =>
          onChange(
            Math.max(min, allowDecimal ? Math.round((value - step) * 100) / 100 : value - step)
          )
        }
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

function InlineEditableText({
  value,
  onCommit,
  className,
  inputClassName,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  ariaLabel: string;
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

  return (
    <button type="button" onClick={() => setEditing(true)} className={className} aria-label={ariaLabel}>
      {value || placeholder}
    </button>
  );
}

export function ItemDetailsDrawer({
  detailsItem,
  onClose,
  onPatch,
  onMove,
  onRequestDelete,
}: {
  detailsItem: DetailsItemState | null;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<PantryItem>) => void;
  onMove: (id: string, from: StorageKey, to: StorageKey) => void;
  onRequestDelete?: (id: string) => void;
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
            onRequestDelete={onRequestDelete}
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
  onRequestDelete,
}: {
  item: PantryItem;
  storage: StorageKey;
  onPatch: (id: string, patch: Partial<PantryItem>) => void;
  onMove: (id: string, from: StorageKey, to: StorageKey) => void;
  onRequestDelete?: (id: string) => void;
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

  return (
    <>
      <DrawerHeader className="text-left pb-2">
        <div className="flex items-start gap-3">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-secondary text-3xl">
            {item.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-[21px] tracking-[-0.015em] leading-tight">
              <InlineEditableText
                value={item.name}
                onCommit={(name) => onPatch(item.id, { name })}
                ariaLabel="Edit item name"
              />
            </DrawerTitle>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className="status-pill"
                style={{
                  background: `color-mix(in oklab, ${status.color} 18%, transparent)`,
                  color: status.color,
                }}
              >
                {status.label}
              </span>
              {item.brand && (
                <span className="text-[12px] text-muted-foreground">Last bought: {item.brand}</span>
              )}
            </div>
          </div>
        </div>
      </DrawerHeader>

      <div className="space-y-4 px-5 pb-2">
        <div>
          <div className="mb-1.5 flex items-center gap-2 px-0.5 text-sm font-semibold">
            <Package className="size-4" />
            Quantity
          </div>
          <TapNumberControl
            value={item.qty}
            onChange={(qty) => onPatch(item.id, { qty })}
            step={isDecimalUnit(item.unit) ? 10 : 1}
            allowDecimal={isDecimalUnit(item.unit)}
            ariaLabel="quantity"
          />
          <div className="mt-2 flex gap-1.5" role="group" aria-label="Unit">
            {UNIT_OPTIONS.map((u) => {
              const active = item.unit === u;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => {
                    if (item.unit === u) return;
                    hapticLight();
                    onPatch(item.id, { unit: u });
                  }}
                  className={
                    "min-h-11 flex-1 rounded-2xl border text-sm font-semibold transition active:scale-[0.98] " +
                    (active
                      ? "border-brand/40 bg-brand text-brand-foreground"
                      : "border-border/50 bg-secondary/50 text-foreground active:bg-secondary")
                  }
                >
                  {u}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2 px-0.5 text-sm font-semibold">
            <Thermometer className="size-4" />
            Storage
          </div>
          <div className="flex gap-1.5">
            {(["fridge", "freezer", "pantry"] as StorageKey[]).map((s) => {
              const label = s === "fridge" ? "Fridge" : s === "freezer" ? "Freezer" : "Pantry";
              const active = isCurrent(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (active) return;
                    onMove(item.id, storage, s);
                  }}
                  className={
                    "min-h-11 flex-1 rounded-2xl border text-sm font-semibold transition active:scale-[0.98] " +
                    (active
                      ? "border-brand/40 bg-brand text-brand-foreground"
                      : "border-border/50 bg-secondary/50 text-foreground active:bg-secondary")
                  }
                >
                  {s === "freezer" ? <Snowflake className="mx-auto size-3.5" /> : null}
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 px-0.5 text-[11px] text-muted-foreground">
            Moving to freezer automatically extends expiration.
          </p>
        </div>

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
              min={minDateInputValue()}
              onChange={(e) => {
                const iso = e.target.value;
                if (!iso) {
                  onPatch(item.id, { daysLeft: null });
                  return;
                }
                onPatch(item.id, { daysLeft: daysLeftFromDateInput(iso) });
              }}
              aria-label="Expiration date"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold tabular-nums text-foreground outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.daysLeft != null ? (
              <>
                <button
                  type="button"
                  onClick={() => onPatch(item.id, { daysLeft: -1 })}
                  className="min-h-11 rounded-2xl border border-border/50 bg-secondary/50 px-3 text-[12px] font-semibold active:bg-secondary"
                >
                  Mark expired
                </button>
                <button
                  type="button"
                  onClick={() => onPatch(item.id, { daysLeft: null })}
                  className="min-h-11 rounded-2xl border border-border/50 bg-secondary/50 px-3 text-[12px] font-semibold active:bg-secondary"
                >
                  Clear expiry
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onPatch(item.id, { daysLeft: 7 })}
                className="min-h-11 rounded-2xl border border-border/50 bg-secondary/50 px-3 text-[12px] font-semibold active:bg-secondary"
              >
                Set expiry
              </button>
            )}
          </div>
          <p className="mt-1 px-0.5 text-[11px] text-muted-foreground">
            {expiresLabel}
            {typeof item.daysLeft === "number"
              ? item.daysLeft > 0
                ? ` · ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left`
                : item.daysLeft < 0
                  ? ` · expired ${Math.abs(item.daysLeft)} day${Math.abs(item.daysLeft) === 1 ? "" : "s"} ago`
                  : " · expires today"
              : " · optional"}
            . Past dates allowed for already-expired items.
          </p>
        </div>

        {onRequestDelete && (
          <button
            type="button"
            onClick={() => onRequestDelete(item.id)}
            className="w-full min-h-11 rounded-2xl border border-destructive/30 bg-destructive/5 text-sm font-semibold text-destructive active:bg-destructive/10"
          >
            Delete item…
          </button>
        )}
      </div>

      <DrawerFooter className="gap-2 pb-6">
        <DrawerClose asChild>
          <button
            type="button"
            className="w-full rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
          >
            Done
          </button>
        </DrawerClose>
      </DrawerFooter>
    </>
  );
}
