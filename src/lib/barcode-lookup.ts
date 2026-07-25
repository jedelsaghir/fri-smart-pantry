/**
 * Optional barcode assist — BarcodeDetector when available + Open Food Facts lookup.
 * Fails gracefully when camera/API unavailable.
 */

export type BarcodeLookupResult = {
  barcode: string;
  name: string;
  unit?: string;
  emoji?: string;
  brand?: string;
  source: "openfoodfacts" | "local";
};

export type BarcodeScanError =
  | "unsupported"
  | "permission"
  | "no_barcode"
  | "lookup_failed"
  | "network"
  | "cancelled";

/** True when the browser can detect barcodes from a video/image. */
export function isBarcodeDetectorSupported(): boolean {
  try {
    return typeof window !== "undefined" && "BarcodeDetector" in window;
  } catch {
    return false;
  }
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string; format?: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorLike | null {
  if (!isBarcodeDetectorSupported()) return null;
  try {
    // Prefer common grocery formats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const BD = (window as any).BarcodeDetector;
    return new BD({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
    }) as BarcodeDetectorLike;
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (window as any).BarcodeDetector() as BarcodeDetectorLike;
    } catch {
      return null;
    }
  }
}

/** Detect first barcode from a canvas / video / image. */
export async function detectBarcodeFromSource(
  source: ImageBitmapSource
): Promise<string | null> {
  const detector = getBarcodeDetector();
  if (!detector) return null;
  try {
    const codes = await detector.detect(source);
    const raw = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

/** Guess unit from OFF quantity string e.g. "500 g", "1 L", "6" */
export function guessUnitFromQuantity(quantity: string | undefined | null): string | undefined {
  if (!quantity?.trim()) return undefined;
  const q = quantity.toLowerCase();
  if (/\bkg\b/.test(q)) return "kg";
  if (/\bg\b/.test(q) && !/\bkg\b/.test(q)) return "g";
  if (/\bml\b/.test(q)) return "ml";
  if (/\bl\b/.test(q) || /\blitre/.test(q) || /\bliter/.test(q)) return "L";
  if (/\bpcs?\b/.test(q) || /\bx\s*\d/.test(q) || /\bpack/.test(q)) return "pcs";
  return undefined;
}

/** Simple emoji hint from product categories / name */
export function guessEmojiFromProduct(name: string, categories?: string): string {
  const hay = `${name} ${categories || ""}`.toLowerCase();
  if (/milk|lait|dairy|yogurt|yaourt|cheese|fromage/.test(hay)) return "🥛";
  if (/egg|oeuf|œuf/.test(hay)) return "🥚";
  if (/bread|pain|bagel/.test(hay)) return "🍞";
  if (/apple|pomme|fruit|banana|banane|berry/.test(hay)) return "🍎";
  if (/tomato|tomate|vegetable|légume|salad|lettuce/.test(hay)) return "🥬";
  if (/chicken|poulet|meat|viande|beef|boeuf|pork/.test(hay)) return "🍗";
  if (/fish|poisson|salmon|saumon/.test(hay)) return "🐟";
  if (/juice|jus|soda|water|eau|drink|boisson/.test(hay)) return "🧃";
  if (/coffee|café|tea|thé/.test(hay)) return "☕";
  if (/pasta|pâtes|rice|riz|cereal/.test(hay)) return "🍝";
  if (/chocolate|chocolat|cookie|biscuit|candy/.test(hay)) return "🍫";
  return "🛒";
}

/**
 * Lookup product metadata by GTIN/EAN/UPC via Open Food Facts (public API).
 * Returns null when product unknown or network fails — never throws.
 */
export async function lookupBarcodeProduct(
  barcode: string,
  opts?: { signal?: AbortSignal }
): Promise<BarcodeLookupResult | null> {
  const code = barcode.replace(/\D/g, "").trim();
  if (code.length < 6) return null;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`;
    const res = await fetch(url, {
      signal: opts?.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        product_name_en?: string;
        brands?: string;
        quantity?: string;
        categories?: string;
        generic_name?: string;
      };
    };
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const name =
      (p.product_name || p.product_name_en || p.generic_name || "").trim() ||
      (p.brands ? `${p.brands} product` : "");
    if (!name) return null;
    return {
      barcode: code,
      name: name.slice(0, 80),
      unit: guessUnitFromQuantity(p.quantity) || "pcs",
      emoji: guessEmojiFromProduct(name, p.categories),
      brand: p.brands?.split(",")[0]?.trim(),
      source: "openfoodfacts",
    };
  } catch {
    return null;
  }
}

/** Friendly message for UI toasts */
export function barcodeErrorMessage(err: BarcodeScanError): string {
  switch (err) {
    case "unsupported":
      return "Barcode scanning isn’t supported in this browser. Type the name instead.";
    case "permission":
      return "Camera permission is needed to scan a barcode.";
    case "no_barcode":
      return "No barcode found — try again with better light or closer framing.";
    case "lookup_failed":
      return "Barcode read, but no product data found. Enter the name manually.";
    case "network":
      return "Couldn’t look up the barcode (offline?). Enter the name manually.";
    case "cancelled":
      return "Barcode scan cancelled.";
    default:
      return "Barcode assist unavailable.";
  }
}
