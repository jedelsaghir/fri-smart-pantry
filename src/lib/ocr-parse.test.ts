import { describe, expect, it } from "vitest";
import {
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
