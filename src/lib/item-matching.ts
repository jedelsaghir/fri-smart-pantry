/**
 * Deterministic fuzzy matching: OCR / receipt lines → existing pantry stock.
 * Pure JS — no external libs. Fast enough for typical household pantry sizes.
 */

import type { PantryMatchInfo, PantryMatchKind, StorageKey } from "@/types/pantry";

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Accept as a match (review or auto-update) */
export const MATCH_THRESHOLD = 0.78;
/** Strong match — high-confidence OCR may auto-update qty without review */
export const STRONG_MATCH_THRESHOLD = 0.85;
/** Treat as exact product identity */
export const EXACT_MATCH_THRESHOLD = 0.93;
/** OCR confidence required to auto-merge a strong match */
export const AUTO_UPDATE_OCR_CONFIDENCE = 0.8;

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

const UNIT_MAP: Record<string, string> = {
  l: "L",
  lt: "L",
  ltr: "L",
  liter: "L",
  litre: "L",
  liters: "L",
  litres: "L",
  ml: "ml",
  milliliter: "ml",
  millilitre: "ml",
  milliliters: "ml",
  millilitres: "ml",
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilo: "kg",
  kilogram: "kg",
  kilograms: "kg",
  pc: "pcs",
  pcs: "pcs",
  piece: "pcs",
  pieces: "pcs",
  ea: "pcs",
  each: "pcs",
  x: "pcs",
  pack: "pack",
  packs: "pack",
  pk: "pack",
  bag: "bag",
  bags: "bag",
  bottle: "bottle",
  bottles: "bottle",
  btl: "bottle",
  tub: "tub",
  tubs: "tub",
  loaf: "loaf",
  loaves: "loaf",
  bunch: "bunch",
  bunches: "bunch",
  can: "can",
  cans: "can",
  jar: "jar",
  jars: "jar",
  box: "box",
  boxes: "box",
};

/** Normalize unit aliases → canonical form (L, pcs, g, …) */
export function normalizeMatchUnit(unit: string, qty = 1): string {
  const u = String(unit ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
  if (!u) {
    if (qty >= 50) return "g";
    return "pcs";
  }
  return UNIT_MAP[u] ?? u.slice(0, 12);
}

export function unitsCompatible(a: string, b: string, qtyA = 1, qtyB = 1): boolean {
  return normalizeMatchUnit(a, qtyA) === normalizeMatchUnit(b, qtyB);
}

// ---------------------------------------------------------------------------
// Name normalization
// ---------------------------------------------------------------------------

/** Common grocery abbreviations expanded before compare */
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\borg\b/g, "organic"],
  [/\bwh\b/g, "whole"],
  [/\bwht\b/g, "white"],
  [/\bchoc\b/g, "chocolate"],
  [/\bchkn\b/g, "chicken"],
  [/\bchk\b/g, "chicken"],
  [/\bchic\b/g, "chicken"],
  [/\btom\b/g, "tomato"],
  [/\btoms\b/g, "tomatoes"],
  [/\bpot\b/g, "potato"],
  [/\bpots\b/g, "potatoes"],
  [/\bveg\b/g, "vegetable"],
  [/\bvegs\b/g, "vegetables"],
  [/\byog\b/g, "yogurt"],
  [/\byoghurt\b/g, "yogurt"],
  [/\bfr\b/g, "free range"],
  [/\bfz\b/g, "frozen"],
  [/\bfrz\b/g, "frozen"],
  [/\bsmk\b/g, "smoked"],
  [/\bunslt\b/g, "unsalted"],
  [/\bsemi\b/g, "semi skimmed"],
  [/\blf\b/g, "low fat"],
  [/\bskm\b/g, "skimmed"],
  [/\bpkd\b/g, "packaged"],
  [/\bpk\b/g, "pack"],
  [/\bbtls?\b/g, "bottle"],
];

/** Size / pack tokens stripped so "Whole milk 1L" ≈ "Whole Milk" */
const SIZE_TOKEN =
  /\b\d+([.,]\d+)?\s*(ml|l|lt|ltr|liter|litre|liters|litres|g|gr|gram|grams|kg|kilo|kilogram|kilograms|oz|lb|pcs|pc|pack|packs|pk|x)\b/gi;

/**
 * Full normalize: lowercase, expand abbreviations, drop punctuation/sizes, collapse spaces.
 */
export function normalizeMatchName(name: string): string {
  let s = String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, ""); // strip diacritics

  // Hyphens / punctuation → spaces
  s = s.replace(/[^\p{L}\p{N}\s]/gu, " ");

  // Expand abbreviations token-wise
  for (const [re, exp] of ABBREVIATIONS) {
    s = s.replace(re, exp);
  }

  // Drop size suffixes and bare numbers
  s = s.replace(SIZE_TOKEN, " ").replace(/\b\d+([.,]\d+)?\b/g, " ");

  return s.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Grocery keyword boost (optional light signal)
