import { describe, expect, it } from "vitest";
import { formatMoney, formatPriceAmount, moneySymbol } from "./money";

describe("money helpers", () => {
  it("maps common currency codes to symbols", () => {
    expect(moneySymbol("EUR")).toBe("€");
    expect(moneySymbol("USD")).toBe("$");
    expect(moneySymbol("GBP")).toBe("£");
    expect(moneySymbol(undefined)).toBe("€");
  });

  it("formats amounts with two decimals", () => {
    expect(formatMoney(12.5, "EUR")).toBe("€12.50");
    expect(formatPriceAmount(3, "USD")).toBe("$3.00");
    expect(formatPriceAmount(undefined)).toBe("");
  });
});
