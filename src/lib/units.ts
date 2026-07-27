/**
 * Unit normalization + mass/volume conversion (g↔kg, ml↔L).
 * Pure helpers — used by matching, shopping merge, details drawer, recipes.
 */

export type UnitFamily = "mass" | "volume" | "count" | "other";

const UNIT_ALIASES: Record<string, string> = {
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
  cl: "cl",
  centiliter: "cl",
  centilitre: "cl",
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

/** Canonical unit string (L, ml, g, kg, pcs, …). */
export function normalizeUnit(unit: unknown, qty = 1): string {
  const u = String(unit ?? "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "");
  if (!u) {
    if (qty >= 50) return "g";
    return "pcs";
  }
  return UNIT_ALIASES[u] ?? u.slice(0, 12);
}

export function unitFamily(unit: unknown, qty = 1): UnitFamily {
  const u = normalizeUnit(unit, qty);
  if (u === "g" || u === "kg") return "mass";
  if (u === "ml" || u === "L" || u === "cl") return "volume";
  if (u === "pcs" || u === "pack" || u === "x") return "count";
  return "other";
}

/**
 * Base unit for identity keys (mass → g, volume → ml) so 500g and 0.5kg match.
 */
export function baseUnit(unit: unknown, qty = 1): string {
  const u = normalizeUnit(unit, qty);
  if (u === "kg") return "g";
  if (u === "L") return "ml";
  if (u === "cl") return "ml";
  return u;
}

/**
 * Convert quantity between compatible units.
 * Returns null when conversion is not defined (e.g. pcs → g).
 */
export function convertQty(qty: number, fromUnit: unknown, toUnit: unknown): number | null {
  if (!Number.isFinite(qty)) return null;
  const from = normalizeUnit(fromUnit, qty);
  const to = normalizeUnit(toUnit, qty);
  if (from === to) return qty;

  // Mass: g ↔ kg
  if (from === "g" && to === "kg") return qty / 1000;
  if (from === "kg" && to === "g") return qty * 1000;

  // Volume: ml ↔ L ↔ cl
  if (from === "ml" && to === "L") return qty / 1000;
  if (from === "L" && to === "ml") return qty * 1000;
  if (from === "ml" && to === "cl") return qty / 10;
  if (from === "cl" && to === "ml") return qty * 10;
  if (from === "L" && to === "cl") return qty * 100;
  if (from === "cl" && to === "L") return qty / 100;

  return null;
}

/** True when units are the same or convertible (g/kg, ml/L). */
export function unitsCompatible(
  a: unknown,
  b: unknown,
  qtyA = 1,
  qtyB = 1
): boolean {
  const ua = normalizeUnit(a, qtyA);
  const ub = normalizeUnit(b, qtyB);
  if (ua === ub) return true;
  return convertQty(1, ua, ub) != null;
}

/**
 * Express qty in `toUnit` when convertible; otherwise keep original.
 */
export function convertQtyOrKeep(
  qty: number,
  fromUnit: unknown,
  toUnit: unknown
): { qty: number; unit: string; converted: boolean } {
  const from = normalizeUnit(fromUnit, qty);
  const to = normalizeUnit(toUnit, qty);
  const converted = convertQty(qty, from, to);
  if (converted == null) {
    return { qty, unit: from, converted: false };
  }
  return { qty: roundQty(converted), unit: to, converted: true };
}

/** Merge two quantities into the preferred (existing) unit when compatible. */
export function mergeQuantities(
  existingQty: number,
  existingUnit: unknown,
  addQty: number,
  addUnit: unknown
): { qty: number; unit: string } | null {
  const eu = normalizeUnit(existingUnit, existingQty);
  const au = normalizeUnit(addUnit, addQty);
  if (!unitsCompatible(eu, au, existingQty, addQty)) return null;
  const converted = convertQty(addQty, au, eu);
  if (converted == null) return null;
  return { qty: roundQty(existingQty + converted), unit: eu };
}

/** Round for display/storage — avoid 0.30000000004. */
export function roundQty(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) >= 100) return Math.round(n * 10) / 10;
  if (Math.abs(n) >= 10) return Math.round(n * 100) / 100;
  return Math.round(n * 1000) / 1000;
}

/** Toggle mass unit g ↔ kg (converts qty). */
export function toggleMassUnit(qty: number, unit: unknown): { qty: number; unit: "g" | "kg" } | null {
  const u = normalizeUnit(unit, qty);
  if (u === "g") {
    return { qty: roundQty(qty / 1000), unit: "kg" };
  }
  if (u === "kg") {
    return { qty: roundQty(qty * 1000), unit: "g" };
  }
  return null;
}

/** Toggle volume unit ml ↔ L (converts qty). */
export function toggleVolumeUnit(qty: number, unit: unknown): { qty: number; unit: "ml" | "L" } | null {
  const u = normalizeUnit(unit, qty);
  if (u === "ml") {
    return { qty: roundQty(qty / 1000), unit: "L" };
  }
  if (u === "L") {
    return { qty: roundQty(qty * 1000), unit: "ml" };
  }
  return null;
}

/**
 * When changing unit, keep “latest price” as a total-ish value for the same stock amount.
 * Price is treated as for the whole line qty (not per-gram), so it stays unchanged on unit toggle.
 * Returns the same price (explicit for callers).
 */
export function priceAfterUnitToggle(latestPrice: number | undefined): number | undefined {
  return latestPrice;
}

export function canToggleUnit(unit: unknown, qty = 1): boolean {
  const u = normalizeUnit(unit, qty);
  return u === "g" || u === "kg" || u === "ml" || u === "L";
}
