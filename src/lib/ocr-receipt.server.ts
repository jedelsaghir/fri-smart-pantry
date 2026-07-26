/**
 * OCR server implementation (runtime helpers).
 *
 * IMPORTANT: Keep this separate from createServerFn modules.
 * TanStack Start's production `?tss-serverfn-split` transform keeps only
 * imports + handler bodies in *.functions.ts and strips sibling helpers —
 * which caused "getApiKey is not defined" on the live worker.
 *
 * Never log or return the raw API key.
 */

import {
  RECEIPT_OCR_SYSTEM_PROMPT,
  enrichOcrItems,
  extractJsonPayload,
  extractResponseText,
  parseReceiptOcrPayload,
} from "@/lib/ocr-parse";
import type { OcrDetectResult } from "@/platform/types";

export const MAX_IMAGE_CHARS = 12_000_000; // ~9MB base64 budget
const HEALTH_PROBE_TIMEOUT_MS = 6_000;
const OCR_TIMEOUT_MS = 90_000;

function readEnv(name: string): string | undefined {
  try {
    const v = process.env[name];
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    if (!t || t === "undefined" || t === "null") return undefined;
    return t;
  } catch {
    return undefined;
  }
}

/**
 * Resolve xAI API key from server env only (never VITE_*).
 * Tries common aliases used by hosts / dashboards.
 */
export function getApiKey(): string | undefined {
  return (
    readEnv("XAI_API_KEY") ||
    readEnv("xai_api_key") ||
    readEnv("XAI_KEY") ||
    readEnv("GROK_API_KEY") ||
    undefined
  );
}

export function getModel(): string {
  return readEnv("XAI_OCR_MODEL") || readEnv("XAI_MODEL") || "grok-4.5";
}

/** Server OCR health — safe to send to the client (no key material). */
export type OcrHealth =
  | "missing"
  | "ok"
  | "auth_failed"
  | "network"
  | "model"
  | "error";

export type OcrServerStatus = {
  /**
   * True when a non-empty API key is present on the server.
   * Prefer this over treating "auth_failed" as unconfigured.
   */
  configured: boolean;
  keyPresent: boolean;
  health: OcrHealth;
  /** Short, safe banner / toast copy — never includes the key */
  message: string;
  provider: "xai";
  model: string;
};

export type OcrReceiptInput = {
  imageDataUrl: string;
};

function statusForMissing(model: string): OcrServerStatus {
  return {
    configured: false,
    keyPresent: false,
    health: "missing",
    message:
      "OCR is not configured. Set XAI_API_KEY on the server (Lovable secrets / host env) — never VITE_*.",
    provider: "xai",
    model,
  };
}

/**
 * Lightweight xAI probe: GET /v1/models with the server key.
 * Distinguishes missing key vs auth vs network vs other failures.
 * Never returns or logs the key value.
 */
export async function probeXaiHealth(
  key: string,
  _model: string
): Promise<Omit<OcrServerStatus, "provider" | "model"> & { provider?: "xai"; model?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_PROBE_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.x.ai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (response.ok) {
      return {
        configured: true,
        keyPresent: true,
        health: "ok",
        message: "Receipt vision is ready.",
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        configured: true,
        keyPresent: true,
        health: "auth_failed",
        message:
          "API key is set, but xAI rejected it (auth). Check XAI_API_KEY in server secrets.",
      };
    }

    if (response.status === 404 || response.status === 422) {
      return {
        configured: true,
        keyPresent: true,
        health: "model",
        message: `API key is set, but the models probe failed (${response.status}). Scanning may still work — try a photo.`,
      };
    }

    return {
      configured: true,
      keyPresent: true,
      health: "error",
      message: `API key is set, but xAI returned ${response.status}. Try again or check xAI status.`,
    };
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === "AbortError") ||
      (err instanceof Error && /abort/i.test(err.message));
    return {
      configured: true,
      keyPresent: true,
      health: "network",
      message: aborted
        ? "API key is set, but the xAI health check timed out. Scanning may still work."
        : "API key is set, but we couldn’t reach xAI (network). Check outbound access and try again.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Full health status for getOcrServerStatus handler. */
export async function resolveOcrServerStatus(): Promise<OcrServerStatus> {
  const model = getModel();
  const key = getApiKey();

  if (!key) {
    return statusForMissing(model);
  }

  try {
    const probe = await probeXaiHealth(key, model);
    return {
      configured: true,
      keyPresent: true,
      health: probe.health,
      message: probe.message,
      provider: "xai",
      model,
    };
  } catch {
    return {
      configured: true,
      keyPresent: true,
      health: "error",
      message:
        "API key is set, but the health check failed unexpectedly. Try scanning a receipt.",
      provider: "xai",
      model,
    };
  }
}

/** Validate OCR image payload (used by createServerFn validator). */
export function validateOcrReceiptInput(data: OcrReceiptInput): OcrReceiptInput {
  if (!data || typeof data !== "object") throw new Error("Invalid payload");
  if (typeof data.imageDataUrl !== "string" || !data.imageDataUrl.startsWith("data:image/")) {
    throw new Error("imageDataUrl must be a data:image/* URL");
  }
  if (data.imageDataUrl.length > MAX_IMAGE_CHARS) {
    throw new Error("Image too large for OCR — try a smaller photo");
  }
  return data;
}

/** Strip anything that might look like a bearer token from error bodies */
function sanitizeApiErrorSnippet(raw: string): string {
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9._\-]+/g, "[redacted]")
    .replace(/xai-[A-Za-z0-9._\-]+/gi, "[redacted]")
    .slice(0, 180);
}

function mapVisionHttpError(status: number, snippet: string): string {
  if (status === 401 || status === 403) {
    return "xAI rejected the API key (auth). Check XAI_API_KEY on the server.";
  }
  if (status === 404 || status === 422) {
    return `Vision model request failed (${status}). Check XAI_OCR_MODEL. ${snippet}`.trim();
  }
  if (status === 429) {
    return "xAI rate limit hit — wait a moment and try again.";
  }
  return `Vision API error ${status}${snippet ? `: ${snippet}` : ""}`;
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
    const safeSnippet = sanitizeApiErrorSnippet(errText) || response.statusText;
    return {
      ok: false,
      mode: "live",
      provider: "xai",
      items: [],
      reason: mapVisionHttpError(response.status, safeSnippet),
    };
  }

  const body = await response.json();
  return parseModelBody(body, "xai");
}

/** Full OCR path for ocrReceiptFromImage handler. */
export async function runOcrReceiptFromImage(imageDataUrl: string): Promise<OcrDetectResult> {
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
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
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
                image_url: imageDataUrl,
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
      if (response.status === 404 || response.status === 400) {
        return await ocrViaChatCompletions(key, model, imageDataUrl, controller.signal);
      }
      const errText = await response.text().catch(() => "");
      const safeSnippet = sanitizeApiErrorSnippet(errText) || response.statusText;
      return {
        ok: false,
        mode: "live",
        provider: "xai",
        items: [],
        reason: mapVisionHttpError(response.status, safeSnippet),
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
      reason: message.includes("abort")
        ? "OCR timed out — try again"
        : /fetch|network|ECONN|ENOTFOUND/i.test(message)
          ? "Couldn’t reach xAI (network). Try again in a moment."
          : "OCR request failed. Try again or check server logs.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
