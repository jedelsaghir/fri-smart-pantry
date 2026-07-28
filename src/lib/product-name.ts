/**
 * Deterministic OCR product-name cleanup: strip brands / marketing / size
 * so pantry rows merge as generic food types (e.g. "Mozzarella", "Pesto").
 */

/** Common EU grocery brands / private labels (extensible). */
export const BRAND_TOKENS: string[] = [
  // Dairy / cheese
  "granarolo",
  "galbani",
  "parmalat",
  "lactalis",
  "danone",
  "müller",
  "muller",
  "activia",
  "philadelphia",
  "president",
  "président",
  "elle&vire",
  "elle et vire",
  "valio",
  "arla",
  "kerrygold",
  "milbona",
  "pireu",
  "yoplait",
  "fage",
  "oikos",
  "skyr",
  // Pasta / sauce / dry
  "barilla",
  "de cecco",
  "rummo",
  "divella",
  "mutti",
  "cirio",
  "knorr",
  "maggi",
  "heinz",
  "hellmann",
  "hellmann's",
  "calvé",
  "calve",
  "bertolli",
  "sacla",
  "buitoni",
  "old el paso",
  "uncle ben",
  "uncle ben's",
  // Meat / deli
  "negroni",
  "rovagnati",
  "citterio",
  "aoste",
  "herta",
  // Snacks / drinks
  "coca-cola",
  "coca cola",
  "pepsi",
  "fanta",
  "san pellegrino",
  "sanpellegrino",
  "ferrero",
  "nutella",
  "haribo",
  "lay's",
  "lays",
  "pringles",
  "red bull",
  // Retail private label
  "coop",
  "conad",
  "esselunga",
  "carrefour",
  "lidl",
  "aldi",
  "penny",
  "eurospin",
  "despar",
  "auchan",
  "spar",
  "rewe",
  "edeka",
  "migros",
  "monoprix",
  "intermarche",
  "intermarché",
  "leclerc",
  "tesco",
  "sainsbury",
  "sainsbury's",
  "asda",
  "morrisons",
  "waitrose",
  "marks & spencer",
  "m&s",
  "picard",
  "findus",
  "iglo",
  "bonduelle",
  // Personal care noise (if OCR picks them up)
  "nivea",
  "dove",
  "colgate",
  "oral-b",
  "always",
  "pampers",
];

/** Size / multipack tails (keep qty/unit elsewhere). */
const SIZE_TAIL =
  /\b\d+([.,]\d+)?\s*(ml|cl|l|lt|ltr|litre|liter|g|gr|gram|grams|kg|kilo|oz|lb|pcs?|x)\b/gi;

const MULTIPACK_TAIL =
  /\b\d{1,2}\s*[x×]\s*\d+([.,]\d+)?\s*(ml|cl|l|g|kg)?\b/gi;

const PACK_OF = /\b(pack|pk|packs)\s*(of\s*)?\d{1,2}\b/gi;
const OF_PACK = /\b\d{1,2}\s*[- ]?(pack|pk|pcs|pieces)\b/gi;

/** Marketing / process noise when a food word remains. */
const MARKETING_NOISE =
  /\b(uht|bio|organic|biologico|biologique|naturale|natural|premium|classico|classica|tradizionale|extra\s*fine|extrafine|selezione|selection|selected|speciale|special|deluxe|gourmet|fresh\s*pack|nuovo|new|limited|edition|light|zero|light\s*&?\s*free)\b/gi;

/** "3.5%" / "3,5 % fat" — avoid \b after % (fails on word boundary). */
const FAT_PERCENT = /\b\d+([.,]\d+)?\s*%(?:\s*(?:fat|mg|m\.g\.|materia\s*grassa))?/gi;

/** Regional / style words when a primary food type is already present. */
const STYLE_SECONDARY =
  /\b(genovese|trapanese|reggiano|padano|di\s*bufala|bufala|affumicat\w*|fresco|fresca|intera|intero)\b/gi;

const SKU_NOISE = /\b[A-Z]{0,3}\d{4,}\b/g;

/** IT/FR process → English food words (before secondary strip). */
const PROCESS_MAP: Array<[RegExp, string]> = [
  [/\bgrattugiat\w*\b/gi, "grated"],
  [/\baffettat\w*\b/gi, "sliced"],
  [/\bintegrale\b/gi, "wholemeal"],
  [/\bscremato\b/gi, "skimmed"],
  [/\bparzialmente\s+scremato\b/gi, "semi-skimmed"],
];

/** Build a case-insensitive brand stripper (longest first). */
function brandPattern(): RegExp {
  const sorted = [...BRAND_TOKENS].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "gi");
}