// ---------------------------------------------------------------------------

const GROCERY_KEYWORDS = new Set([
  "milk",
  "egg",
  "eggs",
  "yogurt",
  "cheese",
  "butter",
  "bread",
  "chicken",
  "beef",
  "pork",
  "fish",
  "salmon",
  "tomato",
  "tomatoes",
  "spinach",
  "lettuce",
  "apple",
  "banana",
  "orange",
  "berry",
  "berries",
  "pasta",
  "rice",
  "oil",
  "olive",
  "flour",
  "sugar",
  "salt",
  "coffee",
  "tea",
  "juice",
  "water",
  "yogurt",
  "cream",
  "ham",
  "bacon",
  "sausage",
  "potato",
  "onion",
  "garlic",
  "carrot",
  "cucumber",
  "pepper",
  "mushroom",
  "frozen",
  "organic",
  "whole",
  "skimmed",
  "free",
  "range",
]);

// ---------------------------------------------------------------------------
// Levenshtein (bounded pure JS)
// ---------------------------------------------------------------------------

/** Classic Levenshtein distance — O(n*m), fine for short product names */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Ensure a is shorter for less memory
  if (a.length > b.length) {
    const t = a;
    a = b;
    b = t;
  }

  const prev = new Array<number>(a.length + 1);
  const curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev[i] + 1, // delete
        curr[i - 1] + 1, // insert
        prev[i - 1] + cost // substitute
      );
    }
    for (let i = 0; i <= a.length; i++) prev[i] = curr[i];
  }
  return prev[a.length];
}

/** Similarity ratio 0–1 from Levenshtein */
export function levenshteinRatio(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

const STOP = new Set(["the", "and", "with", "for", "from", "a", "an", "of", "in", "to"]);

function tokens(normalized: string): string[] {
  return normalized.split(" ").filter((t) => t.length > 1 && !STOP.has(t));
}

function tokenJaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let shared = 0;
  sa.forEach((t) => {
    if (sb.has(t)) shared += 1;
  });
  const union = sa.size + sb.size - shared;
  return union === 0 ? 0 : shared / union;
}

function tokenCoverage(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let shared = 0;
  const smaller = sa.size <= sb.size ? sa : sb;
  const larger = sa.size <= sb.size ? sb : sa;
  smaller.forEach((t) => {
    if (larger.has(t)) shared += 1;
  });
  return shared / smaller.size;
}

function groceryKeywordBoost(aTokens: string[], bTokens: string[]): number {
  const aKeys = aTokens.filter((t) => GROCERY_KEYWORDS.has(t));
  const bKeys = bTokens.filter((t) => GROCERY_KEYWORDS.has(t));
  if (!aKeys.length || !bKeys.length) return 0;
  const setB = new Set(bKeys);
  let shared = 0;
  aKeys.forEach((k) => {
    if (setB.has(k)) shared += 1;
  });
  if (shared === 0) return 0;
  return Math.min(0.08, 0.04 * shared);
}

// ---------------------------------------------------------------------------
// Core similarity
// ---------------------------------------------------------------------------

/**
 * Fuzzy name similarity 0–1.
 * Combines: exact/core equality, containment, Levenshtein ratio, token overlap, grocery boost.
 */
export function fuzzyNameSimilarity(nameA: string, nameB: string): number {
  const a = normalizeMatchName(nameA);
  const b = normalizeMatchName(nameB);
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Containment (e.g. "milk" ⊂ "whole milk")
  let containment = 0;
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    if (shorter >= 3) {
      containment = 0.74 + 0.26 * (shorter / longer);
    }
  }

  const lev = levenshteinRatio(a, b);

  const ta = tokens(a);
  const tb = tokens(b);

  // Fuzzy token match: exact, prefix, or high per-token Levenshtein (typos like chiken/chicken)
  let fuzzyShared = 0;
  let prefixBoost = 0;
  const usedB = new Set<number>();
  for (const x of ta) {
    let best = 0;
    let bestJ = -1;
    tb.forEach((y, j) => {
      if (usedB.has(j)) return;
      if (x === y) {
        best = 1;
        bestJ = j;
        return;
      }
      if (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x))) {
        const p = 0.9;
        if (p > best) {
          best = p;
          bestJ = j;
          prefixBoost = Math.max(prefixBoost, 0.05);
        }
      }
      const r = levenshteinRatio(x, y);
      if (r >= 0.75 && r > best) {
        best = r;
        bestJ = j;
      }
    });
    if (bestJ >= 0 && best >= 0.75) {
      fuzzyShared += best;
      usedB.add(bestJ);
    }
  }

  const jaccard =
    ta.length + tb.length - fuzzyShared <= 0
      ? 0
      : fuzzyShared / (ta.length + tb.length - fuzzyShared);
  const coverage = Math.min(ta.length, tb.length) === 0
    ? 0
    : fuzzyShared / Math.min(ta.length, tb.length);
  // Fall back to strict token metrics if fuzzy path found nothing
  const strictJ = tokenJaccard(ta, tb);
  const strictC = tokenCoverage(ta, tb);
  const tokenScore =
    Math.max(jaccard, strictJ) * 0.4 + Math.max(coverage, strictC) * 0.6;

  const keywordBoost = groceryKeywordBoost(ta, tb);

  // Weighted blend — full-string Levenshtein + token overlap (typo-aware)
  let score = Math.max(containment, lev * 0.62 + tokenScore * 0.38);
  // Full-string lev alone is enough for near-identical phrases
  if (lev >= 0.85) score = Math.max(score, lev * 0.97);
  score = Math.min(1, score + prefixBoost + keywordBoost);

  // If neither tokens nor lev agree, suppress weak containment of very short strings
  if (score < MATCH_THRESHOLD && lev < 0.6 && tokenScore < 0.35) {
    return Math.min(score, 0.5);
  }

  return score;
}

