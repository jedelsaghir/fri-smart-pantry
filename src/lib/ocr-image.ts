/**
 * Client-side image prep for OCR (resize / compress + receipt enhancement).
 */

import { preprocessReceiptImage } from "@/lib/receipt-preprocess";

export type PrepareImageOptions = {
  maxEdge?: number;
  quality?: number;
  /** Full receipt enhance (crop, contrast, sharpen). Default true. */
  enhance?: boolean;
  /** Faster path: skip deskew / denoise */
  fast?: boolean;
};

/**
 * Prepare a capture for OCR:
 *  1. Receipt pre-process (crop, deskew, contrast, denoise, sharpen)
 *  2. Downscale / re-encode if still large
 */
export async function prepareImageForOcr(
  dataUrl: string,
  opts: PrepareImageOptions = {}
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.85;
  const enhance = opts.enhance !== false;

  if (!dataUrl.startsWith("data:image/")) return dataUrl;

  let prepared = dataUrl;

  if (enhance && typeof document !== "undefined") {
    try {
      const result = await preprocessReceiptImage(dataUrl, {
        maxEdge,
        quality,
        fast: opts.fast,
      });
      prepared = result.dataUrl;
    } catch {
      prepared = dataUrl;
    }
  }

  // Final size guard for tiny payloads already enhanced
  if (prepared.length < 120_000) return prepared;

  return downscaleDataUrl(prepared, maxEdge, quality);
}

function downscaleDataUrl(
  dataUrl: string,
  maxEdge: number,
  quality: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        if (scale >= 0.98) {
          resolve(dataUrl);
          return;
        }
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

/** Capture current video frame as a JPEG data URL (raw — enhance later for OCR) */
export function captureVideoFrame(
  video: HTMLVideoElement,
  opts: { maxEdge?: number; quality?: number } = {}
): string {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.9;
  let w = video.videoWidth || 720;
  let h = video.videoHeight || 960;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Capture + light enhance for thumbnail display (fast path).
 * Full enhance still runs again before OCR for accuracy.
 */
export async function captureAndPrepareFrame(
  video: HTMLVideoElement,
  opts: PrepareImageOptions = {}
): Promise<string> {
  const raw = captureVideoFrame(video, {
    maxEdge: opts.maxEdge ?? 1600,
    quality: opts.quality ?? 0.9,
  });
  if (!raw) return "";
  // Fast enhance for snappy multi-shot; OCR path re-runs full enhance
  return prepareImageForOcr(raw, { ...opts, fast: true, enhance: true });
}
