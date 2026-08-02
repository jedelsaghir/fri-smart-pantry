"use client";

import { useMemo, useState } from "react";
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

export function PantryAddSheet({
  open,
  onOpenChange,
  storage,
  suggest,
  onAdd,
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
  }) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [emoji, setEmoji] = useState("🛒");
  const [qty, setQty] = useState("1");
  const [barcode, setBarcode] = useState<string | undefined>();

  const matches = useMemo(() => suggest(name), [name, suggest]);

  const reset = () => {
    setName("");
    setUnit("pcs");
    setEmoji("🛒");
    setQty("1");
    setBarcode(undefined);
  };

  const pick = (item: CatalogItem) => {
    setName(item.name);
    setUnit(item.unit);
    setEmoji(item.emoji);
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    const raw = qty.replace(",", ".").trim();
    const parsed =
      unit === "g" || unit === "ml" ? parseFloat(raw) : parseInt(raw, 10);
    const q = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    onAdd({
      name: n,
      unit: unit.trim() || "pcs",
      emoji: emoji.trim() || "🛒",
      qty: q,
      minStock: 1,
      barcode,
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
            Name the item, pick a unit (pcs / g / ml), optional barcode.
          </p>
        </DrawerHeader>

        <div className="space-y-3 px-5 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <BarcodeAssistButton
              label="Scan or type barcode"
              onPrefill={(r) => {
                if (r.name) setName(r.name);
                if (r.unit) {
                  const u = r.unit.trim().toLowerCase();
                  if (u === "pcs" || u === "g" || u === "ml") setUnit(u);
                  else if (u === "kg") setUnit("g");
                  else if (u === "l") setUnit("ml");
                  else setUnit(r.unit);
                }
                if (r.emoji) setEmoji(r.emoji);
                setBarcode(r.barcode);
              }}
            />
            {barcode && (
              <span className="rounded-full bg-secondary/80 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                Code {barcode}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Camera scan when supported — or type a GTIN inside the scanner.
          </p>

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
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
              autoFocus
              className="h-12 flex-1 rounded-2xl text-[15px]"
              aria-label="Item name"
            />
          </div>

          {name.trim().length > 0 && matches.length > 0 && (
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
        </div>

        <DrawerFooter className="gap-2 pb-6">
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="w-full rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] disabled:opacity-50 transition"
          >
            Add item
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
