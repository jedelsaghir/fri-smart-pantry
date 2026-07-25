/**
 * Compress label / expiry photos for local pantry attachment (keep payloads small).
 */

/** Downscale a data URL for storage next to a pantry item (not full OCR quality). */
export async function compressLabelPhoto(
  dataUrl: string,
  opts?: { maxEdge?: number; quality?: number }
): Promise<string> {
  const maxEdge = opts?.maxEdge ?? 480;
  const quality = opts?.quality ?? 0.72;
  if (!dataUrl.startsWith("data:image/") || typeof document === "undefined") {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
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
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** User-facing limits for the expiry photo step */
export const EXPIRY_ASSIST_COPY = {
  title: "Capture expiry labels?",
  subtitle:
    "Optional — snap a product date label so you can check it later. Skip anytime.",
  honesty:
    "We keep a small photo on this device with the item. Auto-reading dates from labels isn’t reliable yet — set days left yourself if you can see the date.",
  empty: "No items from this scan to attach photos to.",
} as const;
