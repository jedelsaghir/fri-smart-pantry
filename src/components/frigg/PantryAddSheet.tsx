"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogItem, StorageKey } from "@/types/pantry";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { BarcodeAssistButton } from "./BarcodeAssistButton";
import { parseProductLabel } from "@/lib/product-name";
import {
  EXACT_MATCH_THRESHOLD,
  MATCH_THRESHOLD,
  findBestItemMatch,
  type MatchablePantryItem,
} from "@/lib/item-matching";
import type { BarcodeLookupResult } from "@/lib/barcode-lookup";

function normalizeUnitChip(unit: string | undefined): string {
  const u = (unit || "pcs").trim().toLowerCase();
  if (u === "pcs" || u === "g" || u === "ml") return u;
  if (u === "kg") return "g";
  if (u === "l" || u === "lt" || u === "ltr") return "ml";
  return "pcs";
}

function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
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

export function PantryAddSheet({
  open,
  onOpenChange,
  storage,
  suggest,
  onAdd,
  pantryItems = [],
  autoOpenBarcode = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storage: StorageKey;
  suggest: (query: string) => CatalogItem[];
  onAdd: (item: {
    name: string;
    unit: string;
    emoji: string;
    qty: number;
    minStock: number;
    barcode?: string;
    brand?: string;
    daysLeft: number | null;
  }) => void;
  /** Flat pantry rows for merge detection after barcode / name entry */
  pantryItems?: MatchablePantryItem[];
  /** When true, open barcode assist as soon as the sheet opens */
  autoOpenBarcode?: boolean;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [emoji, setEmoji] = useState("🛒");
  const [qty, setQty] = useState("1");
  const [barcode, setBarcode] = useState<string | undefined>();
  const [brand, setBrand] = useState<string | undefined>();
  const [trackExpiry, setTrackExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [barcodeStartKey, setBarcodeStartKey] = useState(0);
  /** When set, user is deciding merge vs create-new for a similar pantry row */
  const [pendingMatch, setPendingMatch] = useState<{
    candidateName: string;
    match: NonNullable<ReturnType<typeof findBestItemMatch>>;
  } | null>(null);
  const [mergeHint, setMergeHint] = useState<string | null>(null);

  const matches = useMemo(() => suggest(name), [name, suggest]);

  useEffect(() => {
    if (open && autoOpenBarcode) {
      setBarcodeStartKey((k) => k + 1);
    }
  }, [open, autoOpenBarcode]);

  const reset = () => {
    setName("");
    setUnit("pcs");
    setEmoji("🛒");
    setQty("1");
    setBarcode(undefined);
    setBrand(undefined);
    setTrackExpiry(false);
    setExpiryDate("");
    setPendingMatch(null);
    setMergeHint(null);
  };

  const pick = (item: CatalogItem) => {
    setName(item.name);
    setUnit(normalizeUnitChip(item.unit));
    setEmoji(item.emoji);
    setPendingMatch(null);
    setMergeHint(null);
  };

  const applyBarcodeResult = (r: BarcodeLookupResult) => {
    const raw = (r.name || "").trim();
    const parsed = parseProductLabel(raw);
    const simplified = parsed.name || raw;
    const nextUnit = normalizeUnitChip(r.unit);
    const nextEmoji = r.emoji || "🛒";
    const nextBrand = r.brand || parsed.brand;
    setBarcode(r.barcode);
    setBrand(nextBrand);
    setUnit(nextUnit);
    setEmoji(nextEmoji);

    if (!simplified) {
      setName(raw);
      setPendingMatch(null);
      setMergeHint(null);
      return;
    }

    const match = findBestItemMatch(
      { name: simplified, unit: nextUnit, qty: 1 },
      pantryItems
    );

    // Strong / exact → adopt existing pantry name so upsert merges qty
    if (match && match.score >= EXACT_MATCH_THRESHOLD) {
      setName(match.name);
      setUnit(normalizeUnitChip(match.unit) || nextUnit);
      setEmoji(match.emoji || nextEmoji);
      setPendingMatch(null);
      setMergeHint(
        `Found ${match.emoji} ${match.name} (${match.qty} ${match.unit} in ${match.storage}) — qty will be added`
      );
      return;
    }

    // Similar but not exact (e.g. "Pesto Sauce" vs "Pesto") → ask
    if (match && match.score >= MATCH_THRESHOLD) {
      setName(simplified);
      setPendingMatch({ candidateName: simplified, match });
      setMergeHint(null);
      return;
    }

    setName(simplified);
    setPendingMatch(null);
    setMergeHint(null);
  };

  const chooseMerge = () => {
    if (!pendingMatch) return;
    const m = pendingMatch.match;
    setName(m.name);
    setUnit(normalizeUnitChip(m.unit));
    setEmoji(m.emoji || emoji);
    setPendingMatch(null);
    setMergeHint(
      `Adding to ${m.emoji} ${m.name} (${m.qty} ${m.unit} in ${m.storage})`
    );
  };

  const chooseNew = () => {
    if (!pendingMatch) return;
    setName(pendingMatch.candidateName);
    setPendingMatch(null);
    setMergeHint(null);
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    const raw = qty.replace(",", ".").trim();
    const parsed =
      unit === "g" || unit === "ml" ? parseFloat(raw) : parseInt(raw, 10);
    const q = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    let daysLeft: number | null = null;
    if (trackExpiry && expiryDate) {
      daysLeft = daysLeftFromDateInput(expiryDate);
    }
    onAdd({
      name: n,
      unit: unit.trim() || "pcs",
      emoji: emoji.trim() || "🛒",
      qty: q,
      minStock: 1,
      barcode,
      daysLeft,
      ...(brand?.trim() ? { brand: brand.trim() } : {}),
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="text-[20px] tracking-[-0.015em]">
            Add to {storage === "fridge" ? "Fridge" : storage === "freezer" ? "Freezer" : "Pantry"}
          </DrawerTitle>
          <p className="text-sm text-muted-foreground">
            Scan a barcode or type a name. Matching items merge automatically.
          </p>
        </DrawerHeader>

        <div className="space-y-3 px-5 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <BarcodeAssistButton
              label="Scan or type barcode"
              onPrefill={applyBarcodeResult}
              startSignal={barcodeStartKey}
            />
            {barcode && (
              <span className="rounded-full bg-secondary/80 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                Code {barcode}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Names simplify to food types (e.g. Pesto). If something similar is already in stock, we ask before merging.
          </p>

          {pendingMatch && (
            <div className="rounded-3xl border border-brand/25 bg-[color-mix(in_oklab,var(--color-brand)_8%,var(--color-card))] px-3.5 py-3 space-y-2.5">
              <p className="text-[13px] font-semibold text-foreground leading-snug">
                Similar item in stock
              </p>
              <p className="text-[12px] text-muted-foreground leading-snug">
                Scanned as <span className="font-semibold text-foreground">{pendingMatch.candidateName}</span>
                {" · "}
                you already have{" "}
                <span className="font-semibold text-foreground">
                  {pendingMatch.match.emoji} {pendingMatch.match.name}
                </span>{" "}
                ({pendingMatch.match.qty} {pendingMatch.match.unit}).
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={chooseMerge}
                  className="min-h-11 w-full rounded-2xl bg-brand px-3 text-sm font-semibold text-brand-foreground active:scale-[0.98]"
                >
                  Add to {pendingMatch.match.name}
                </button>
                <button
                  type="button"
                  onClick={chooseNew}
                  className="min-h-11 w-full rounded-2xl border border-border/60 bg-secondary/50 px-3 text-sm font-semibold active:bg-secondary"
                >
                  Create new “{pendingMatch.candidateName}”
                </button>
              </div>
            </div>
          )}

          {mergeHint && !pendingMatch && (
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--color-fresh)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-fresh)_8%,var(--color-card))] px-3 py-2 text-[12px] font-medium text-foreground/90 leading-snug">
              {mergeHint}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="h-12 w-14 rounded-2xl text-center text-xl"
              aria-label="Emoji"
              maxLength={4}
            />
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPendingMatch(null);
                setMergeHint(null);
              }}
              placeholder="Item name"
              autoFocus
              className="h-12 flex-1 rounded-2xl text-[15px]"
              aria-label="Item name"
            />
          </div>

          {name.trim().length > 0 && matches.length > 0 && !pendingMatch && (
            <ul className="max-h-40 overflow-y-auto rounded-2xl border border-border/50 bg-secondary/40">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => pick(m)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-secondary/80 transition"
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {m.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{m.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode={unit === "g" || unit === "ml" ? "decimal" : "numeric"}
              className="h-11 w-20 rounded-2xl text-center"
              aria-label="Quantity"
            />
            <div className="flex flex-1 gap-1.5" role="group" aria-label="Unit">
              {(["pcs", "g", "ml"] as const).map((u) => {
                const active = unit === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
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

          {/* Expiry — default none */}
          <div className="rounded-3xl border border-border/45 bg-card/80 px-3.5 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Expiry</p>
                <p className="text-[11px] text-muted-foreground">
                  Optional — off by default
                </p>
              </div>
              {!trackExpiry ? (
                <button
                  type="button"
                  onClick={() => setTrackExpiry(true)}
                  className="min-h-11 shrink-0 rounded-2xl border border-border/50 bg-secondary/60 px-3.5 text-sm font-semibold active:bg-secondary"
                >
                  Add expiry
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTrackExpiry(false);
                    setExpiryDate("");
                  }}
                  className="min-h-11 shrink-0 rounded-2xl border border-border/50 bg-secondary/60 px-3.5 text-sm font-semibold active:bg-secondary"
                >
                  Clear
                </button>
              )}
            </div>
            {trackExpiry && (
              <input
                type="date"
                value={expiryDate}
                min={minDateInputValue()}
                onChange={(e) => setExpiryDate(e.target.value)}
                aria-label="Expiration date"
                className="min-h-11 w-full rounded-2xl border border-border/50 bg-secondary/50 px-3 text-[15px] font-semibold tabular-nums outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            )}
          </div>
        </div>

        <DrawerFooter className="gap-2 pb-6">
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || !!pendingMatch}
            className="w-full rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] disabled:opacity-50 transition"
          >
            {mergeHint ? "Add to existing" : "Add item"}
          </button>
          <DrawerClose asChild>
            <button
              type="button"
              className="w-full rounded-3xl border py-3 text-sm font-semibold active:bg-secondary/60"
            >
              Cancel
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
