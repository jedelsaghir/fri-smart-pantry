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

/**
 * User-facing copy for the optional expiry photo step (H-05).
 * Biases toward skip; does not claim OCR of dates.
 */
export const EXPIRY_ASSIST_COPY = {
  title: "Add expiry notes? (optional)",
  subtitle:
    "Skip anytime — your items are already in the pantry. Only add a photo or days-left if you want a quick reference.",
  honesty:
    "We do not auto-read dates from photos yet. A small photo stays on this device only as a visual reminder; type days left yourself if you can see the date.",
  empty: "No items from this scan to attach notes to.",
  skipPrimary: "Skip — done",
  saveSecondary: "Save notes & finish",
} as const;
