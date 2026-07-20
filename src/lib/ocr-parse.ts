/**
 * Pure OCR parsing / enrichment helpers (no React, no network).
 * Used by the server vision path and unit tests.
 */

import type { StorageKey } from "@/types/pantry";
import type { OcrLineItem } from "@/platform/types";

const EMOJI_BY_KEYWORD: Array<[RegExp, string]> = [
  [/milk|lait|milch/i, "🥛"],
  [/egg|œuf|ei\b/i, "🥚"],
  [/yogurt|yoghurt|yaourt/i, "🥣"],
  [/cheese|cheddar|fromage/i, "🧀"],
  [/spinach|salad|lettuce|basil|herb/i, "🥬"],
  [/tomato|tomate/i, "🍅"],
  [/avocado|avocat/i, "🥑"],
  [/chicken|poulet|beef|steak|meat|porc|pork/i, "🍗"],
  [/fish|salmon|shrimp|saumon/i, "🐟"],
  [/bread|pain|loaf/i, "🍞"],
  [/pasta|noodle|pâte/i, "🍝"],
  [/oil|huile|olive/i, "🫒"],
  [/berry|berries|fruit/i, "🫐"],
  [/butter|beurre/i, "🧈"],
  [/rice|riz/i, "🍚"],
  [/water|eau/i, "💧"],
  [/juice|jus/i, "🧃"],
  [/coffee|café|tea|thé/i, "☕"],
  [/wine|beer|bière/i, "🍷"],
  [/ice.?cream|glace/i, "🍨"],
];

export function emojiForItemName(name: string): string {
  for (const [re, emoji] of EMOJI_BY_KEYWORD) {
    if (re.test(name)) return emoji;
  }
  return "🛒";
}

export function guessStorage(name: string): StorageKey {
  const lower = name.toLowerCase();
  if (
    /frozen|ice.?cream|freezer|surgel|deep.?frozen/i.test(lower) ||
    /berries|ice\b/i.test(lower)
  ) {
    return "freezer";
  }
  if (
    /oil|pasta|rice|flour|cereal|can|tin|sauce|spice|sugar|salt|bean|lentil|bread|crackers|chips|biscuit|coffee|tea|wine|beer|water bottle/i.test(
      lower
    )
  ) {
    return "pantry";
  }
  // Default perishables → fridge
  return "fridge";
}

export function normalizeUnit(unit: unknown, qty: number): string {
  const u = String(unit ?? "")
    .trim()
    .toLowerCase();
  if (!u) {
    // Heuristic: large numbers often mean grams
    if (qty >= 50) return "g";
    return "pcs";
  }
  if (["pc", "pcs", "piece", "pieces", "x", "ea", "each"].includes(u)) return "pcs";
  if (["l", "lt", "liter", "litre", "liters", "litres"].includes(u)) return "L";
  if (["ml", "milliliter", "millilitre"].includes(u)) return "ml";
  if (["g", "gr", "gram", "grams"].includes(u)) return "g";
  if (["kg", "kilo", "kilogram"].includes(u)) return "kg";
  if (["pack", "packs", "pk"].includes(u)) return "pack";
  if (["bag", "bags"].includes(u)) return "bag";
  if (["bottle", "btl"].includes(u)) return "bottle";
  if (["tub", "tubs"].includes(u)) return "tub";
  if (["loaf", "loaves"].includes(u)) return "loaf";
  if (["bunch"].includes(u)) return "bunch";
  return u.slice(0, 12);
}

