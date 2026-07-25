/**
 * Merge OCR line items from multiple receipt photos.
 * Long receipts are captured in segments; overlapping lines are deduplicated.
 * Pantry matching delegated to src/lib/item-matching.ts (Levenshtein fuzzy).
 */

import { coreItemName, namesLookSimilar, normalizeItemName } from "@/lib/catalog";
import {
  AUTO_UPDATE_OCR_CONFIDENCE,
  EXACT_MATCH_THRESHOLD,
  MATCH_THRESHOLD,
  findBestItemMatch,
  isStrongUpdateCandidate,
  normalizeMatchName,
  normalizeMatchUnit,
  scoreItemAgainstPantry,
  unitsCompatible,
  type MatchablePantryItem,
} from "@/lib/item-matching";
import {
  classifyPantryEligibility,
  isPossiblyNonFood,
  shouldAutoExcludeNonPantry,
} from "@/lib/non-pantry";
import type { OcrDetectResult, OcrLineItem } from "@/platform/types";
import type {
  DetectedItem,
  PantryItem,
  PantryMatchInfo,
  ReviewDisposition,
  StorageKey,
} from "@/types/pantry";

export const AUTO_ADD_CONFIDENCE = AUTO_UPDATE_OCR_CONFIDENCE;

/** @deprecated use MATCH_THRESHOLD from item-matching */
export const MATCH_SCORE_THRESHOLD = MATCH_THRESHOLD;
/** @deprecated use EXACT_MATCH_THRESHOLD from item-matching */
export const EXACT_MATCH_SCORE = EXACT_MATCH_THRESHOLD;

function itemKey(name: string, unit: string, qty = 1): string {
  const core = normalizeMatchName(name) || coreItemName(name) || normalizeItemName(name);
  return `${core}|${normalizeMatchUnit(unit, qty)}`;
}

function canonicalUnit(unit: string, qty = 1): string {
  return normalizeMatchUnit(unit, qty);
}

