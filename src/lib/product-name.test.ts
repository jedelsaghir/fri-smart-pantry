import { describe, expect, it } from "vitest";
import {
  sameSimplifiedName,
  simplifyProductName,
  titleCaseName,
} from "./product-name";
import { parseReceiptOcrPayload, enrichOcrItems } from "./ocr-parse";

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

describe("OCR parse path simplifies names", () => {
  it("parseReceiptOcrPayload strips brands after multipack", () => {
    const r = parseReceiptOcrPayload({
      items: [
        { name: "Barilla Pesto Genovese 190g", qty: 1, unit: "g", price: 2.1, confidence: 0.9 },
        { name: "Granarolo Mozzarella 125G", qty: 1, unit: "g", confidence: 0.85 },
      ],
    });
    expect(r.items[0].name.toLowerCase()).toBe("pesto");
    expect(r.items[1].name.toLowerCase()).toBe("mozzarella");
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
  });
});
