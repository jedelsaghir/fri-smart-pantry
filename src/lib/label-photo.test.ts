import { describe, expect, it } from "vitest";
import { EXPIRY_ASSIST_COPY } from "./label-photo";

describe("EXPIRY_ASSIST_COPY", () => {
  it("is honest about limited auto-read", () => {
    expect(EXPIRY_ASSIST_COPY.honesty.toLowerCase()).toMatch(/isn.?t reliable|not reliable|auto-reading/);
    expect(EXPIRY_ASSIST_COPY.subtitle.toLowerCase()).toMatch(/optional|skip/);
  });
});
