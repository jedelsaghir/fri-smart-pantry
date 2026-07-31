/**
 * Group receipt line prices by simplified product name + brand (Finances).
 */

import type { StoredReceipt } from "@/types/pantry";
import { simplifyProductName } from "@/lib/product-name";

export type BrandPricePoint = {
  brand: string;
  /** Average line price seen */
  avgPrice: number;
  /** Lowest line price */
  minPrice: number;
  /** Highest line price */
  maxPrice: number;
  count: number;
};

export type ProductBrandGroup = {
  productName: string;
  brands: BrandPricePoint[];
  /** Total observations across brands */
  observations: number;
};

/**
 * Build price-by-brand groups from receipt history.
 * Only includes lines that have a brand and a positive price.
 * Products sorted by observation count (most compared first).
 */
export function buildPriceByBrand(
  receipts: StoredReceipt[],
  opts?: { minBrands?: number; limit?: number }
): ProductBrandGroup[] {
  const minBrands = opts?.minBrands ?? 1;
  const limit = opts?.limit ?? 12;

  type Acc = Map<string, { sum: number; min: number; max: number; count: number }>;
  const byProduct = new Map<string, Acc>();

  for (const r of receipts) {
    for (const line of r.items || []) {
      const brand = (line.brand || "").trim();
      if (!brand) continue;
      const price = typeof line.price === "number" ? line.price : 0;
      if (!(price > 0)) continue;
      const product = simplifyProductName(line.name) || line.name.trim();
      if (!product) continue;
      const key = product.toLowerCase();
      let brands = byProduct.get(key);
      if (!brands) {
        brands = new Map();
        byProduct.set(key, brands);
      }
      const bKey = brand.toLowerCase();
      const prev = brands.get(bKey);
      if (!prev) {
        brands.set(bKey, { sum: price, min: price, max: price, count: 1 });
      } else {
        brands.set(bKey, {
          sum: prev.sum + price,
          min: Math.min(prev.min, price),
          max: Math.max(prev.max, price),
          count: prev.count + 1,
        });
      }
    }
  }

  const groups: ProductBrandGroup[] = [];
  for (const [productKey, brands] of byProduct) {
    if (brands.size < minBrands) continue;
    const brandList: BrandPricePoint[] = [];
    let observations = 0;
    let displayName = productKey;
    for (const [bKey, stats] of brands) {
      // restore casing from first-seen brand token via title-ish
      const brandLabel =
        bKey.charAt(0).toUpperCase() + bKey.slice(1);
      brandList.push({
        brand: brandLabel,
        avgPrice: Math.round((stats.sum / stats.count) * 100) / 100,
        minPrice: Math.round(stats.min * 100) / 100,
        maxPrice: Math.round(stats.max * 100) / 100,
        count: stats.count,
      });
      observations += stats.count;
    }
    // Prefer original simplified casing from any line
    displayName =
      simplifyProductName(productKey) ||
      productKey
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    brandList.sort((a, b) => a.avgPrice - b.avgPrice);
    groups.push({ productName: displayName, brands: brandList, observations });
  }

  groups.sort((a, b) => b.observations - a.observations || b.brands.length - a.brands.length);
  return groups.slice(0, limit);
}
