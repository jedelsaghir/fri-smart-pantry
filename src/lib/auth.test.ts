import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  createAuthSession,
  validatePasswordStrength,
  getAuthMode,
  hashPassword,
  verifyPassword,
} from "./auth";
import { hashSyncPassword } from "./household-sync";

describe("validatePasswordStrength", () => {
  it("requires 4+ chars in demo", () => {
    expect(validatePasswordStrength("ab", "demo").ok).toBe(false);
    expect(validatePasswordStrength("abcd", "demo").ok).toBe(true);
  });
  it("requires 8+ chars in production", () => {
    expect(validatePasswordStrength("abcdefg", "production").ok).toBe(false);
    expect(validatePasswordStrength("abcdefgh", "production").ok).toBe(true);
  });
});

describe("createAuthSession", () => {
  it("sets expiry after issue", () => {
    const s = createAuthSession("u1", "A@B.com", 1000);
    expect(s.email).toBe("a@b.com");
    expect(s.userId).toBe("u1");
    expect(s.expiresAt).toBeGreaterThan(s.issuedAt);
  });
});

describe("hashPassword", () => {
  it("matches household-sync hash scheme", async () => {
    const a = await hashPassword("Jed@x.com", "secret");
    const b = await hashSyncPassword("jed@x.com", "secret");
    expect(a).toBe(b);
    expect(await verifyPassword("jed@x.com", "secret", a)).toBe(true);
    expect(await verifyPassword("jed@x.com", "wrong", a)).toBe(false);
  });
});

describe("getAuthMode", () => {
  const prev = import.meta.env.VITE_AUTH_MODE;
  afterEach(() => {
    (import.meta.env as { VITE_AUTH_MODE?: string }).VITE_AUTH_MODE = prev;
  });
  it("respects explicit demo", () => {
    (import.meta.env as { VITE_AUTH_MODE?: string }).VITE_AUTH_MODE = "demo";
    expect(getAuthMode()).toBe("demo");
  });
  it("respects explicit production", () => {
    (import.meta.env as { VITE_AUTH_MODE?: string }).VITE_AUTH_MODE = "production";
    expect(getAuthMode()).toBe("production");
  });
});
