import { describe, expect, it } from "vitest";
import { parseAndValidateBackup } from "./backup";

describe("parseAndValidateBackup", () => {
  it("accepts version 1 object", () => {
    const b = parseAndValidateBackup({
      version: 1,
      exportedAt: new Date().toISOString(),
      shoppingList: [],
    });
    expect(b.version).toBe(1);
  });

  it("rejects wrong version", () => {
    expect(() => parseAndValidateBackup({ version: 2 })).toThrow(/version/i);
  });

  it("rejects invalid items shape", () => {
    expect(() =>
      parseAndValidateBackup({ version: 1, items: { fridge: [] } })
    ).toThrow(/fridge/i);
  });
});
