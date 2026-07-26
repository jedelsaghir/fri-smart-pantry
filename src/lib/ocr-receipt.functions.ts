/**
 * OCR server functions (thin createServerFn wrappers only).
 *
 * Runtime helpers live in `ocr-receipt.server.ts` so TanStack Start's
 * production `?tss-serverfn-split` transform does not strip them.
 * Handlers must only call imported symbols — no module-local helpers.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  resolveOcrServerStatus,
  runOcrReceiptFromImage,
  validateOcrReceiptInput,
  type OcrReceiptInput,
  type OcrServerStatus,
} from "@/lib/ocr-receipt.server";
import type { OcrDetectResult } from "@/platform/types";

// Re-export types for consumers / tests that imported from this module
export type { OcrHealth, OcrServerStatus, OcrReceiptInput } from "@/lib/ocr-receipt.server";

export const getOcrServerStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<OcrServerStatus> => {
    return resolveOcrServerStatus();
  }
);

export const ocrReceiptFromImage = createServerFn({ method: "POST" })
  .validator((data: OcrReceiptInput) => validateOcrReceiptInput(data))
  .handler(async ({ data }): Promise<OcrDetectResult> => {
    return runOcrReceiptFromImage(data.imageDataUrl);
  });
