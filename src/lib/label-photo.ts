/**
 * Compress label / expiry photos for local pantry attachment (keep payloads small).
 */

import { compressPhotoForStorage } from "@/lib/storage-quota";

/** Downscale a data URL for storage next to a pantry item (not full OCR quality). */
export async function compressLabelPhoto(
  dataUrl: string,
  opts?: { maxEdge?: number; quality?: number }
): Promise<string> {
  return compressPhotoForStorage(dataUrl, {
    maxEdge: opts?.maxEdge ?? 400,
    quality: opts?.quality ?? 0.62,
    maxChars: 100_000,
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
