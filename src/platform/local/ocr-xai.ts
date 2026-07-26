/**
 * Live OCR provider — calls server function → xAI vision.
 * Degrades to mode "unavailable" when XAI_API_KEY is not set on the server.
 */

import type { OcrClientStatus, OcrDetectResult, OcrProvider } from "@/platform/types";
import { getOcrServerStatus, ocrReceiptFromImage } from "@/lib/ocr-receipt.functions";
import { prepareImageForOcr } from "@/lib/ocr-image";

function cameraSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function unknownStatus(message: string): OcrClientStatus {
  return {
    configured: false,
    keyPresent: false,
    health: "unknown",
    message,
    provider: "xai-vision",
  };
}

export const xaiOcrProvider: OcrProvider = {
  id: "xai-vision",
  mode: "live",

  supportsLiveCamera() {
    return cameraSupported();
  },

  async getStatus(): Promise<OcrClientStatus> {
    try {
      const status = await getOcrServerStatus();
      return {
        configured: Boolean(status.configured || status.keyPresent),
        keyPresent: Boolean(status.keyPresent),
        health: status.health,
        message: status.message,
        provider: status.provider,
        model: status.model,
      };
    } catch {
      return unknownStatus(
        "Couldn’t verify OCR status from the server. Try again, or scan a photo to test."
      );
    }
  },

  async isConfigured() {
    try {
      const status = await this.getStatus!();
      // Key present counts as configured — auth/network issues are separate messages
      return status.keyPresent || status.configured;
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

    // Downscale only — full receipt enhance (crop/contrast/sharpen) runs in the
    // scan flow before detect so multi-photo processing can show that stage.
    let prepared = imageDataUrl;
    try {
      prepared = await prepareImageForOcr(imageDataUrl, { enhance: false });
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
