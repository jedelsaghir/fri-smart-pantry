/**
 * Store-level purchase insights for Finances "Price Trends".
 * Uses whole receipts (store + total) — not individual grocery line items.
 */

import type { StoredReceipt } from "@/types/pantry";

export type StoreMonthStats = {
  store: string;
  visits: number;
  totalSpend: number;
  avgBasket: number;
  /** Share of month spend 0–1 */
  share: number;
};

export type MonthStoreInsight = {
  /** yyyy-mm */
  monthKey: string;
  /** e.g. "July 2026" */
  monthLabel: string;
  receiptCount: number;
  monthTotal: number;
  stores: StoreMonthStats[];
  /** Best store for this month (value-oriented) */
  recommendedStore: string | null;
  /** Why that store won */
  reason: string;
  /** Actionable recommendation copy */
  recommendation: string;
};

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function parseReceiptDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normalize store name for grouping */
export function normalizeStoreName(store: string): string {
  return store.trim().replace(/\s+/g, " ") || "Unknown store";
}

/**
 * Pick the best store for a month from aggregated stats.
 * Prefers lower average basket among stores with enough visits; breaks ties by more visits.
 */
export function pickBestStore(stores: StoreMonthStats[]): {
  store: string | null;
  reason: string;
} {
  if (stores.length === 0) return { store: null, reason: "No store visits this month." };
  if (stores.length === 1) {
    return {
      store: stores[0].store,
      reason: `Only store used this month (${stores[0].visits} trip${stores[0].visits === 1 ? "" : "s"}).`,
    };
  }

  // Prefer stores with ≥2 visits when available for a fairer average
  const multi = stores.filter((s) => s.visits >= 2);
  const pool = multi.length > 0 ? multi : stores;

  const ranked = [...pool].sort((a, b) => {
    // Lower average basket = better value
    if (a.avgBasket !== b.avgBasket) return a.avgBasket - b.avgBasket;
    // More visits = more confidence
    if (b.visits !== a.visits) return b.visits - a.visits;
    // Lower total spend as weak tie-break
    return a.totalSpend - b.totalSpend;
  });

  const best = ranked[0];
  const runner = ranked[1];
  let reason = `Lowest average trip (€${best.avgBasket.toFixed(2)})`;
  if (best.visits >= 2) reason += ` across ${best.visits} visits`;
  if (runner && runner.avgBasket > best.avgBasket) {
    const save = runner.avgBasket - best.avgBasket;
    reason += ` — about €${save.toFixed(2)} less per trip than ${runner.store}`;
  }
  reason += ".";

  return { store: best.store, reason };
}

export function buildRecommendation(
  stores: StoreMonthStats[],
  recommendedStore: string | null,
  reason: string,
  monthLabel: string
): string {
  if (!recommendedStore || stores.length === 0) {
    return "Log a few receipts this month to unlock a smart store pick.";
  }

  const best = stores.find((s) => s.store === recommendedStore);
  if (!best) {
    return "Log a few receipts this month to unlock a smart store pick.";
  }

  if (stores.length === 1) {
    return `${monthLabel}: all trips were at ${best.store} (avg €${best.avgBasket.toFixed(2)}). Add another store to compare value.`;
  }

  const heaviest = [...stores].sort((a, b) => b.totalSpend - a.totalSpend)[0];
  const parts: string[] = [];

  parts.push(
    `Best pick for ${monthLabel}: shop more at ${best.store} (avg basket €${best.avgBasket.toFixed(2)}).`
  );

  if (heaviest.store !== best.store && heaviest.totalSpend > best.totalSpend) {
    parts.push(
      `You spent the most at ${heaviest.store} (€${heaviest.totalSpend.toFixed(2)}) — shifting some trips to ${best.store} could lower monthly spend.`
    );
  } else {
    parts.push(reason);
  }

  return parts.join(" ");
}

/**
 * Insights for a given calendar month (defaults to current month).
 */
export function analyzeMonthStores(
  receipts: StoredReceipt[],
  refDate: Date = new Date()
): MonthStoreInsight {
  const monthKey = monthKeyFromDate(refDate);
  const monthLabel = monthLabelFromKey(monthKey);

  const monthReceipts = receipts.filter((r) => {
    const d = parseReceiptDate(r.date);
    return d && monthKeyFromDate(d) === monthKey;
  });

  const byStore = new Map<string, { visits: number; total: number }>();
  for (const r of monthReceipts) {
    const store = normalizeStoreName(r.store);
    const cur = byStore.get(store) || { visits: 0, total: 0 };
    cur.visits += 1;
    cur.total += Math.max(0, r.total || 0);
    byStore.set(store, cur);
  }

  const monthTotal =
    Math.round(monthReceipts.reduce((s, r) => s + (r.total || 0), 0) * 100) / 100;

  const stores: StoreMonthStats[] = [...byStore.entries()]
    .map(([store, { visits, total }]) => {
      const totalSpend = Math.round(total * 100) / 100;
      const avgBasket = visits > 0 ? Math.round((total / visits) * 100) / 100 : 0;
      const share = monthTotal > 0 ? totalSpend / monthTotal : 0;
      return { store, visits, totalSpend, avgBasket, share };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);

  const { store: recommendedStore, reason } = pickBestStore(stores);
  const recommendation = buildRecommendation(stores, recommendedStore, reason, monthLabel);

  return {
    monthKey,
    monthLabel,
    receiptCount: monthReceipts.length,
    monthTotal,
    stores,
    recommendedStore,
    reason,
    recommendation,
  };
}

/** Monthly totals per store for a simple multi-month trend chart (last N months) */
export function monthlyStoreTrend(
  receipts: StoredReceipt[],
  monthsBack = 4,
  refDate: Date = new Date()
): Array<{ month: string; monthKey: string; store: string; amount: number }> {
  const rows: Array<{ month: string; monthKey: string; store: string; amount: number }> = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    const insight = analyzeMonthStores(receipts, d);
    for (const s of insight.stores.slice(0, 4)) {
      rows.push({
        month: d.toLocaleDateString("en-GB", { month: "short" }),
        monthKey: insight.monthKey,
        store: s.store,
        amount: s.totalSpend,
      });
    }
  }
  return rows;
}
