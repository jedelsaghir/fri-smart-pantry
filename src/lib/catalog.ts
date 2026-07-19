import type { CatalogItem, CatalogMergeGroup, PantryItem } from "@/types/pantry";

export const CATALOG_KEY = "friggg-item-catalog";

export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

export function createCatalogId(): string {
  return `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function seedCatalog(): CatalogItem[] {
  const now = new Date().toISOString();
  const rows: Array<Omit<CatalogItem, "id" | "updatedAt" | "source">> = [
    { name: "Whole milk", unit: "L", emoji: "🥛", defaultMinStock: 2 },
    { name: "Free-range eggs", unit: "pcs", emoji: "🥚", defaultMinStock: 6 },
    { name: "Greek yogurt", unit: "tub", emoji: "🥣", defaultMinStock: 2 },
    { name: "Cherry tomatoes", unit: "pack", emoji: "🍅", defaultMinStock: 1 },
    { name: "Aged cheddar", unit: "g", emoji: "🧀", defaultMinStock: 150 },
    { name: "Baby spinach", unit: "bag", emoji: "🥬", defaultMinStock: 1 },
    { name: "Chicken thighs", unit: "g", emoji: "🍗", defaultMinStock: 1 },
    { name: "Olive oil", unit: "bottle", emoji: "🫒", defaultMinStock: 1 },
    { name: "Pasta", unit: "pack", emoji: "🍝", defaultMinStock: 1 },
  ];
  return rows.map((r) => ({
    ...r,
    id: createCatalogId(),
    updatedAt: now,
    source: "manual" as const,
  }));
}

export function loadCatalog(): CatalogItem[] {
  if (typeof window === "undefined") return seedCatalog();
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as CatalogItem[];
    }
  } catch {}
  const seed = seedCatalog();
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(seed));
  } catch {}
  return seed;
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

/** Simple similarity: shared tokens or one contains the other */
export function namesLookSimilar(a: string, b: string): boolean {
  const na = normalizeItemName(a);
  const nb = normalizeItemName(b);
  if (!na || !nb || na === nb) return na === nb && na.length > 0;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter((t) => t.length > 2));
  const tb = new Set(nb.split(" ").filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  ta.forEach((t) => {
    if (tb.has(t)) shared += 1;
  });
  const minSize = Math.min(ta.size, tb.size);
  return shared >= 1 && shared / minSize >= 0.5;
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
