import { describe, expect, it } from "vitest";
import {
  extractBrand,
  parseProductLabel,
  sameSimplifiedName,
  simplifyProductName,
  titleCaseName,
} from "./product-name";
import { parseReceiptOcrPayload, enrichOcrItems } from "./ocr-parse";
import { sameProduct, upsertPantryItem } from "./pantry-ops";
import type { PantryItem } from "@/types/pantry";

describe("simplifyProductName", () => {
  it("strips Italian dairy brands to food type", () => {
    expect(simplifyProductName("Granarolo Mozzarella 125g")).toMatch(/mozzarella/i);
    expect(simplifyProductName("GRANAROLO MOZZARELLA 125G")).toBe("Mozzarella");
    expect(simplifyProductName("Granarolo Parmigiano Reggiano")).toMatch(/parmigiano/i);
  });

  it("strips Barilla pesto marketing", () => {
    expect(simplifyProductName("Barilla Pesto Genovese 190g").toLowerCase()).toBe("pesto");
  });

  it("strips Müller yogurt brand", () => {
    const n = simplifyProductName("Müller Strawberry Yogurt 150g");
    expect(n.toLowerCase()).toMatch(/yogurt|yoghurt|strawberry/);
    expect(n.toLowerCase()).not.toMatch(/müller|muller/);
  });

  it("passes through already-simple names", () => {
    expect(simplifyProductName("Whole milk")).toBe("Whole Milk");
    expect(simplifyProductName("Eggs")).toBe("Eggs");
    expect(simplifyProductName("Cherry tomatoes")).toMatch(/Cherry Tomatoes/i);
  });

  it("strips multipack and fat percent noise", () => {
    const n = simplifyProductName("Milk UHT 2L 3.5%");
    expect(n.toLowerCase()).toMatch(/milk/);
    expect(n).not.toMatch(/%/);
    expect(n.toLowerCase()).not.toMatch(/\b2l\b/);
  });

  it("does not collapse to empty when only brand+size", () => {
    const n = simplifyProductName("Granarolo 125g");
    expect(n.length).toBeGreaterThanOrEqual(2);
  });

  it("title-cases output", () => {
    expect(titleCaseName("whole milk")).toBe("Whole Milk");
  });

  it("makes brand variants match the same simplified form", () => {
    expect(sameSimplifiedName("Granarolo Mozzarella 125g", "Mozzarella")).toBe(true);
    expect(sameSimplifiedName("Barilla Pesto Genovese", "Pesto")).toBe(true);
  });
});

describe("extractBrand", () => {
  it("pulls brand while simplify keeps food type", () => {
    const raw = "Granarolo Mozzarella 125g";
    expect(extractBrand(raw)).toBe("Granarolo");
    expect(simplifyProductName(raw)).toBe("Mozzarella");
    expect(parseProductLabel(raw)).toEqual({ name: "Mozzarella", brand: "Granarolo" });
  });

  it("returns undefined for already-simple names", () => {
    expect(extractBrand("Mozzarella")).toBeUndefined();
    expect(extractBrand("Whole milk")).toBeUndefined();
  });
});

describe("OCR parse path simplifies names + keeps brand", () => {
  it("parseReceiptOcrPayload strips brands after multipack but stores brand", () => {
    const r = parseReceiptOcrPayload({
      items: [
        { name: "Barilla Pesto Genovese 190g", qty: 1, unit: "g", price: 2.1, confidence: 0.9 },
        { name: "Granarolo Mozzarella 125G", qty: 1, unit: "g", confidence: 0.85 },
      ],
    });
    expect(r.items[0].name.toLowerCase()).toBe("pesto");
    expect(r.items[0].brand?.toLowerCase()).toBe("barilla");
    expect(r.items[1].name.toLowerCase()).toBe("mozzarella");
    expect(r.items[1].brand?.toLowerCase()).toBe("granarolo");
  });

  it("enrichOcrItems also simplifies", () => {
    const out = enrichOcrItems([
      {
        name: "Danone Activia Strawberry Yogurt 150g",
        qty: 1,
        unit: "g",
        confidence: 0.8,
      },
    ]);
    expect(out[0].name.toLowerCase()).not.toMatch(/danone|activia/);
    expect(out[0].name.toLowerCase()).toMatch(/yogurt|strawberry/);
    expect(out[0].brand?.toLowerCase()).toMatch(/danone|activia/);
  });
});

describe("merge ignores brand for identity", () => {
  it("two brands of mozzarella merge by simplified name", () => {
    const a: PantryItem = {
      id: "1",
      name: "Mozzarella",
      qty: 1,
      unit: "pcs",
      emoji: "🧀",
      daysLeft: 5,
      minStock: 1,
      brand: "Granarolo",
    };
    const b: PantryItem = {
      id: "2",
      name: "Mozzarella",
      qty: 1,
      unit: "pcs",
      emoji: "🧀",
      daysLeft: 4,
      minStock: 1,
      brand: "Galbani",
    };
    expect(sameProduct(a, b)).toBe(true);
    const next = upsertPantryItem([a], b, { mergePrice: true });
    expect(next).toHaveLength(1);
    expect(next[0].qty).toBe(2);
    // Latest scan brand wins when present
    expect(next[0].brand).toBe("Galbani");
  });
});
