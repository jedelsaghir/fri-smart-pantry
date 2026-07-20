/**
 * Demo OCR — only for explicit tests via setPlatform().
 * Default production path is xaiOcrProvider (real vision / unavailable).
 * Does NOT invent items when used as the app default anymore.
 */

import type { OcrProvider } from "@/platform/types";
import { enrichOcrItems } from "@/lib/ocr-parse";

/**
 * @deprecated Prefer xaiOcrProvider. Kept for unit/integration tests that
 * inject demo detections with setPlatform(createPlatform({ ocr: demoOcrProvider })).
 */
export const demoOcrProvider: OcrProvider = {
  id: "demo-ocr",
  mode: "demo",
  supportsLiveCamera() {
    return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
  },
  async isConfigured() {
    return true;
  },
  async detectFromImage(imageDataUrl: string | null) {
    await new Promise((r) => setTimeout(r, 40));
    if (!imageDataUrl) {
      return {
        ok: false,
        mode: "demo",
        provider: "demo-ocr",
        items: [],
        reason: "Demo OCR still requires an image input in the new architecture.",
      };
    }
    // Fixed tiny sample for tests only — not random supermarket fiction
    return {
      ok: true,
      mode: "demo",
      provider: "demo-ocr",
      store: "Demo Store",
      total: 3.5,
      currency: "EUR",
      items: enrichOcrItems([
        {
          name: "Demo milk",
          qty: 1,
          unit: "L",
          storage: "fridge",
          confidence: 0.95,
          price: 1.5,
        },
        {
          name: "Demo eggs",
          qty: 6,
          unit: "pcs",
          storage: "fridge",
          confidence: 0.7,
          price: 2.0,
        },
      ]),
    };
  },
};
