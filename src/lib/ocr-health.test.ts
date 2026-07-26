import { describe, expect, it, vi, afterEach } from "vitest";
import { getApiKey, getModel, probeXaiHealth } from "./ocr-receipt.functions";

describe("getApiKey / getModel", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("treats empty and placeholder env as missing", () => {
    process.env.XAI_API_KEY = "  ";
    expect(getApiKey()).toBeUndefined();
    process.env.XAI_API_KEY = "undefined";
    expect(getApiKey()).toBeUndefined();
  });

  it("reads XAI_API_KEY when set", () => {
    process.env.XAI_API_KEY = "xai-test-key-123";
    expect(getApiKey()).toBe("xai-test-key-123");
  });

  it("defaults model", () => {
    delete process.env.XAI_OCR_MODEL;
    delete process.env.XAI_MODEL;
    expect(getModel()).toBe("grok-4.5");
  });
});

describe("probeXaiHealth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports ok on 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 }))
    );
    const r = await probeXaiHealth("xai-key", "grok-4.5");
    expect(r.health).toBe("ok");
    expect(r.keyPresent).toBe(true);
    expect(r.configured).toBe(true);
    expect(r.message.toLowerCase()).not.toContain("xai-key");
  });

  it("reports auth_failed on 401 without leaking key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unauthorized", { status: 401 }))
    );
    const r = await probeXaiHealth("super-secret-key", "grok-4.5");
    expect(r.health).toBe("auth_failed");
    expect(r.keyPresent).toBe(true);
    expect(r.configured).toBe(true);
    expect(JSON.stringify(r)).not.toContain("super-secret-key");
  });

  it("reports network when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );
    const r = await probeXaiHealth("xai-key", "grok-4.5");
    expect(r.health).toBe("network");
    expect(r.keyPresent).toBe(true);
  });
});
