/**
 * Pure OCR parsing / enrichment helpers (no React, no network).
 * Used by the server vision path and unit tests.
 */

import type { StorageKey } from "@/types/pantry";
import type { OcrLineItem } from "@/platform/types";
import { simplifyProductName } from "@/lib/product-name";

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
  if (["cl", "centiliter", "centilitre"].includes(u)) return "cl";
  if (["pack", "packs", "pk"].includes(u)) return "pack";
  if (["bag", "bags"].includes(u)) return "bag";
  if (["bottle", "btl"].includes(u)) return "bottle";
  if (["tub", "tubs"].includes(u)) return "tub";
  if (["loaf", "loaves"].includes(u)) return "loaf";
  if (["bunch"].includes(u)) return "bunch";
  return u.slice(0, 12);
}

/**
 * Improve qty/unit for multipack patterns in product names, e.g.:
 * - "Cola 6x330ml" → qty 6, unit pcs (count of packs/bottles)
 * - "Water 2 x 1.5L" → qty 2, unit pcs
 * - "Eggs 6-pack" / "pack of 6" → qty 6, unit pcs
 * Does not invent products — only reinterprets existing name+qty.
 */
export type MultipackResult = {
  name: string;
  qty: number;
  unit: string;
  /** e.g. "330ml" unit size for multipacks — not summed into pantry qty (M-07) */
  packSizeLabel?: string;
  /** True when qty is pack count and price is typically line total for the multipack */
  isMultipack?: boolean;
};

