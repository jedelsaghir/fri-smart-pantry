import type { ReceiptLineItem, StoredReceipt, StorageKey } from "@/types/pantry";

import { STORAGE_KEYS } from "@/lib/storage-keys";

export const RECEIPTS_KEY = STORAGE_KEYS.RECEIPTS;

const STORES = ["Lidl", "Tesco", "Sainsbury's", "Aldi", "Local market"];

const CATEGORY_BY_NAME: Record<string, string> = {
  milk: "Dairy",
  yogurt: "Dairy",
  cheese: "Dairy",
  egg: "Dairy",
  chicken: "Meat",
  beef: "Meat",
  fish: "Meat",
  tomato: "Produce",
  spinach: "Produce",
  avocado: "Produce",
  basil: "Produce",
  berry: "Produce",
  bread: "Bakery",
  pasta: "Pantry",
  oil: "Pantry",
};

export function categoryForName(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, cat] of Object.entries(CATEGORY_BY_NAME)) {
    if (lower.includes(key)) return cat;
  }
  return "Other";
}

/** Sensible default price basis from item unit */
export function defaultPriceUnit(unit: string): string {
  const u = unit.toLowerCase().trim();
  if (u === "g" || u === "kg") return "100g";
  if (u === "ml") return "100ml";
  if (u === "l") return "L";
  return unit;
}

export function estimateLinePrice(name: string, qty: number): number {
  const lower = name.toLowerCase();
  let unit = 1.99;
  if (lower.includes("milk")) unit = 1.29;
  else if (lower.includes("egg")) unit = 0.35;
  else if (lower.includes("yogurt")) unit = 1.89;
  else if (lower.includes("cheese") || lower.includes("cheddar")) unit = 2.45;
  else if (lower.includes("chicken")) unit = 5.99;
  else if (lower.includes("tomato")) unit = 2.19;
  else if (lower.includes("spinach")) unit = 1.49;
  else if (lower.includes("bread")) unit = 1.65;
  else if (lower.includes("oil")) unit = 4.5;
  else if (lower.includes("pasta")) unit = 1.15;
  else if (lower.includes("berry")) unit = 2.8;
  else if (lower.includes("avocado")) unit = 0.89;
  const line = unit * Math.max(1, qty > 20 ? qty / 100 : qty);
  return Math.round(line * 100) / 100;
}

/** Unit price for pantry latestPrice (not always full line total) */
export function estimateUnitPrice(name: string, qty: number, unit: string): number {
  const line = estimateLinePrice(name, qty);
  const q = Math.max(1, qty > 20 ? qty / 100 : qty);
  const per = line / q;
  return Math.round(per * 100) / 100;
}

