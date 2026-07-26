/**
 * Platform factory — OCR + multi-device household sync.
 * M-24: env-driven defaults via feature-flags (override with setPlatform for tests).
 */

import type { Platform } from "@/platform/types";
import { getFeatureFlags } from "@/platform/feature-flags";
import { cloudSyncProvider } from "@/platform/local/sync-cloud";
import { xaiOcrProvider } from "@/platform/local/ocr-xai";
import { demoOcrProvider } from "@/platform/local/ocr-demo";
import { nonePushProvider } from "@/platform/local/push-none";
import { cloudInviteProvider } from "@/platform/local/invite-cloud";

export type PlatformConfig = Partial<Platform>;

let singleton: Platform | null = null;

export function createPlatform(overrides: PlatformConfig = {}): Platform {
  const flags = getFeatureFlags();
  return {
    sync: overrides.sync ?? cloudSyncProvider,
    ocr: overrides.ocr ?? (flags.forceDemoOcr ? demoOcrProvider : xaiOcrProvider),
    push: overrides.push ?? nonePushProvider,
    invite: overrides.invite ?? cloudInviteProvider,
  };
}

export function getPlatform(): Platform {
  if (!singleton) singleton = createPlatform();
  return singleton;
}

export function setPlatform(platform: Platform): void {
  singleton = platform;
}

/** Reset singleton (tests / flag changes in dev). */
export function resetPlatform(): void {
  singleton = null;
}

export { getFeatureFlags } from "@/platform/feature-flags";

export type {
  Platform,
  SyncProvider,
  OcrProvider,
  OcrDetectResult,
  OcrLineItem,
  PushProvider,
  InviteProvider,
} from "@/platform/types";
