"use client";

import { useMemo, useState, memo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight, FileText, Image as ImageIcon, Trash2, X, Store, Sparkles } from "lucide-react";
import type { StoredReceipt } from "@/types/pantry";
import {
  createReceiptId,
  formatReceiptDate,
  readFileAsDataUrl,
} from "@/lib/receipts";
import { analyzeMonthStores } from "@/lib/store-insights";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

interface CategoryData {
  name: string;
  amount: number;
}

const CATEGORY_COLORS = [
  "#4a7c59",
  "#8b5e3c",
  "#5f8a6e",
  "#c5a16e",
  "#6b7f6b",
  "#7a8a9a",
];

function FinancialsScreenInner({
  receipts,
  onDeleteReceipt,
  onAddReceipt,
}: {
  receipts: StoredReceipt[];
  onDeleteReceipt?: (id: string) => void;
  onAddReceipt?: (receipt: StoredReceipt) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logStore, setLogStore] = useState("");
  const [logTotal, setLogTotal] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logPhoto, setLogPhoto] = useState<string | null>(null);

  const selected = useMemo(
    () => receipts.find((r) => r.id === selectedId) ?? null,
    [receipts, selectedId]
  );

  const totalSpent = useMemo(
    () => Math.round(receipts.reduce((s, r) => s + r.total, 0) * 100) / 100,
    [receipts]
  );

  /** Category spend from receipt line categories (not per-SKU price history) */
  const categories: CategoryData[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receipts) {
      if (r.items.length === 0) {
        // Manual total-only receipts count as Other
        map.set("Other", (map.get("Other") || 0) + r.total);
        continue;
      }
      for (const item of r.items) {
        const cat = item.category || "Other";
        map.set(cat, (map.get(cat) || 0) + item.price);
      }
    }
    return [...map.entries()]
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [receipts]);

  const categoryTotal = categories.reduce((sum, c) => sum + c.amount, 0);
  const totalFormatted = totalSpent.toFixed(2);
  const storeCount = new Set(receipts.map((r) => r.store).filter(Boolean)).size;

  const pieData = categories.map((cat, i) => ({
    ...cat,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  /** This month's store-level value analysis (Price Trends) */
  const monthInsight = useMemo(() => analyzeMonthStores(receipts), [receipts]);

  const storeData = useMemo(
    () =>
      monthInsight.stores.map((s) => ({
        store: s.store.length > 10 ? `${s.store.slice(0, 9)}…` : s.store,
        fullStore: s.store,
        amount: s.totalSpend,
        avg: s.avgBasket,
        visits: s.visits,
      })),
    [monthInsight]
  );

  const submitLogPurchase = () => {
    const total = Math.max(0, parseFloat(logTotal.replace(",", ".")) || 0);
    if (!logStore.trim() || total <= 0) return;
    const now = new Date().toISOString();
    const store = logStore.trim();
    const lineName = logNote.trim() || "Manual purchase";
    const receipt: StoredReceipt = {
      id: createReceiptId(),
      date: now,
      store,
      total,
      currency: "EUR",
      // Only a real photo the user attached — never a generated fake receipt image
      imageDataUrl: logPhoto || "",
      items: [
        {
          id: `line-${Date.now()}`,
          name: lineName,
          qty: 1,
          unit: "x",
          emoji: "🧾",
          price: total,
          category: "Other",
        },
      ],
      createdAt: now,
      note: logNote.trim() || undefined,
    };
    onAddReceipt?.(receipt);
    setLogOpen(false);
    setLogTotal("");
    setLogNote("");
    setLogPhoto(null);
  };

  return (
    <div className="space-y-6 pb-4">
      {/* Hero total */}
      <div className="elevated-card rounded-3xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground tracking-[0.01em]">
              Total from saved receipts
            </div>
            <div className="mt-1 font-display text-[42px] leading-none font-medium tracking-[-0.025em] text-foreground">
              €{totalFormatted}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {receipts.length} receipt{receipts.length === 1 ? "" : "s"}
              {storeCount > 0 ? ` · ${storeCount} store${storeCount === 1 ? "" : "s"}` : ""}
            </div>
          </div>
          {onAddReceipt && (
            <button
              type="button"
              onClick={() => setLogOpen(true)}
              className="shrink-0 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
            >
              + Log purchase
            </button>
          )}
        </div>
        {logOpen && (
          <div className="mt-4 space-y-2 border-t border-border/40 pt-4">
            <Input
              value={logStore}
              onChange={(e) => setLogStore(e.target.value)}
              placeholder="Store"
              className="h-11 rounded-2xl"
            />
            <Input
              value={logTotal}
              onChange={(e) => setLogTotal(e.target.value)}
              placeholder="Total €"
              inputMode="decimal"
              className="h-11 rounded-2xl"
            />
            <Input
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              placeholder="Note (optional)"
              className="h-11 rounded-2xl"
            />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 py-3 text-xs font-semibold active:bg-secondary/50">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    setLogPhoto(await readFileAsDataUrl(file));
                  } catch {
                    setLogPhoto(null);
                  }
                }}
              />
              {logPhoto ? "Photo attached ✓" : "Attach photo (optional)"}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLogOpen(false);
                  setLogPhoto(null);
                }}
                className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitLogPurchase}
                className="flex-1 rounded-2xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Category breakdown from real receipts */}
      {categories.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-sm font-semibold tracking-[0.005em] text-foreground/90">
              By category
            </div>
            <div className="text-[11px] text-muted-foreground">€{categoryTotal.toFixed(1)}</div>
          </div>

          <div className="elevated-card rounded-3xl p-4">
            <div className="h-[200px] -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={54}
                    outerRadius={86}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`€${Number(value).toFixed(2)}`, ""]}
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-1 space-y-2">
              {categories.map((cat, i) => {
                const pct =
                  categoryTotal > 0 ? Math.round((cat.amount / categoryTotal) * 100) : 0;
                return (
                  <li key={cat.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-foreground/90">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                      />
                      {cat.name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      €{cat.amount.toFixed(1)} · {pct}%
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Price Trends — best store for this month (not per-item price tracking) */}
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="text-sm font-semibold tracking-[0.005em] text-foreground/90">
            Price Trends
          </div>
          <div className="text-[11px] text-muted-foreground">{monthInsight.monthLabel}</div>
        </div>

        <div className="elevated-card space-y-4 rounded-3xl p-4">
          {monthInsight.receiptCount === 0 ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-2 grid size-12 place-items-center rounded-2xl bg-secondary text-xl">
                <Store className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No trips this month yet</p>
              <p className="mx-auto mt-1 max-w-[260px] text-[12px] text-muted-foreground">
                Save receipts or log purchases — we compare stores by trip totals, not individual
                item prices.
              </p>
            </div>
          ) : (
            <>
              {/* Smart recommendation */}
              <div className="rounded-2xl bg-[color-mix(in_oklab,var(--color-fresh)_10%,var(--color-secondary))] px-3.5 py-3 ring-1 ring-[color-mix(in_oklab,var(--color-fresh)_22%,transparent)]">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-fresh)]">
                  <Sparkles className="size-3.5" />
                  Smart pick
                </div>
                {monthInsight.recommendedStore && (
                  <p className="font-display text-[20px] font-medium tracking-[-0.02em] text-foreground">
                    {monthInsight.recommendedStore}
                  </p>
                )}
                <p className="mt-1 text-[13px] leading-snug text-foreground/85">
                  {monthInsight.recommendation}
                </p>
                {monthInsight.reason && monthInsight.stores.length > 1 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{monthInsight.reason}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-[12px] text-muted-foreground px-0.5">
                <span>
                  {monthInsight.receiptCount} trip
                  {monthInsight.receiptCount === 1 ? "" : "s"} this month
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  €{monthInsight.monthTotal.toFixed(2)}
                </span>
              </div>

              {/* Per-store month breakdown */}
              <ul className="space-y-2">
                {monthInsight.stores.map((s) => {
                  const isBest = s.store === monthInsight.recommendedStore;
                  return (
                    <li
                      key={s.store}
                      className={
                        "flex items-center gap-3 rounded-2xl px-3 py-2.5 ring-1 " +
                        (isBest
                          ? "bg-[color-mix(in_oklab,var(--color-fresh)_8%,transparent)] ring-[color-mix(in_oklab,var(--color-fresh)_28%,transparent)]"
                          : "bg-secondary/45 ring-border/30")
                      }
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/70">
                        <Store className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                            {s.store}
                          </p>
                          {isBest && (
                            <span className="shrink-0 rounded-full bg-[color-mix(in_oklab,var(--color-fresh)_18%,transparent)] px-2 py-px text-[10px] font-semibold text-[var(--color-fresh)]">
                              Best value
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {s.visits} visit{s.visits === 1 ? "" : "s"} · avg €
                          {s.avgBasket.toFixed(2)} / trip
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          €{s.totalSpend.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">
                          {Math.round(s.share * 100)}%
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {storeData.length > 1 && (
                <div className="h-[160px] pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={storeData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <XAxis dataKey="store" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number, _n, item) => {
                          const row = item?.payload as { avg?: number; visits?: number };
                          return [
                            `€${Number(value).toFixed(2)} total · avg €${(row?.avg ?? 0).toFixed(2)} (${row?.visits ?? 0} trips)`,
                            "Spend",
                          ];
                        }}
                        contentStyle={{
                          backgroundColor: "var(--color-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="amount" fill="#4a7c59" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-[11px] leading-snug text-muted-foreground px-0.5">
                Based on whole-receipt totals by store this month — not item-by-item price history.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Receipts archive */}
      <div>
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="text-sm font-semibold tracking-[0.005em] text-foreground/90">
            Receipts
          </div>
          <div className="text-[11px] text-muted-foreground">
            Photo + breakdown
          </div>
        </div>

        {receipts.length === 0 ? (
          <div className="elevated-card rounded-3xl px-5 py-10 text-center">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-secondary text-2xl">
              🧾
            </div>
            <p className="font-semibold text-foreground">No receipts yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-[240px] mx-auto">
              Scan a receipt from the pantry tab — it will appear here with the photo and line items.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {receipts.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFullscreen(false);
                    setSelectedId(r.id);
                  }}
                  className="elevated-card flex w-full items-center gap-3 rounded-3xl px-3.5 py-3 text-left active:scale-[0.99] transition"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-secondary ring-1 ring-border/40">
                    {r.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.imageDataUrl}
                        alt=""
                        className="size-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="grid size-full place-items-center text-muted-foreground">
                        <FileText className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold tracking-[-0.01em] text-foreground">
                        {r.store}
                      </p>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        €{r.total.toFixed(2)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {formatReceiptDate(r.date)} · {r.items.length} item
                      {r.items.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Receipt detail drawer */}
      <Drawer
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setPhotoFullscreen(false);
          }
        }}
      >
        <DrawerContent className="max-w-md mx-auto max-h-[92dvh]">
          {selected && (
            <>
              <DrawerHeader className="text-left pb-2">
                <DrawerTitle className="text-[20px] tracking-[-0.015em]">
                  {selected.store}
                </DrawerTitle>
                <p className="text-sm text-muted-foreground">
                  {formatReceiptDate(selected.date)} · €{selected.total.toFixed(2)}
                </p>
              </DrawerHeader>

              <div className="overflow-y-auto px-5 pb-2 space-y-5 max-h-[min(62dvh,520px)]">
                {/* Original photo (only if user attached one) */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <ImageIcon className="size-4" />
                    Original photo
                  </div>
                  {selected.imageDataUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPhotoFullscreen(true)}
                        className="block w-full overflow-hidden rounded-3xl border border-border/50 bg-secondary/40 active:opacity-95"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selected.imageDataUrl}
                          alt={`Receipt from ${selected.store}`}
                          className="mx-auto max-h-64 w-full object-contain"
                        />
                      </button>
                      <p className="mt-1.5 text-[11px] text-muted-foreground px-0.5">
                        Tap image to view full size
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border/60 bg-secondary/30 px-4 py-10 text-center">
                      <FileText className="size-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No photo attached</p>
                    </div>
                  )}
                </div>

                {/* Purchase breakdown */}
                <div>
                  <div className="mb-2 flex items-center justify-between px-0.5">
                    <div className="text-sm font-semibold">Purchase breakdown</div>
                    <div className="text-[11px] text-muted-foreground">
                      {selected.items.length} lines
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {selected.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-2xl bg-secondary/55 px-3 py-2.5 ring-1 ring-border/25"
                      >
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/70 text-xl">
                          {item.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold tracking-[-0.01em]">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {item.qty} {item.unit}
                            {item.category ? ` · ${item.category}` : ""}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          €{item.price.toFixed(2)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between px-1 pt-1 border-t border-border/40">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-base font-semibold tabular-nums">
                      €{selected.total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {onDeleteReceipt && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteReceipt(selected.id);
                      setSelectedId(null);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-3xl border border-destructive/30 py-3 text-sm font-semibold text-destructive active:bg-destructive/10 transition"
                  >
                    <Trash2 className="size-4" />
                    Delete receipt
                  </button>
                )}
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
          )}
        </DrawerContent>
      </Drawer>

      {/* Fullscreen photo */}
      {photoFullscreen && selected?.imageDataUrl && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/90"
          role="dialog"
          aria-label="Receipt photo"
        >
          <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
            <p className="text-sm font-medium text-white/90 truncate">
              {selected.store} · {formatReceiptDate(selected.date)}
            </p>
            <button
              type="button"
              onClick={() => setPhotoFullscreen(false)}
              className="grid size-10 place-items-center rounded-full bg-white/10 text-white"
              aria-label="Close photo"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4 overflow-auto overscroll-contain">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.imageDataUrl}
              alt={`Receipt from ${selected.store}`}
              className="max-h-full max-w-full object-contain rounded-lg"
              decoding="async"
              loading="eager"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export const FinancialsScreen = memo(FinancialsScreenInner);
FinancialsScreen.displayName = "FinancialsScreen";
