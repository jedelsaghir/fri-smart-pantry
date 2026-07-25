import { describe, expect, it } from "vitest";
import {
  barcodeErrorMessage,
  guessEmojiFromProduct,
  guessUnitFromQuantity,
} from "./barcode-lookup";

describe("guessUnitFromQuantity", () => {
  it("parses common units", () => {
    expect(guessUnitFromQuantity("500 g")).toBe("g");
    expect(guessUnitFromQuantity("1.5 L")).toBe("L");
    expect(guessUnitFromQuantity("250 ml")).toBe("ml");
    expect(guessUnitFromQuantity("6 x 33cl")).toBe("pcs");
    expect(guessUnitFromQuantity(undefined)).toBeUndefined();
  });
});

describe("guessEmojiFromProduct", () => {
  it("maps dairy and produce", () => {
    expect(guessEmojiFromProduct("Whole milk")).toBe("🥛");
    expect(guessEmojiFromProduct("Free range eggs")).toBe("🥚");
    expect(guessEmojiFromProduct("Mystery snack")).toBe("🛒");
  });
});

describe("barcodeErrorMessage", () => {
  it("returns honest unsupported copy", () => {
    expect(barcodeErrorMessage("unsupported").toLowerCase()).toMatch(/isn.?t supported|not supported/);
    expect(barcodeErrorMessage("lookup_failed")).toMatch(/manually/i);
  });
});
