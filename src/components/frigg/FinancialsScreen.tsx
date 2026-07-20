"use client";

import { useMemo, useState } from "react";
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
import { ChevronRight, FileText, Image as ImageIcon, Trash2, X } from "lucide-react";
import type { StoredReceipt } from "@/types/pantry";
import {
  buildMockReceiptImage,
  createReceiptId,
  formatReceiptDate,
  readFileAsDataUrl,
} from "@/lib/receipts";
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

export function FinancialsScreen({
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
  const [logStore, setLogStore] = useState("Lidl");
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

  const categories: CategoryData[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receipts) {
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
  const storeCount = new Set(receipts.map((r) => r.store)).size;

  const pieData = categories.map((cat, i) => ({
    ...cat,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const storeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of receipts) {
      map.set(r.store, (map.get(r.store) || 0) + r.total);
    }
    return [...map.entries()]
      .map(([store, amount]) => ({ store, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [receipts]);

  const weeklyTrend = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const r of receipts) {
      const d = new Date(r.date);
      if (Number.isNaN(d.getTime())) continue;
      const weekStart = new Date(d);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
      const key = weekStart.toISOString().slice(0, 10);
      buckets.set(key, (buckets.get(key) || 0) + r.total);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([week, amount], i) => ({
        week: `W${i + 1}`,
        amount: Math.round(amount * 100) / 100,
      }));
  }, [receipts]);

  const submitLogPurchase = () => {
    const total = Math.max(0, parseFloat(logTotal.replace(",", ".")) || 0);
    if (!logStore.trim() || total <= 0) return;
    const now = new Date().toISOString();
    const store = logStore.trim();
    const lineName = logNote.trim() || "Manual purchase";
    const mockImg = buildMockReceiptImage({
      store,
      date: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      items: [{ name: lineName, qty: 1, unit: "x", price: total }],
      total,
    });
    const receipt: StoredReceipt = {
      id: createReceiptId(),
      date: now,
      store,
      total,
      currency: "EUR",
      imageDataUrl: logPhoto || mockImg,
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

      {/* By store — real data (P2-5) */}
      {storeData.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="text-sm font-semibold tracking-[0.005em] text-foreground/90">
              By store
            </div>
          </div>
          <div className="elevated-card rounded-3xl p-4">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storeData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <XAxis dataKey="store" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`€${Number(value).toFixed(2)}`, ""]}
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
          </div>
        </div>
      )}

      {/* Weekly spend trend from receipts */}
      {weeklyTrend.length > 1 && (
        <div>
          <div className="mb-3 px-1 text-sm font-semibold tracking-[0.005em] text-foreground/90">
            Weekly spend
          </div>
          <div className="elevated-card rounded-3xl p-4">
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [`€${Number(value).toFixed(2)}`, ""]}
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="amount" fill="#5f8a6e" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

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
                {/* Original photo */}
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <ImageIcon className="size-4" />
                    Original photo
                  </div>
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
      {photoFullscreen && selected && (
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
          <div className="flex flex-1 items-center justify-center p-4 overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.imageDataUrl}
              alt={`Receipt from ${selected.store}`}
              className="max-h-full max-w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
