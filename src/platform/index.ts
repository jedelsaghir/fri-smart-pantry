/**
 * Platform factory — swap adapters here when cloud OCR/sync/push ship.
 *
 * OCR default: live xAI vision via server function (requires XAI_API_KEY).
 * Without a key, detectFromImage returns ok:false / empty items — never fake groceries.
 */

import type { Platform } from "@/platform/types";
import { localSyncProvider } from "@/platform/local/sync-local";
import { xaiOcrProvider } from "@/platform/local/ocr-xai";
import { nonePushProvider } from "@/platform/local/push-none";
import { localInviteProvider } from "@/platform/local/invite-local";

export type PlatformConfig = Partial<Platform>;

let singleton: Platform | null = null;

export function createPlatform(overrides: PlatformConfig = {}): Platform {
  return {
    sync: overrides.sync ?? localSyncProvider,
    ocr: overrides.ocr ?? xaiOcrProvider,
    push: overrides.push ?? nonePushProvider,
    invite: overrides.invite ?? localInviteProvider,
  };
}

/** App-wide platform instance (live OCR adapter by default). */
export function getPlatform(): Platform {
  if (!singleton) singleton = createPlatform();
  return singleton;
}

/** Test helper / future feature-flag entry */
export function setPlatform(platform: Platform): void {
  singleton = platform;
}

export type {
  Platform,
  SyncProvider,
  OcrProvider,
  OcrDetectResult,
  OcrLineItem,
  PushProvider,
  InviteProvider,
} from "@/platform/types";
