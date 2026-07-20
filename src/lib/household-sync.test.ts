import { describe, expect, it } from "vitest";
import {
  hashSyncPassword,
  shouldApplyRemote,
  validateSnapshot,
  HOUSEHOLD_SYNC_VERSION,
} from "./household-sync";

describe("hashSyncPassword", () => {
  it("is stable and case-normalizes email", async () => {
    const a = await hashSyncPassword("Jed@Example.com", "secret");
    const b = await hashSyncPassword("jed@example.com", "secret");
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });

  it("differs by password", async () => {
    const a = await hashSyncPassword("a@b.com", "one");
    const b = await hashSyncPassword("a@b.com", "two");
    expect(a).not.toBe(b);
  });
});

describe("shouldApplyRemote", () => {
  it("applies when no local timestamp", () => {
    expect(shouldApplyRemote(null, "2026-07-20T12:00:00.000Z")).toBe(true);
  });
  it("applies when remote is newer or equal", () => {
    expect(
      shouldApplyRemote("2026-07-20T10:00:00.000Z", "2026-07-20T12:00:00.000Z")
    ).toBe(true);
  });
  it("skips when local is newer", () => {
    expect(
      shouldApplyRemote("2026-07-20T14:00:00.000Z", "2026-07-20T12:00:00.000Z")
    ).toBe(false);
  });
});

describe("validateSnapshot", () => {
  it("normalizes email", () => {
    const s = validateSnapshot({
      version: HOUSEHOLD_SYNC_VERSION,
      updatedAt: new Date().toISOString(),
      email: "  Jed@X.COM ",
      household: "Home",
    });
    expect(s.email).toBe("jed@x.com");
  });
});
