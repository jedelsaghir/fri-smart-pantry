/**
 * Server-only receipt OCR via xAI vision (XAI_API_KEY).
 * Never expose the key to the browser bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  RECEIPT_OCR_SYSTEM_PROMPT,
  enrichOcrItems,
  extractJsonPayload,
  extractResponseText,
  parseReceiptOcrPayload,
} from "@/lib/ocr-parse";
import type { OcrDetectResult } from "@/platform/types";

const MAX_IMAGE_CHARS = 12_000_000; // ~9MB base64 budget

function getApiKey(): string | undefined {
  // Server env only (not VITE_*)
  return process.env.XAI_API_KEY || process.env.xai_api_key || undefined;
}

function getModel(): string {
  return process.env.XAI_OCR_MODEL || process.env.XAI_MODEL || "grok-4.5";
}

export type OcrServerStatus = {
  configured: boolean;
  provider: "xai";
  model: string;
};

export const getOcrServerStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<OcrServerStatus> => {
    return {
      configured: Boolean(getApiKey()),
      provider: "xai",
      model: getModel(),
    };
  }
);

export type OcrReceiptInput = {
  imageDataUrl: string;
};

export const ocrReceiptFromImage = createServerFn({ method: "POST" })
  .validator((data: OcrReceiptInput) => {
    if (!data || typeof data !== "object") throw new Error("Invalid payload");
    if (typeof data.imageDataUrl !== "string" || !data.imageDataUrl.startsWith("data:image/")) {
      throw new Error("imageDataUrl must be a data:image/* URL");
    }
    if (data.imageDataUrl.length > MAX_IMAGE_CHARS) {
      throw new Error("Image too large for OCR — try a smaller photo");
    }
    return data;
  })
  .handler(async ({ data }): Promise<OcrDetectResult> => {
    const key = getApiKey();
    if (!key) {
      return {
        ok: false,
        mode: "unavailable",
        provider: "xai",
        items: [],
        reason:
          "OCR is not configured. Set XAI_API_KEY on the server to enable receipt vision.",
      };
    }

    const model = getModel();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      // Prefer Responses API (image understanding docs)
      const response = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_image",
                  image_url: data.imageDataUrl,
                  detail: "high",
                },
                {
                  type: "input_text",
                  text: RECEIPT_OCR_SYSTEM_PROMPT,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        // Fallback: chat completions vision shape (some deployments)
        if (response.status === 404 || response.status === 400) {
          return await ocrViaChatCompletions(key, model, data.imageDataUrl, controller.signal);
        }
        const errText = await response.text().catch(() => "");
        return {
          ok: false,
          mode: "live",
          provider: "xai",
          items: [],
          reason: `Vision API error ${response.status}: ${errText.slice(0, 200) || response.statusText}`,
        };
      }

      const body = await response.json();
      return parseModelBody(body, "xai");
    } catch (err) {
      const message = err instanceof Error ? err.message : "OCR request failed";
      return {
        ok: false,
        mode: "live",
        provider: "xai",
        items: [],
        reason: message.includes("abort") ? "OCR timed out — try again" : message,
      };
    } finally {
      clearTimeout(timeout);
    }
  });

async function ocrViaChatCompletions(
  key: string,
  model: string,
  imageDataUrl: string,
  signal: AbortSignal
): Promise<OcrDetectResult> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_OCR_SYSTEM_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    return {
      ok: false,
      mode: "live",
      provider: "xai",
      items: [],
      reason: `Vision API error ${response.status}: ${errText.slice(0, 200) || response.statusText}`,
    };
  }

  const body = await response.json();
  return parseModelBody(body, "xai");
}

function parseModelBody(body: unknown, provider: string): OcrDetectResult {
  try {
    const text = extractResponseText(body);
    if (!text.trim()) {
      return {
        ok: false,
        mode: "live",
        provider,
        items: [],
        reason: "Empty model response",
      };
    }
    const raw = extractJsonPayload(text);
    const parsed = parseReceiptOcrPayload(raw);
    return {
      ok: true,
      mode: "live",
      provider,
      items: enrichOcrItems(parsed.items),
      store: parsed.store,
      total: parsed.total,
      currency: parsed.currency,
    };
  } catch (err) {
    return {
      ok: false,
      mode: "live",
      provider,
      items: [],
      reason: err instanceof Error ? err.message : "Failed to parse OCR JSON",
    };
  }
}