// ---------------------------------------------------------------------------
// Full item ↔ pantry scoring
// ---------------------------------------------------------------------------

export type MatchableItem = {
  name: string;
  unit: string;
  qty?: number;
};

export type MatchablePantryItem = {
  id: string;
  name: string;
  unit: string;
  qty: number;
  emoji?: string;
  storage: StorageKey;
};

export type MatchScore = {
  score: number;
  kind: PantryMatchKind;
  nameScore: number;
  unitsMatch: boolean;
};

/**
 * Score one OCR/scanned line against one pantry row.
 */
export function scoreItemAgainstPantry(
  scanned: MatchableItem,
  pantry: MatchablePantryItem | { name: string; unit: string; qty?: number }
): MatchScore {
  const nameScore = fuzzyNameSimilarity(scanned.name, pantry.name);
  if (nameScore < 0.35) {
    return { score: 0, kind: "similar", nameScore, unitsMatch: false };
  }

  const qtyS = scanned.qty ?? 1;
  const qtyP = pantry.qty ?? 1;
  const sameUnit = unitsCompatible(scanned.unit || "pcs", pantry.unit || "pcs", qtyS, qtyP);

  let score = nameScore;

  if (sameUnit) {
    score = Math.min(1, score + 0.06);
  } else {
    // Different unit family is usually a different product
    score *= 0.52;
  }

  // Light qty awareness
  if (sameUnit && qtyS > 0 && qtyP > 0) {
    const ratio = Math.min(qtyS, qtyP) / Math.max(qtyS, qtyP);
    if (ratio >= 0.5) score = Math.min(1, score + 0.02);
  }

  const kind: PantryMatchKind =
    score >= EXACT_MATCH_THRESHOLD && sameUnit
      ? "exact"
      : nameScore >= STRONG_MATCH_THRESHOLD && sameUnit
        ? "exact"
        : "similar";

  // Promote exact when normalized names equal + same unit
  if (sameUnit && normalizeMatchName(scanned.name) === normalizeMatchName(pantry.name)) {
    return { score: Math.max(score, 0.98), kind: "exact", nameScore: 1, unitsMatch: true };
  }

  return { score: Math.min(1, score), kind, nameScore, unitsMatch: sameUnit };
}

/**
 * Best pantry match for a scanned line, or null below MATCH_THRESHOLD.
 */
export function findBestItemMatch(
  scanned: MatchableItem,
  pantry: MatchablePantryItem[]
): PantryMatchInfo | null {
  if (!pantry.length) return null;

  let best: PantryMatchInfo | null = null;

  for (const p of pantry) {
    const { score, kind } = scoreItemAgainstPantry(scanned, p);
    if (score < MATCH_THRESHOLD) continue;
    if (!best || score > best.score) {
      best = {
        id: p.id,
        name: p.name,
        qty: p.qty,
        unit: p.unit,
        emoji: p.emoji || "🛒",
        storage: p.storage,
        score,
        kind,
      };
    }
  }

  return best;
}

/**
 * True when OCR is high-confidence and match is strong → safe to auto-increase qty.
 */
export function isStrongUpdateCandidate(
  ocrConfidence: number,
  match: PantryMatchInfo | null | undefined
): boolean {
  if (!match) return false;
  return (
    ocrConfidence >= AUTO_UPDATE_OCR_CONFIDENCE &&
    match.score >= STRONG_MATCH_THRESHOLD &&
    (match.kind === "exact" || match.score >= STRONG_MATCH_THRESHOLD)
  );
}
