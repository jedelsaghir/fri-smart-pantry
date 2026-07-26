import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isQuotaExceededError,
  safeSetItem,
  stripLocalPhotosToFreeSpace,
} from "./storage-quota";

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const ls = {
    get length() {
      return store.size;
    },
    key(i: number) {
      return [...store.keys()][i] ?? null;
    },
    getItem(k: string) {
      return store.has(k) ? store.get(k)! : null;
    },
    setItem(k: string, v: string) {
      store.set(k, String(v));
    },
    removeItem(k: string) {
      store.delete(k);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: ls,
    configurable: true,
    writable: true,
  });
  return store;
}

describe("isQuotaExceededError", () => {
  it("detects standard quota errors", () => {
    expect(isQuotaExceededError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError({ message: "quota exceeded" })).toBe(true);
    expect(isQuotaExceededError(new Error("nope"))).toBe(false);
  });
});

describe("safeSetItem", () => {
  const key = "friggg-test-quota-key";
  let store: Map<string, string>;

  beforeEach(() => {
    store = installMemoryLocalStorage();
  });

  afterEach(() => {
    store.clear();
  });

  it("writes successfully in normal conditions", () => {
    const r = safeSetItem(key, "hello");
    expect(r.ok).toBe(true);
    expect(localStorage.getItem(key)).toBe("hello");
  });

  it("retries after freeSpace on quota", () => {
    let calls = 0;
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k: string, v: string) => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("quota");
        (err as { name: string }).name = "QuotaExceededError";
        throw err;
      }
      return original(k, v);
    };
    try {
      let freed = false;
      const r = safeSetItem(key, "after-free", {
        freeSpace: () => {
          freed = true;
        },
      });
      expect(freed).toBe(true);
      expect(r.ok).toBe(true);
      expect(localStorage.getItem(key)).toBe("after-free");
    } finally {
      localStorage.setItem = original;
    }
  });
});

describe("stripLocalPhotosToFreeSpace", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it("clears receipt and label photos", () => {
    localStorage.setItem(
      "friggg-receipts",
      JSON.stringify([{ id: "r1", imageDataUrl: "data:image/jpeg;base64," + "x".repeat(200) }])
    );
    localStorage.setItem(
      "friggg-items",
      JSON.stringify({
        fridge: [
          {
            id: "i1",
            name: "Milk",
            labelPhotoDataUrl: "data:image/jpeg;base64," + "y".repeat(100),
          },
        ],
        freezer: [],
        pantry: [],
      })
    );
    const n = stripLocalPhotosToFreeSpace();
    expect(n).toBeGreaterThanOrEqual(2);
    const receipts = JSON.parse(localStorage.getItem("friggg-receipts") || "[]");
    expect(receipts[0].imageDataUrl).toBe("");
  });
});