const BRAND_RE = brandPattern();

/** Title-case words; keep short connectors lowercase when mid-phrase. */
export function titleCaseName(s: string): string {
  const small = new Set(["and", "or", "of", "with", "a", "an", "the", "di", "de", "du", "da", "e"]);
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      // Preserve short all-caps units already stripped; normal words:
      if (w.length <= 2 && /^[a-z]+$/i.test(w)) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Collapse OCR product lines to a short generic food type.
 * - Strips brands, sizes, multipack tails, % fat, marketing fluff
 * - Title-cases; max ~40 chars
 * - Falls back to a lightly cleaned original if stripping empties the name
 */
export function simplifyProductName(raw: string): string {
  const original = String(raw ?? "").trim();
  if (!original) return "";

  let s = original;

  // Normalize separators
  s = s.replace(/[_/|]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Strip brands first (before lower-only transforms lose word boundaries)
  s = s.replace(BRAND_RE, " ");

  // Size / multipack / pack counts
  s = s.replace(MULTIPACK_TAIL, " ");
  s = s.replace(SIZE_TAIL, " ");
  s = s.replace(PACK_OF, " ");
  s = s.replace(OF_PACK, " ");
  s = s.replace(FAT_PERCENT, " ");
  s = s.replace(MARKETING_NOISE, " ");
  s = s.replace(SKU_NOISE, " ");

  for (const [re, rep] of PROCESS_MAP) {
    s = s.replace(re, rep);
  }

  // Parenthetical marketing leftovers
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/\[[^\]]*\]/g, " ");

  // Punctuation noise
  s = s.replace(/[*"'`´]+/g, " ");
  s = s.replace(/[,;:]+/g, " ");
  s = s.replace(/\s*[-–—]+\s*/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Drop leftover pure numbers and bare % fragments
  s = s
    .split(/\s+/)
    .filter((t) => t.length > 0 && !/^\d+([.,]\d+)?%?$/.test(t) && t !== "%")
    .join(" ")
    .trim();

  // Strip style/region secondaries when a primary food word remains
  const beforeStyle = s;
  s = s.replace(STYLE_SECONDARY, " ").replace(/\s+/g, " ").trim();
  if (s.length < 2) s = beforeStyle;

  if (s.length < 2) {
    // Fallback: light clean of original without aggressive brand wipe failure
    s = original
      .replace(MULTIPACK_TAIL, " ")
      .replace(SIZE_TAIL, " ")
      .replace(FAT_PERCENT, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (s.length < 2) return original.slice(0, 40);

  // Prefer 2–4 words when still very long (keep first meaningful tokens)
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 5) {
    s = words.slice(0, 4).join(" ");
  }

  s = titleCaseName(s);

  if (s.length > 40) {
    s = s.slice(0, 40).replace(/\s+\S*$/, "").trim() || s.slice(0, 40);
  }

  return s || original.slice(0, 40);
}

/** True when two raw names simplify to the same food type (for merge tests). */
export function sameSimplifiedName(a: string, b: string): boolean {
  return simplifyProductName(a).toLowerCase() === simplifyProductName(b).toLowerCase();
}

/**
 * Extract a known brand token from a raw OCR line (before/alongside simplify).
 * Prefers a leading match; returns title-cased brand or undefined.
 * Does not invent brands — only tokens from BRAND_TOKENS.
 */
export function extractBrand(raw: string): string | undefined {
  const original = String(raw ?? "").trim();
  if (!original) return undefined;

  const normalized = original.replace(/[_/|]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  // Reset lastIndex for global regex
  BRAND_RE.lastIndex = 0;
  const matches: Array<{ token: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = BRAND_RE.exec(normalized)) !== null) {
    matches.push({ token: m[0], index: m.index });
  }
  if (!matches.length) return undefined;

  // Prefer earliest (leading) brand on the line
  matches.sort((a, b) => a.index - b.index || b.token.length - a.token.length);
  const chosen = matches[0].token.trim();
  if (!chosen) return undefined;

  // Don't treat pure food words as brands (safety — brands list shouldn't include them)
  const foodBlock = /^(milk|eggs?|bread|cheese|yogurt|yoghurt|pasta|rice|oil|water|butter|flour)$/i;
  if (foodBlock.test(chosen)) return undefined;

  return titleCaseName(chosen.toLowerCase());
}

/** Simplify name + extract brand in one pass (raw OCR line). */
export function parseProductLabel(raw: string): { name: string; brand?: string } {
  const brand = extractBrand(raw);
  const name = simplifyProductName(raw);
  return brand ? { name, brand } : { name };
}
