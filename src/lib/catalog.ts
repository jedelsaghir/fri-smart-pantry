import type { CatalogItem, CatalogMergeGroup, PantryItem } from "@/types/pantry";

import { STORAGE_KEYS } from "@/lib/storage-keys";

export const CATALOG_KEY = STORAGE_KEYS.CATALOG;

export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    // Treat hyphens / punctuation as spaces so "free-range" ≈ "free range"
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Product core for matching: drop embedded sizes/qty tokens so
 * "Whole milk 1L" ≈ "Whole Milk" and "Eggs 12pcs" ≈ "Free range eggs" still scores on tokens.
 */
export function coreItemName(name: string): string {
  return normalizeItemName(name)
    .replace(
      /\b\d+([.,]\d+)?\s*(ml|l|lt|ltr|liter|litre|liters|litres|g|gr|gram|grams|kg|kilo|kilogram|kilograms|oz|lb|pcs|pc|pack|packs|pk|x)\b/gi,
      " "
    )
    .replace(/\b\d+([.,]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createCatalogId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCatalog(): CatalogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CatalogItem[];
    }
  } catch {}
  // Start empty — catalog grows from real pantry/scan/manual entries only
  return [];
}

export function saveCatalog(items: CatalogItem[]): void {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
  } catch {}
}

export function upsertCatalogFromPantryItem(
  catalog: CatalogItem[],
  item: Pick<PantryItem, "name" | "unit" | "emoji" | "minStock" | "latestPrice">,
  source: CatalogItem["source"]
): CatalogItem[] {
  const key = normalizeItemName(item.name);
  if (!key) return catalog;
  const now = new Date().toISOString();
  const idx = catalog.findIndex((c) => normalizeItemName(c.name) === key);
  if (idx >= 0) {
    const next = [...catalog];
    next[idx] = {
      ...next[idx],
      name: item.name.trim() || next[idx].name,
      unit: item.unit || next[idx].unit,
      emoji: item.emoji || next[idx].emoji,
      defaultMinStock: item.minStock ?? next[idx].defaultMinStock,
      lastPrice: item.latestPrice ?? next[idx].lastPrice,
      updatedAt: now,
      source,
    };
    return next;
  }
  return [
    {
      id: createCatalogId(),
      name: item.name.trim(),
      unit: item.unit || "pcs",
      emoji: item.emoji || "🛒",
      defaultMinStock: item.minStock,
      lastPrice: item.latestPrice,
      updatedAt: now,
      source,
    },
    ...catalog,
  ];
}

/** Token set for fuzzy name compare (ignores short noise words) */
function nameTokens(name: string): Set<string> {
  const STOP = new Set(["the", "and", "with", "for", "from", "organic", "bio"]);
  return new Set(
    coreItemName(name)
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t))
  );
}

/**
 * Deterministic name similarity for receipt ↔ pantry matching.
 * Handles punctuation, free-range vs free range, and size suffixes (1L, 500g).
 */
export function namesLookSimilar(a: string, b: string): boolean {
  return nameSimilarityScore(a, b) >= 0.55;
}

/** 0–1 score; 1 = same core product name */
export function nameSimilarityScore(a: string, b: string): number {
  const na = coreItemName(a);
  const nb = coreItemName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  // Containment after size strip (e.g. "milk" ⊂ "whole milk")
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer = Math.max(na.length, nb.length);
    // Avoid "oil" matching "toilet" style flukes — require meaningful length
    if (shorter < 3) return 0;
    return 0.72 + 0.28 * (shorter / longer);
  }

  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared += 1;
  });
  if (shared === 0) {
    // Soft prefix match on longest tokens (eggs / egg)
    for (const x of ta) {
      for (const y of tb) {
        if (x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x))) {
          shared += 0.85;
        }
      }
    }
    if (shared === 0) return 0;
  }

  const union = ta.size + tb.size - Math.floor(shared);
  const jaccard = shared / Math.max(1, union);
  const coverage = shared / Math.min(ta.size, tb.size);
  return Math.min(1, jaccard * 0.45 + coverage * 0.55);
}

export function findMergeGroups(catalog: CatalogItem[]): CatalogMergeGroup[] {
  const used = new Set<string>();
  const groups: CatalogMergeGroup[] = [];

  for (let i = 0; i < catalog.length; i++) {
    const a = catalog[i];
    if (used.has(a.id)) continue;
    const members = [a];
    for (let j = i + 1; j < catalog.length; j++) {
      const b = catalog[j];
      if (used.has(b.id)) continue;
      if (namesLookSimilar(a.name, b.name)) {
        members.push(b);
      }
    }
    if (members.length < 2) continue;
    members.forEach((m) => used.add(m.id));
    // Prefer longer name as primary (more specific)
    const primary = [...members].sort((x, y) => y.name.length - x.name.length)[0];
    groups.push({
      id: `merge-${primary.id}`,
      primaryId: primary.id,
      memberIds: members.map((m) => m.id),
    });
  }
  return groups;
}

export function mergeCatalogGroup(
  catalog: CatalogItem[],
  primaryId: string,
  memberIds: string[]
): CatalogItem[] {
  const primary = catalog.find((c) => c.id === primaryId);
  if (!primary) return catalog;
  const others = catalog.filter((c) => memberIds.includes(c.id) && c.id !== primaryId);
  const merged: CatalogItem = {
    ...primary,
    unit: primary.unit || others.find((o) => o.unit)?.unit || "pcs",
    emoji: primary.emoji || others.find((o) => o.emoji)?.emoji || "🛒",
    defaultMinStock:
      primary.defaultMinStock ?? others.find((o) => o.defaultMinStock != null)?.defaultMinStock,
    lastPrice: primary.lastPrice ?? others.find((o) => o.lastPrice != null)?.lastPrice,
    updatedAt: new Date().toISOString(),
    source: "merge",
  };
  const drop = new Set(memberIds);
  return [merged, ...catalog.filter((c) => !drop.has(c.id))];
}

export function searchCatalog(catalog: CatalogItem[], query: string, limit = 8): CatalogItem[] {
  const q = normalizeItemName(query);
  if (!q) return [];
  const scored = catalog
    .map((item) => {
      const n = normalizeItemName(item.name);
      let score = 0;
      if (n === q) score = 100;
      else if (n.startsWith(q)) score = 80;
      else if (n.includes(q)) score = 50;
      else if (q.split(" ").some((t) => t.length > 1 && n.includes(t))) score = 25;
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return scored.slice(0, limit).map((s) => s.item);
}
