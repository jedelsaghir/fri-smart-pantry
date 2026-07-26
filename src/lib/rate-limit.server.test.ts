import { describe, expect, it } from "vitest";
import { checkRateLimit, rateKey } from "./rate-limit.server";

describe("checkRateLimit", () => {
  it("allows under limit then blocks", () => {
    const key = rateKey("test", `unit-${Date.now()}-${Math.random()}`);
    const a = checkRateLimit(key, { limit: 2, windowMs: 60_000, label: "Test" });
    const b = checkRateLimit(key, { limit: 2, windowMs: 60_000, label: "Test" });
    const c = checkRateLimit(key, { limit: 2, windowMs: 60_000, label: "Test" });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(false);
    if (!c.ok) {
      expect(c.message).toMatch(/try again/i);
      expect(c.retryAfterSec).toBeGreaterThan(0);
    }
  });
});
