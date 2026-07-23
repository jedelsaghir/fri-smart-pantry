/**
 * Merge OCR line items from multiple receipt photos.
 * Long receipts are captured in segments; overlapping lines are deduplicated.
 */

import { normalizeItemName, namesLookSimilar } from "@/lib/catalog";
import { sameProduct } from "@/lib/pantry-ops";
import type { OcrDetectResult, OcrLineItem } from "@/platform/types";
import type { DetectedItem, PantryItem, StorageKey } from "@/types/pantry";

export const AUTO_ADD_CONFIDENCE = 0.8;

function itemKey(name: string, unit: string): string {
  return `${normalizeItemName(name)}|${(unit || "pcs").trim().toLowerCase()}`;
}

/** Prefer longer / more specific product names when merging overlaps */
function preferName(a: string, b: string): string {
  const na = a.trim();
  const nb = b.trim();
  if (!na) return nb;
  if (!nb) return na;
  if (normalizeItemName(na) === normalizeItemName(nb)) {
    return na.length >= nb.length ? na : nb;
  }
  return na.length >= nb.length ? na : nb;
}

/**
 * Deduplicate OCR lines across photo segments.
 * Same product (name+unit) keeps the higher-confidence row; qty/price take the best available signal.
 */
export function mergeOcrLineItems(batches: OcrLineItem[][]): OcrLineItem[] {
  const map = new Map<string, OcrLineItem>();

  for (const batch of batches) {
    for (const raw of batch) {
      const name = (raw.name || "").trim();
      if (!name) continue;
      const unit = (raw.unit || "pcs").trim() || "pcs";
      const key = itemKey(name, unit);
      const item: OcrLineItem = {
        ...raw,
        name,
        unit,
        qty: Number.isFinite(raw.qty) && raw.qty > 0 ? raw.qty : 1,
        confidence: typeof raw.confidence === "number" ? raw.confidence : 0.75,
      };

      const existing = map.get(key);
      if (!existing) {
        map.set(key, item);
        continue;
      }

      const confA = existing.confidence ?? 0;
      const confB = item.confidence ?? 0;
      const winner = confB > confA ? item : existing;
      const loser = confB > confA ? existing : item;

      map.set(key, {
        ...winner,
        name: preferName(winner.name, loser.name),
        // Overlap on a multi-photo receipt is the same line — do not sum quantities
        qty: Math.max(winner.qty || 1, loser.qty || 1),
        price: winner.price ?? loser.price,
        emoji: winner.emoji || loser.emoji,
        storage: winner.storage || loser.storage,
        category: winner.category || loser.category,
        confidence: Math.max(confA, confB),
      });
    }
  }

  // Second pass: fuzzy-merge near-duplicate names with same unit (e.g. "Org Milk" vs "Organic Milk")
  const list = [...map.values()];
  const kept: OcrLineItem[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < list.length; i++) {
    if (consumed.has(i)) continue;
    let base = list[i];
    for (let j = i + 1; j < list.length; j++) {
      if (consumed.has(j)) continue;
      const other = list[j];
      const sameUnit =
        (base.unit || "pcs").trim().toLowerCase() === (other.unit || "pcs").trim().toLowerCase();
      if (!sameUnit) continue;
      if (
        normalizeItemName(base.name) === normalizeItemName(other.name) ||
        namesLookSimilar(base.name, other.name)
      ) {
        const confA = base.confidence ?? 0;
        const confB = other.confidence ?? 0;
        base = {
          ...(confB > confA ? other : base),
          name: preferName(base.name, other.name),
          qty: Math.max(base.qty || 1, other.qty || 1),
          price: (confB > confA ? other.price : base.price) ?? base.price ?? other.price,
          confidence: Math.max(confA, confB),
          emoji: base.emoji || other.emoji,
          storage: base.storage || other.storage,
        };
        consumed.add(j);
      }
    }
    kept.push(base);
  }

  return kept;
}

/** Combine multiple OCR results into one merged payload */
export function mergeOcrResults(results: OcrDetectResult[]): OcrDetectResult {
  const okResults = results.filter((r) => r.ok && r.items.length > 0);
  if (okResults.length === 0) {
    const firstFail = results.find((r) => !r.ok) || results[0];
    return {
      ok: false,
      mode: firstFail?.mode || "unavailable",
      provider: firstFail?.provider || "unknown",
      items: [],
      reason:
        firstFail?.reason ||
        "No items could be read from these photos. Try clearer, well-lit shots of the full receipt.",
    };
  }

  const items = mergeOcrLineItems(okResults.map((r) => r.items));
  const withStore = okResults.find((r) => r.store);
  const withTotal = okResults.find((r) => r.total != null);
  const withCurrency = okResults.find((r) => r.currency);

  return {
    ok: items.length > 0,
    mode: okResults[0].mode,
    provider: okResults[0].provider,
    items,
    store: withStore?.store ?? null,
    total: withTotal?.total ?? null,
    currency: withCurrency?.currency,
    reason:
      items.length === 0
        ? "Photos were readable but no line items were found. Try capturing the item list more clearly."
        : undefined,
  };
}

export type FlatPantryRef = Pick<PantryItem, "name" | "unit">;

/** True when the detected product already exists or looks very similar in the pantry */
export function matchesExistingPantry(
  item: { name: string; unit: string },
  pantry: FlatPantryRef[]
): boolean {
  return pantry.some(
    (p) => sameProduct(p, item) || namesLookSimilar(p.name, item.name)
  );
}

/**
 * Split merged detections into auto-add vs review.
 * Review: confidence &lt; 0.8 OR already in pantry / very similar.
 */
export function splitAutoAndReview(
  items: DetectedItem[],
  pantry: FlatPantryRef[]
): { autoItems: DetectedItem[]; reviewItems: DetectedItem[] } {
  const autoItems: DetectedItem[] = [];
  const reviewItems: DetectedItem[] = [];

  for (const item of items) {
    const lowConfidence = item.confidence < AUTO_ADD_CONFIDENCE;
    const similar = matchesExistingPantry(item, pantry);
    if (lowConfidence || similar) {
      reviewItems.push(item);
    } else {
      autoItems.push(item);
    }
  }

  return { autoItems, reviewItems };
}

export function ocrLinesToDetected(items: OcrLineItem[], idPrefix = "det"): DetectedItem[] {
  const stamp = Date.now();
  return items.map((row, index) => ({
    id: `${idPrefix}-${stamp}-${index}`,
    name: row.name,
    qty: row.qty,
    unit: row.unit || "pcs",
    emoji: row.emoji || "🛒",
    storage: (row.storage as StorageKey) || "fridge",
    confidence: typeof row.confidence === "number" ? row.confidence : 0.75,
    price: row.price,
  }));
}

/** Human-friendly error when all photos fail quality / OCR */
export function multiPhotoErrorMessage(results: OcrDetectResult[]): string {
  const reasons = results.map((r) => r.reason).filter(Boolean) as string[];
  const joined = reasons[0];
  if (joined && /blur|unreadable|quality|dark|incomplete/i.test(joined)) {
    return joined;
  }
  return (
    joined ||
    "Photos look blurry, incomplete, or unreadable. Retake with good light, fill the frame with the receipt, and capture each section clearly."
  );
}