/** Simple receipt-looking SVG as a data URL (works offline, no network) */
export function buildMockReceiptImage(opts: {
  store: string;
  date: string;
  items: { name: string; qty: number; unit: string; price: number }[];
  total: number;
}): string {
  const lines = opts.items
    .slice(0, 12)
    .map(
      (i, idx) =>
        `<text x="24" y="${110 + idx * 22}" font-family="ui-monospace,monospace" font-size="13" fill="#1a1a1a">${escapeXml(
          `${i.name.slice(0, 18).toUpperCase()}  ${i.qty}${i.unit}`.padEnd(28, " ")
        )}€${i.price.toFixed(2)}</text>`
    )
    .join("");
  const h = Math.max(320, 160 + opts.items.length * 22 + 80);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="${h}" viewBox="0 0 360 ${h}">
  <rect width="360" height="${h}" fill="#f7f4ef"/>
  <rect x="12" y="12" width="336" height="${h - 24}" rx="8" fill="#fffef9" stroke="#e5e0d8"/>
  <text x="180" y="48" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#222">${escapeXml(opts.store)}</text>
  <text x="180" y="72" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#666">${escapeXml(opts.date)}</text>
  <line x1="28" y1="88" x2="332" y2="88" stroke="#ddd" stroke-dasharray="4 3"/>
  ${lines}
  <line x1="28" y1="${h - 70}" x2="332" y2="${h - 70}" stroke="#ddd"/>
  <text x="28" y="${h - 42}" font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="#111">TOTAL</text>
  <text x="332" y="${h - 42}" text-anchor="end" font-family="ui-monospace,monospace" font-size="16" font-weight="700" fill="#111">€${opts.total.toFixed(2)}</text>
  <text x="180" y="${h - 20}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#999">Friġġ · saved receipt</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function seedReceipts(): StoredReceipt[] {
  const lidlItems: ReceiptLineItem[] = [
    { id: "rl1", name: "Whole milk", qty: 2, unit: "L", emoji: "🥛", price: 2.58, category: "Dairy" },
    { id: "rl2", name: "Free-range eggs", qty: 12, unit: "pcs", emoji: "🥚", price: 4.2, category: "Dairy" },
    { id: "rl3", name: "Greek yogurt", qty: 2, unit: "tub", emoji: "🥣", price: 3.78, category: "Dairy" },
    { id: "rl4", name: "Baby spinach", qty: 1, unit: "bag", emoji: "🥬", price: 1.49, category: "Produce" },
  ];
  const tescoItems: ReceiptLineItem[] = [
    { id: "rt1", name: "Chicken thighs", qty: 600, unit: "g", emoji: "🍗", price: 5.99, category: "Meat" },
    { id: "rt2", name: "Cherry tomatoes", qty: 1, unit: "pack", emoji: "🍅", price: 2.19, category: "Produce" },
    { id: "rt3", name: "Aged cheddar", qty: 220, unit: "g", emoji: "🧀", price: 2.45, category: "Dairy" },
  ];
  const sainsItems: ReceiptLineItem[] = [
    { id: "rs1", name: "Olive oil", qty: 1, unit: "bottle", emoji: "🫒", price: 4.5, category: "Pantry" },
    { id: "rs2", name: "Pasta", qty: 2, unit: "packs", emoji: "🍝", price: 2.3, category: "Pantry" },
    { id: "rs3", name: "Organic bread", qty: 1, unit: "loaf", emoji: "🍞", price: 1.65, category: "Bakery" },
  ];

  const mk = (
    id: string,
    store: string,
    days: number,
    items: ReceiptLineItem[]
  ): StoredReceipt => {
    const total = Math.round(items.reduce((s, i) => s + i.price, 0) * 100) / 100;
    const date = daysAgoIso(days);
    return {
      id,
      date,
      store,
      total,
      currency: "EUR",
      imageDataUrl: buildMockReceiptImage({
        store,
        date: new Date(date).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        items: items.map((i) => ({
          name: i.name,
          qty: i.qty,
          unit: i.unit,
          price: i.price,
        })),
        total,
      }),
      items,
      createdAt: date,
    };
  };

  return [
    mk("rec-seed-1", "Lidl", 2, lidlItems),
    mk("rec-seed-2", "Tesco", 5, tescoItems),
    mk("rec-seed-3", "Sainsbury's", 9, sainsItems),
  ];
}

export function loadReceipts(): StoredReceipt[] {
  if (typeof window === "undefined") return seedReceipts();
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as StoredReceipt[];
    }
  } catch {}
  const seed = seedReceipts();
  try {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(seed));
  } catch {}
  return seed;
}

export function saveReceipts(receipts: StoredReceipt[]): void {
  try {
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
  } catch {
    // localStorage full (large images) — try without largest images as last resort
    try {
      const slim = receipts.map((r) => ({
        ...r,
        imageDataUrl:
          r.imageDataUrl.length > 80_000
            ? buildMockReceiptImage({
                store: r.store,
                date: new Date(r.date).toLocaleDateString("en-GB"),
                items: r.items.map((i) => ({
                  name: i.name,
                  qty: i.qty,
                  unit: i.unit,
                  price: i.price,
                })),
                total: r.total,
              })
            : r.imageDataUrl,
      }));
      localStorage.setItem(RECEIPTS_KEY, JSON.stringify(slim));
    } catch {}
  }
}

export function createReceiptId(): string {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildReceiptFromScan(opts: {
  items: Array<{
    name: string;
    qty: number;
    unit: string;
    emoji: string;
    storage?: StorageKey;
  }>;
  imageDataUrl?: string | null;
  store?: string;
}): StoredReceipt {
  const store = opts.store || STORES[Math.floor(Math.random() * STORES.length)];
  const lineItems: ReceiptLineItem[] = opts.items.map((item, i) => ({
    id: `line-${Date.now()}-${i}`,
    name: item.name,
    qty: item.qty,
    unit: item.unit,
    emoji: item.emoji,
    price: estimateLinePrice(item.name, item.qty),
    category: categoryForName(item.name),
    storage: item.storage,
  }));
  const total = Math.round(lineItems.reduce((s, i) => s + i.price, 0) * 100) / 100;
  const now = new Date().toISOString();
  const imageDataUrl =
    opts.imageDataUrl ||
    buildMockReceiptImage({
      store,
      date: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      items: lineItems.map((i) => ({
        name: i.name,
        qty: i.qty,
        unit: i.unit,
        price: i.price,
      })),
      total,
    });

  return {
    id: createReceiptId(),
    date: now,
    store,
    total,
    currency: "EUR",
    imageDataUrl,
    items: lineItems,
    createdAt: now,
  };
}

export function formatReceiptDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
