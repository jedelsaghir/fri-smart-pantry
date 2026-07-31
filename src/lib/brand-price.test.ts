import { describe, expect, it } from "vitest";
import { buildPriceByBrand } from "./brand-price";
import type { StoredReceipt } from "@/types/pantry";

const receipt = (items: StoredReceipt["items"]): StoredReceipt => ({
  id: "r1",
  date: "2026-07-01",
  store: "Test",
  total: 10,
  currency: "EUR",
  imageDataUrl: "",
  items,
  createdAt: "2026-07-01T12:00:00.000Z",
});

describe("buildPriceByBrand", () => {
  it("groups simplified product by brand", () => {
    const groups = buildPriceByBrand([
      receipt([
        {
          id: "1",
          name: "Mozzarella",
          qty: 1,
          unit: "pcs",
          emoji: "🧀",
          price: 1.5,
          brand: "Granarolo",
        },
        {
          id: "2",
          name: "Mozzarella",
          qty: 1,
          unit: "pcs",
          emoji: "🧀",
          price: 1.2,
          brand: "Galbani",
        },
      ]),
    ]);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    const mozz = groups.find((g) => g.productName.toLowerCase().includes("mozzarella"));
    expect(mozz?.brands.length).toBe(2);
    expect(mozz?.brands.map((b) => b.brand.toLowerCase()).sort()).toEqual([
      "galbani",
      "granarolo",
    ]);
  });

  it("skips lines without brand", () => {
    const groups = buildPriceByBrand([
      receipt([
        { id: "1", name: "Milk", qty: 1, unit: "L", emoji: "🥛", price: 1.1 },
      ]),
    ]);
    expect(groups).toHaveLength(0);
  });
});