/** Strip markdown fences and extract first JSON object/array from model text */
export function extractJsonPayload(text: string): unknown {
  let s = text.trim();
  // ```json ... ```
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Find first { or [
  const objStart = s.indexOf("{");
  const arrStart = s.indexOf("[");
  let start = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
  else if (arrStart >= 0) start = arrStart;
  if (start < 0) throw new Error("No JSON found in model response");
  s = s.slice(start);
  // Trim trailing junk after last } or ]
  const lastBrace = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (lastBrace >= 0) s = s.slice(0, lastBrace + 1);
  return JSON.parse(s);
}

export type ParsedReceiptOcr = {
  store: string | null;
  total: number | null;
  currency: string;
  items: OcrLineItem[];
};

/**
 * Normalize model / heuristic JSON into a clean receipt parse result.
 */
export function parseReceiptOcrPayload(raw: unknown): ParsedReceiptOcr {
  let store: string | null = null;
  let total: number | null = null;
  let currency = "EUR";
  let rows: unknown[] = [];

  if (Array.isArray(raw)) {
    rows = raw;
  } else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.store === "string" && o.store.trim()) store = o.store.trim();
    if (typeof o.total === "number" && Number.isFinite(o.total)) total = o.total;
    else if (typeof o.total === "string" && o.total.trim()) {
      const n = parseFloat(o.total.replace(",", "."));
      if (Number.isFinite(n)) total = n;
    }
    if (typeof o.currency === "string" && o.currency.trim()) {
      currency = o.currency.trim().toUpperCase().slice(0, 3);
    }
    if (Array.isArray(o.items)) rows = o.items;
    else if (Array.isArray(o.line_items)) rows = o.line_items;
  }

  const items: OcrLineItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? r.description ?? r.item ?? "").trim();
    if (!name || name.length < 2) continue;

    let qty = 1;
    if (typeof r.qty === "number" && Number.isFinite(r.qty) && r.qty > 0) qty = r.qty;
    else if (typeof r.quantity === "number" && r.quantity > 0) qty = r.quantity;
    else if (typeof r.qty === "string") {
      const n = parseFloat(r.qty.replace(",", "."));
      if (Number.isFinite(n) && n > 0) qty = n;
    }
    // Cap absurd OCR qty glitches
    if (qty > 10_000) qty = 1;

    const unit = normalizeUnit(r.unit ?? r.uom, qty);

    let price: number | undefined;
    const priceRaw = r.price ?? r.line_total ?? r.amount ?? r.total;
    if (typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw >= 0) {
      price = Math.round(priceRaw * 100) / 100;
    } else if (typeof priceRaw === "string") {
      const n = parseFloat(priceRaw.replace(/[^\d.,-]/g, "").replace(",", "."));
      if (Number.isFinite(n) && n >= 0) price = Math.round(n * 100) / 100;
    }

    let confidence = 0.75;
    if (typeof r.confidence === "number" && Number.isFinite(r.confidence)) {
      confidence = Math.min(1, Math.max(0, r.confidence));
    }

    let storage: StorageKey | undefined;
    if (r.storage === "fridge" || r.storage === "freezer" || r.storage === "pantry") {
      storage = r.storage;
    } else {
      storage = guessStorage(name);
    }

    items.push({
      name: name.slice(0, 80),
      qty,
      unit,
      emoji: emojiForItemName(name),
      storage,
      confidence,
      price,
      category: typeof r.category === "string" ? r.category : undefined,
    });
  }

  if (total == null && items.some((i) => typeof i.price === "number")) {
    total =
      Math.round(items.reduce((s, i) => s + (typeof i.price === "number" ? i.price : 0), 0) * 100) /
      100;
  }

  return { store, total, currency, items };
}

export function enrichOcrItems(items: OcrLineItem[]): OcrLineItem[] {
  return items.map((item) => ({
    ...item,
    emoji: item.emoji || emojiForItemName(item.name),
    storage: item.storage || guessStorage(item.name),
    unit: normalizeUnit(item.unit, item.qty),
    confidence:
      typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.75,
  }));
}

/** Pull assistant text from xAI / OpenAI-compatible Responses API body */
export function extractResponseText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  if (typeof b.output_text === "string" && b.output_text.trim()) return b.output_text;

  // Chat completions style
  const choices = b.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const msg = (choices[0] as Record<string, unknown>).message;
    if (msg && typeof msg === "object") {
      const content = (msg as Record<string, unknown>).content;
      if (typeof content === "string") return content;
    }
  }

  // Responses API: output[].content[].text
  const output = b.output;
  if (Array.isArray(output)) {
    const parts: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as Record<string, unknown>).content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (!c || typeof c !== "object") continue;
        const t = (c as Record<string, unknown>).text;
        if (typeof t === "string") parts.push(t);
        const outputText = (c as Record<string, unknown>).output_text;
        if (typeof outputText === "string") parts.push(outputText);
      }
    }
    if (parts.length) return parts.join("\n");
  }

  return "";
}

export const RECEIPT_OCR_SYSTEM_PROMPT = `You are a receipt OCR engine for a household pantry app.
Read the receipt image and return ONLY valid JSON (no markdown) with this shape:
{
  "store": string | null,
  "total": number | null,
  "currency": "EUR" | "GBP" | "USD" | string,
  "items": [
    {
      "name": string,
      "qty": number,
      "unit": string,
      "price": number,
      "confidence": number,
      "storage": "fridge" | "freezer" | "pantry"
    }
  ]
}
Rules:
- Only include grocery / household product lines that appear on the receipt.
- Skip store address, payment, tax-only lines, card numbers, barcodes, thank-you lines.
- qty must be positive; default 1 if unclear.
- unit examples: pcs, L, ml, g, kg, pack, bag, bottle, tub, loaf.
- price is the line total for that product (not unit price) when available; omit if unknown.
- confidence is 0..1 for how sure you are of the line.
- storage is a best guess for home storage after purchase.
- Prefer short clear product names (e.g. "Whole milk" not "MILK UHT 2L 3.5%").
- If the image is not a receipt or unreadable, return {"store":null,"total":null,"currency":"EUR","items":[]}.`;