function unitsMatch(a: string, b: string, qtyA = 1, qtyB = 1): boolean {
  return unitsCompatible(a, b, qtyA, qtyB);
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
  // Prefer name without trailing size noise when equal core
  if (coreItemName(na) === coreItemName(nb)) {
    return na.length <= nb.length ? na : nb;
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
      const qty = Number.isFinite(raw.qty) && raw.qty > 0 ? raw.qty : 1;
      const unit = canonicalUnit(raw.unit || "pcs", qty);
      const key = itemKey(name, unit, qty);
      const item: OcrLineItem = {
        ...raw,
        name,
        unit,
        qty,
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
      if (!unitsMatch(base.unit || "pcs", other.unit || "pcs", base.qty, other.qty)) continue;
      if (
        normalizeItemName(base.name) === normalizeItemName(other.name) ||
        coreItemName(base.name) === coreItemName(other.name) ||
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

/** Flat pantry row used for matching (includes id for merge targets) */
export type FlatPantryRef = Pick<PantryItem, "id" | "name" | "unit" | "qty" | "emoji"> & {
  storage: StorageKey;
};

/** @deprecated Prefer FlatPantryRef with id — kept for older call sites */
export type FlatPantryNameUnit = Pick<PantryItem, "name" | "unit">;

/**
 * Score a scanned line against one pantry row (wrapper → item-matching).
 */
export function scorePantryCandidate(
  item: { name: string; unit: string; qty?: number },
  pantry: FlatPantryNameUnit & { qty?: number }
): { score: number; kind: PantryMatchInfo["kind"] } {
  const { score, kind } = scoreItemAgainstPantry(item, {
    id: "tmp",
    name: pantry.name,
    unit: pantry.unit,
    qty: pantry.qty ?? 0,
    storage: "fridge",
  });
  return { score, kind };
}

/** Best pantry match for a scanned line (wrapper → item-matching.findBestItemMatch) */
export function findBestPantryMatch(
  item: { name: string; unit: string; qty?: number },
  pantry: FlatPantryRef[]
): PantryMatchInfo | null {
  const rows: MatchablePantryItem[] = pantry.map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    qty: p.qty,
    emoji: p.emoji,
    storage: p.storage,
  }));
  return findBestItemMatch(item, rows);
}

/** True when the detected product already exists or looks very similar in the pantry */
export function matchesExistingPantry(
  item: { name: string; unit: string; qty?: number },
  pantry: Array<FlatPantryNameUnit | FlatPantryRef>
): boolean {
  if (!pantry.length) return false;
  const full = pantry.filter((p): p is FlatPantryRef => "id" in p && "storage" in p);
  if (full.length) return findBestPantryMatch(item, full) != null;

  return pantry.some((p) => {
    const { score } = scorePantryCandidate(item, p);
    return score >= MATCH_THRESHOLD;
  });
}

function defaultDisposition(match: PantryMatchInfo | null): ReviewDisposition {
  if (!match) return "add_new";
  // Prefer restocking matched stock
  return "merge";
}

/**
 * Split merged detections into auto-add vs review.
 *
 * - High-confidence non-pantry → excluded (no add, no review)
 * - Uncertain non-food → Review with possiblyNonFood flag (Keep / Discard)
 * - High conf + no match → auto-add (new item)
 * - High conf + strong match → auto-update candidate (merge qty, silent)
 * - Low conf or weaker match → Review (show matched item + Update / Add new)
 */
export function splitAutoAndReview(
  items: DetectedItem[],
  pantry: Array<FlatPantryNameUnit | FlatPantryRef>
): {
  autoItems: DetectedItem[];
  reviewItems: DetectedItem[];
  /** High-confidence non-pantry lines dropped from pantry processing */
  excludedItems: DetectedItem[];
} {
  const autoItems: DetectedItem[] = [];
  const reviewItems: DetectedItem[] = [];
  const excludedItems: DetectedItem[] = [];

  const fullPantry: FlatPantryRef[] = pantry
    .filter((p): p is FlatPantryRef => "id" in p && typeof (p as FlatPantryRef).id === "string")
    .map((p) => ({
      id: (p as FlatPantryRef).id,
      name: p.name,
      unit: p.unit,
      qty: (p as FlatPantryRef).qty ?? 0,
      emoji: (p as FlatPantryRef).emoji || "🛒",
      storage: (p as FlatPantryRef).storage || "fridge",
    }));

  const nameOnly = fullPantry.length === 0;

  for (const item of items) {
    // --- Non-pantry filter (before food matching) ---
    const eligibility = classifyPantryEligibility(item.name, {
      ocrConfidence: item.confidence,
    });

    if (shouldAutoExcludeNonPantry(eligibility)) {
      excludedItems.push({
        ...item,
        possiblyNonFood: true,
        nonFoodReason: eligibility.category || eligibility.reason,
      });
      continue;
    }

    const possiblyNonFood = isPossiblyNonFood(eligibility);
    const lowConfidence = item.confidence < AUTO_ADD_CONFIDENCE;

    let match: PantryMatchInfo | null = null;
    // Don't match non-food suspects against pantry stock
    if (!possiblyNonFood) {
      if (fullPantry.length) {
        match = findBestPantryMatch(item, fullPantry);
      } else if (nameOnly) {
        const synthetic: FlatPantryRef[] = pantry.map((p, i) => ({
          id: `syn-${i}`,
          name: p.name,
          unit: p.unit,
          qty: (p as { qty?: number }).qty ?? 0,
          emoji: "🛒",
          storage: "fridge" as StorageKey,
        }));
        match = findBestPantryMatch(item, synthetic);
      }
    }

    const strongUpdate = !possiblyNonFood && isStrongUpdateCandidate(item.confidence, match);

    const enriched: DetectedItem = {
      ...item,
      pantryMatch: match ?? undefined,
      disposition: possiblyNonFood ? "add_new" : defaultDisposition(match),
      storage: match?.storage ?? item.storage,
      possiblyNonFood: possiblyNonFood || undefined,
      nonFoodReason: possiblyNonFood
        ? eligibility.category || eligibility.reason
        : undefined,
    };

    if (possiblyNonFood) {
      // Uncertain → always manual review (Keep / Discard)
      reviewItems.push(enriched);
    } else if (strongUpdate && match) {
      autoItems.push({
        ...enriched,
        disposition: "merge",
        pantryMatch: match,
      });
    } else if (lowConfidence || match) {
      reviewItems.push(enriched);
    } else {
      autoItems.push({ ...item, disposition: "add_new" });
    }
  }

  return { autoItems, reviewItems, excludedItems };
}

export function ocrLinesToDetected(items: OcrLineItem[], idPrefix = "det"): DetectedItem[] {
  const stamp = Date.now();
  return items.map((row, index) => ({
    id: `${idPrefix}-${stamp}-${index}`,
    name: row.name,
    qty: row.qty,
    unit: canonicalUnit(row.unit || "pcs", row.qty),
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
  if (joined && /timeout|network|fetch|failed/i.test(joined)) {
    return "We couldn’t reach the scanner. Check your connection and try again.";
  }
  if (joined && /key|config|unavailable/i.test(joined)) {
    return "Receipt reading isn’t configured on this server yet. You can still add items manually.";
  }
  return (
    joined ||
    "We couldn’t read those photos. Retake with steady hands, good light, and the full receipt filling the frame — long receipts work better as a few clear sections."
  );
}
