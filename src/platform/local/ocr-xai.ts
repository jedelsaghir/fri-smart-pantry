/**
 * Live OCR provider — calls server function → xAI vision.
 * Degrades to mode "unavailable" when XAI_API_KEY is not set on the server.
 */

import type { OcrDetectResult, OcrProvider } from "@/platform/types";
import { getOcrServerStatus, ocrReceiptFromImage } from "@/lib/ocr-receipt.functions";
import { prepareImageForOcr } from "@/lib/ocr-image";

function cameraSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export const xaiOcrProvider: OcrProvider = {
  id: "xai-vision",
  mode: "live",

  supportsLiveCamera() {
    return cameraSupported();
  },

  async isConfigured() {
    try {
      const status = await getOcrServerStatus();
      return status.configured;
    } catch {
      return false;
    }
  },

  async detectFromImage(imageDataUrl: string | null): Promise<OcrDetectResult> {
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return {
        ok: false,
        mode: "live",
        provider: this.id,
        items: [],
        reason: "A receipt photo is required for OCR.",
      };
    }

    let prepared = imageDataUrl;
    try {
      prepared = await prepareImageForOcr(imageDataUrl);
    } catch {
      prepared = imageDataUrl;
    }

    try {
      const result = await ocrReceiptFromImage({ data: { imageDataUrl: prepared } });
      return {
        ...result,
        provider: result.provider || this.id,
      };
    } catch (err) {
      return {
        ok: false,
        mode: "unavailable",
        provider: this.id,
        items: [],
        reason: err instanceof Error ? err.message : "OCR request failed",
      };
    }
  },
};
