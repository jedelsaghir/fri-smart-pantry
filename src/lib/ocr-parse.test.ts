import { describe, expect, it } from "vitest";
import {
  applyMultipackQtyUnit,
  applyTotalLineSanity,
  confidenceBand,
  emojiForItemName,
  extractJsonPayload,
  extractResponseText,
  guessStorage,
  normalizeUnit,
  parseReceiptOcrPayload,
} from "./ocr-parse";

describe("parseReceiptOcrPayload", () => {
  it("parses object with items, store, total", () => {
    const r = parseReceiptOcrPayload({
      store: "Lidl",
      total: 12.5,
      currency: "eur",
      items: [
        { name: "Whole milk", qty: 2, unit: "L", price: 2.58, confidence: 0.9 },
        { name: "Pasta", qty: 1, unit: "pack", price: 1.15, confidence: 0.6 },
      ],
    });
    expect(r.store).toBe("Lidl");
    expect(r.total).toBe(12.5);
    expect(r.currency).toBe("EUR");
    expect(r.items).toHaveLength(2);
    expect(r.items[0].storage).toBe("fridge");
    expect(r.items[1].storage).toBe("pantry");
    expect(r.items[0].emoji).toBeTruthy();
  });

  it("sums prices when total missing", () => {
    const r = parseReceiptOcrPayload({
      items: [
        { name: "Eggs", qty: 6, unit: "pcs", price: 3 },
        { name: "Bread", qty: 1, unit: "loaf", price: 1.5 },
      ],
    });
    expect(r.total).toBe(4.5);
  });

  it("skips empty names", () => {
    const r = parseReceiptOcrPayload({
      items: [{ name: "  ", qty: 1 }, { name: "Milk", qty: 1, unit: "L" }],
    });
    expect(r.items).toHaveLength(1);
  });
});

describe("extractJsonPayload", () => {
  it("strips markdown fences", () => {
    const raw = extractJsonPayload('```json\n{"items":[{"name":"Milk","qty":1,"unit":"L"}]}\n```');
    expect(parseReceiptOcrPayload(raw).items[0].name).toBe("Milk");
  });
});

describe("extractResponseText", () => {
  it("reads output_text", () => {
    expect(extractResponseText({ output_text: '{"items":[]}' })).toContain("items");
  });
  it("reads chat completions message", () => {
    expect(
      extractResponseText({
        choices: [{ message: { content: '{"items":[]}' } }],
      })
    ).toContain("items");
  });
});

describe("helpers", () => {
  it("guessStorage", () => {
    expect(guessStorage("Frozen berries")).toBe("freezer");
    expect(guessStorage("Olive oil")).toBe("pantry");
    expect(guessStorage("Greek yogurt")).toBe("fridge");
  });
  it("normalizeUnit", () => {
    expect(normalizeUnit("liters", 1)).toBe("L");
    expect(normalizeUnit("pc", 2)).toBe("pcs");
    expect(normalizeUnit("", 200)).toBe("g");
  });
  it("emojiForItemName", () => {
    expect(emojiForItemName("Whole milk")).toBe("🥛");
  });
});

describe("applyMultipackQtyUnit", () => {
  it("parses 6x330ml multipacks", () => {
    const r = applyMultipackQtyUnit("Cola 6x330ml", 1, "pcs");
    expect(r.qty).toBe(6);
    expect(r.unit).toBe("pcs");
    expect(r.name.toLowerCase()).toContain("cola");
    expect(r.name).not.toMatch(/6x/i);
  });
  it("parses pack of N", () => {
    const r = applyMultipackQtyUnit("Free range eggs pack of 6", 1, "pcs");
    expect(r.qty).toBe(6);
  });
  it("parses N-pack", () => {
    const r = applyMultipackQtyUnit("Water 6-pack", 1, "pcs");
    expect(r.qty).toBe(6);
  });
});

describe("applyTotalLineSanity", () => {
  it("boosts confidence when lines sum near total", () => {
    const items = applyTotalLineSanity(
      [
        { name: "A", qty: 1, unit: "pcs", price: 5, confidence: 0.8 },
        { name: "B", qty: 1, unit: "pcs", price: 5, confidence: 0.8 },
      ],
      10
    );
    expect(items[0].confidence).toBeGreaterThan(0.8);
  });
  it("dips confidence when lines far from total", () => {
    const items = applyTotalLineSanity(
      [
        { name: "A", qty: 1, unit: "pcs", price: 2, confidence: 0.9 },
        { name: "B", qty: 1, unit: "pcs", price: 2, confidence: 0.9 },
      ],
      50
    );
    expect(items[0].confidence).toBeLessThan(0.9);
  });
  it("does not invent or drop items", () => {
    const items = applyTotalLineSanity(
      [
        { name: "A", qty: 1, unit: "pcs", price: 1, confidence: 0.7 },
        { name: "B", qty: 1, unit: "pcs", price: 1, confidence: 0.7 },
      ],
      99
    );
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.name)).toEqual(["A", "B"]);
  });
});

describe("confidenceBand", () => {
  it("maps high medium low", () => {
    expect(confidenceBand(0.9)).toBe("high");
    expect(confidenceBand(0.7)).toBe("medium");
    expect(confidenceBand(0.4)).toBe("low");
  });
});
