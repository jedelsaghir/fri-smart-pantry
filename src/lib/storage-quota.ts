/**
 * Quota-aware localStorage writes — never crash the app on QuotaExceededError.
 * Prefer keeping pantry/core data over large photos when space is tight.
 */

export type SafeSetResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "error"; message: string };

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: number; message?: string };
  return (
    e.name === "QuotaExceededError" ||
    e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    e.code === 22 ||
    e.code === 1014 ||
    (typeof e.message === "string" && /quota/i.test(e.message))
  );
}

/** Estimate rough localStorage usage in characters (approx bytes for UTF-16/JSON). */
export function estimateLocalStorageChars(): number {
  if (typeof localStorage === "undefined") return 0;
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const v = localStorage.getItem(k) || "";
      total += k.length + v.length;
    }
  } catch {
    /* ignore */
  }
  return total;
}

/**
 * Write a key safely. On quota failure, optionally run freeSpace() and retry once.
 */
export function safeSetItem(
  key: string,
  value: string,
  opts?: { freeSpace?: () => void }
): SafeSetResult {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      return {
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : "Storage write failed",
      };
    }
    try {
      opts?.freeSpace?.();
      localStorage.setItem(key, value);
      return { ok: true };
    } catch (err2) {
      return {
        ok: false,
        reason: "quota",
        message: isQuotaExceededError(err2)
          ? "Device storage is full. Pantry data is kept; some photos may be omitted."
          : err2 instanceof Error
            ? err2.message
            : "Storage write failed",
      };
    }
  }
}

/**
 * Strip large data-URL photos from pantry items and receipts to free space.
 * Mutates localStorage in place. Returns how many photo fields cleared.
 */
export function stripLocalPhotosToFreeSpace(): number {
  if (typeof localStorage === "undefined") return 0;
  let cleared = 0;

  // Receipts — drop imageDataUrl first (largest)
  try {
    const raw = localStorage.getItem("friggg-receipts");
    if (raw) {
      const list = JSON.parse(raw) as Array<{ imageDataUrl?: string }>;
      if (Array.isArray(list)) {
        let changed = false;
        for (const r of list) {
          if (r.imageDataUrl && r.imageDataUrl.length > 64) {
            r.imageDataUrl = "";
            cleared += 1;
            changed = true;
          }
        }
        if (changed) localStorage.setItem("friggg-receipts", JSON.stringify(list));
      }
    }
  } catch {
    /* ignore */
  }

  // Pantry label photos
  try {
    const raw = localStorage.getItem("friggg-items");
    if (raw) {
      const items = JSON.parse(raw) as {
        fridge?: Array<{ labelPhotoDataUrl?: string }>;
        freezer?: Array<{ labelPhotoDataUrl?: string }>;
        pantry?: Array<{ labelPhotoDataUrl?: string }>;
      };
      let changed = false;
      for (const storage of ["fridge", "freezer", "pantry"] as const) {
        const list = items[storage];
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          if (item.labelPhotoDataUrl && item.labelPhotoDataUrl.length > 64) {
            delete item.labelPhotoDataUrl;
            cleared += 1;
            changed = true;
          }
        }
      }
      if (changed) localStorage.setItem("friggg-items", JSON.stringify(items));
    }
  } catch {
    /* ignore */
  }

  return cleared;
}

/**
 * Aggressively shrink a data-URL photo for local attach (sync-friendly).
 * Falls back to empty string if still huge after compression attempt.
 */
export async function compressPhotoForStorage(
  dataUrl: string,
  opts?: { maxEdge?: number; quality?: number; maxChars?: number }
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 400;
  const quality = opts?.quality ?? 0.62;
  const maxChars = opts?.maxChars ?? 120_000;

  if (!dataUrl || !dataUrl.startsWith("data:image/")) return "";
  if (dataUrl.length <= maxChars && typeof document === "undefined") {
    return dataUrl.length <= maxChars ? dataUrl : "";
  }

  if (typeof document === "undefined") {
    return dataUrl.length <= maxChars ? dataUrl : "";
  }

  const shrink = (edge: number, q: number): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          const scale = Math.min(1, edge / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", q));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve("");
      img.src = dataUrl;
    });

  let out = await shrink(maxEdge, quality);
  if (out.length > maxChars) {
    out = await shrink(Math.min(maxEdge, 280), 0.5);
  }
  if (out.length > maxChars) {
    out = await shrink(200, 0.4);
  }
  return out.length <= maxChars ? out : "";
}