export function applyMultipackQtyUnit(
  name: string,
  qty: number,
  unit: string
): MultipackResult {
  let n = name.trim();
  let q = qty > 0 && Number.isFinite(qty) ? qty : 1;
  let u = unit;
  let packSizeLabel: string | undefined;
  let isMultipack = false;

  // "6x330ml", "6 x 1,5 L", "12×25cl"
  const multi = n.match(
    /(?:^|[\s(,.-])(\d{1,2})\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(ml|cl|l|g|kg)?\b/i
  );
  if (multi) {
    const packCount = parseInt(multi[1], 10);
    if (packCount >= 2 && packCount <= 48) {
      const sizeNum = multi[2].replace(",", ".");
      const sizeUnit = (multi[3] || "").toLowerCase();
      packSizeLabel = sizeUnit ? `${sizeNum}${sizeUnit}` : sizeNum;
      isMultipack = true;
      // Prefer pack count as qty when OCR left qty at 1
      if (q === 1 || q === packCount) {
        q = packCount;
        u = "pcs";
      }
      // Soften name: keep product, drop the multipack size tail when it's the only size cue
      const cleaned = n
        .replace(/\s*[-,]?\s*\d{1,2}\s*[x×]\s*\d+(?:[.,]\d+)?\s*(ml|cl|l|g|kg)?\b/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (cleaned.length >= 2) n = cleaned;
      // Keep size in name for clarity if short product name
      if (packSizeLabel && n.length < 40 && !n.includes(packSizeLabel)) {
        n = `${n} (${packCount}×${packSizeLabel})`.slice(0, 80);
      }
    }
  } else {
    // "6-pack", "6 pack", "pack of 6"
    const packOf = n.match(/\bpack\s+of\s+(\d{1,2})\b/i);
    const nPack = n.match(/\b(\d{1,2})\s*-?\s*packs?\b/i);
    const count = packOf
      ? parseInt(packOf[1], 10)
      : nPack
        ? parseInt(nPack[1], 10)
        : 0;
    if (count >= 2 && count <= 48 && (q === 1 || q === count)) {
      q = count;
      isMultipack = true;
      if (!u || u === "pcs" || u === "pack") u = "pcs";
      const cleaned = n
        .replace(/\bpack\s+of\s+\d{1,2}\b/gi, " ")
        .replace(/\b\d{1,2}\s*-?\s*packs?\b/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (cleaned.length >= 2) n = cleaned;
    }
  }

  // Qty string like "2x" already parsed poorly — leave caps
  if (q > 10_000) q = 1;
  return {
    name: n.slice(0, 80),
    qty: q,
    unit: normalizeUnit(u, q),
    packSizeLabel,
    isMultipack: isMultipack || undefined,
  };
}

export type TotalSanityResult = {
  items: OcrLineItem[];
  /** M-06: surface when line sum and receipt total disagree materially */
  mismatch?: { lineSum: number; total: number; ratio: number };
};

/**
 * Light total-vs-line-sum sanity: nudge confidence only (never add/remove items).
 * - Lines sum close to total → slight confidence boost
 * - Lines sum far off → slight confidence dip + mismatch flag for UI
 */
export function applyTotalLineSanity(
  items: OcrLineItem[],
  total: number | null | undefined
): OcrLineItem[] {
  return applyTotalLineSanityDetailed(items, total).items;
}

export function applyTotalLineSanityDetailed(
  items: OcrLineItem[],
  total: number | null | undefined
): TotalSanityResult {
  if (total == null || !Number.isFinite(total) || total <= 0 || items.length === 0) {
    return { items };
  }
  const priced = items.filter((i) => typeof i.price === "number" && i.price! > 0);
  if (priced.length < 2) return { items };

  const lineSum =
    Math.round(priced.reduce((s, i) => s + (i.price as number), 0) * 100) / 100;
  if (lineSum <= 0) return { items };

  const ratio = lineSum / total;

  // Healthy agreement
  if (ratio >= 0.88 && ratio <= 1.12) {
    return {
      items: items.map((i) => ({
        ...i,
        confidence: Math.min(
          1,
          Math.round(((typeof i.confidence === "number" ? i.confidence : 0.75) + 0.03) * 1000) /
            1000
        ),
      })),
    };
  }

  // Material mismatch — soft dip + flag for review UI
  if (ratio < 0.55 || ratio > 1.9) {
    return {
      items: items.map((i) => ({
        ...i,
        confidence: Math.max(
          0.35,
          Math.round(((typeof i.confidence === "number" ? i.confidence : 0.75) * 0.9) * 1000) /
            1000
        ),
      })),
      mismatch: { lineSum, total, ratio },
    };
  }

  // Mild disagreement — still flag softly
  if (ratio < 0.8 || ratio > 1.25) {
    return { items, mismatch: { lineSum, total, ratio } };
  }

  return { items };
}

/**
 * Confidence band for review chips (L-03).
 * Aligned with AUTO_ADD_CONFIDENCE (0.8): high ≥ 0.8, medium 0.65–0.8, low < 0.65.
 */
export type ConfidenceBand = "high" | "medium" | "low";

export const CONFIDENCE_HIGH = 0.8; // matches AUTO_ADD_CONFIDENCE
export const CONFIDENCE_MEDIUM = 0.65;

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_HIGH) return "high";
  if (confidence >= CONFIDENCE_MEDIUM) return "medium";
  return "low";
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
  /** Present when priced lines disagree with receipt total (M-06) */
  totalMismatch?: { lineSum: number; receiptTotal: number };
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

  let items: OcrLineItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    let name = String(r.name ?? r.description ?? r.item ?? "").trim();
    if (!name || name.length < 2) continue;

    let qty = 1;
    if (typeof r.qty === "number" && Number.isFinite(r.qty) && r.qty > 0) qty = r.qty;
    else if (typeof r.quantity === "number" && r.quantity > 0) qty = r.quantity;
    else if (typeof r.qty === "string") {
      // Support "2x" / "2 x 1" qty strings
      const multiQty = r.qty.match(/^(\d{1,2})\s*[x×]/i);
      if (multiQty) {
        const n = parseInt(multiQty[1], 10);
        if (n >= 1) qty = n;
      } else {
        const n = parseFloat(r.qty.replace(",", "."));
        if (Number.isFinite(n) && n > 0) qty = n;
      }
    }
    // Cap absurd OCR qty glitches
    if (qty > 10_000) qty = 1;

    let unit = normalizeUnit(r.unit ?? r.uom, qty);

    const multipack = applyMultipackQtyUnit(name, qty, unit);
    name = simplifyProductName(multipack.name);
    qty = multipack.qty;
    unit = multipack.unit;
    if (!name || name.length < 2) continue;

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
      name: name.slice(0, 40),
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

  const sanity = applyTotalLineSanityDetailed(items, total);
  items = sanity.items;

  return {
    store,
    total,
    currency,
    items,
    totalMismatch: sanity.mismatch
      ? {
          lineSum: sanity.mismatch.lineSum,
          receiptTotal: sanity.mismatch.total,
        }
      : undefined,
  };
}

export function enrichOcrItems(items: OcrLineItem[]): OcrLineItem[] {
  return items.map((item) => {
    const multi = applyMultipackQtyUnit(item.name, item.qty, item.unit || "pcs");
    const name = simplifyProductName(multi.name) || multi.name;
    return {
      ...item,
      name: name.slice(0, 40),
      qty: multi.qty,
      unit: multi.unit,
      emoji: item.emoji || emojiForItemName(name),
      storage: item.storage || guessStorage(name),
      confidence:
        typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.75,
    };
  });
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
- Never invent products that are not visible on the receipt.
- Skip store address, payment, tax-only lines, card numbers, barcodes, thank-you lines.
- qty must be positive; default 1 if unclear.
- Multipacks: "6x330ml" or "2 x 1.5L" → qty = pack count (e.g. 6 or 2), unit = pcs (or pack), name without the multipack size suffix when possible.
- unit examples: pcs, L, ml, g, kg, pack, bag, bottle, tub, loaf.
- price is the line total for that product (not unit price) when available; omit if unknown.
- confidence is 0..1 for how sure you are of the line.
- storage is a best guess for home storage after purchase.

NAME RULES (critical for pantry merge):
- name = short generic food type only (prefer 2–4 words max).
- Strip brand names, manufacturer, store private-label brands, and SKUs from the name.
- Strip size/weight from the name (put size into qty/unit instead).
- Prefer category-style labels: "Pesto", "Mozzarella", "Parmigiano", "Whole milk", "Eggs", "Cherry tomatoes", "Olive oil", "Strawberry yogurt".
- Do NOT keep brands like Granarolo, Barilla, Müller, Danone, Galbani, Philadelphia, Knorr, Maggi, Coop, Esselunga, Lidl, Aldi, etc. in the name.
- Examples:
  - "GRANAROLO MOZZARELLA 125G" → name "Mozzarella" (qty/unit from line, e.g. 125 g)
  - "BARILLA PESTO GENOVESE 190G" → "Pesto"
  - "PARMIGIANO REGGIANO GRATTUGIATO" → "Grated parmigiano" or "Parmigiano"
  - "MÜLLER STRAWBERRY YOGURT 150G" → "Strawberry yogurt" or "Yogurt"
  - "WHOLE MILK UHT 2L 3.5%" → "Whole milk" (not "MILK UHT 2L 3.5%")

- If the image is not a receipt or unreadable, return {"store":null,"total":null,"currency":"EUR","items":[]}.`;
