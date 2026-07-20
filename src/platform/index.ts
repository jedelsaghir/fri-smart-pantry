/**
 * Platform factory — swap adapters here when cloud OCR/sync/push ship.
 *
 * Today: fully local / demo.
 * Tomorrow: e.g. `createPlatform({ sync: cloudSync, ocr: visionOcr, ... })`
 */

import type { Platform } from "@/platform/types";
import { localSyncProvider } from "@/platform/local/sync-local";
import { demoOcrProvider } from "@/platform/local/ocr-demo";
import { nonePushProvider } from "@/platform/local/push-none";
import { localInviteProvider } from "@/platform/local/invite-local";

export type PlatformConfig = Partial<Platform>;

let singleton: Platform | null = null;

export function createPlatform(overrides: PlatformConfig = {}): Platform {
  return {
    sync: overrides.sync ?? localSyncProvider,
    ocr: overrides.ocr ?? demoOcrProvider,
    push: overrides.push ?? nonePushProvider,
    invite: overrides.invite ?? localInviteProvider,
  };
}

/** App-wide platform instance (local/demo by default). */
export function getPlatform(): Platform {
  if (!singleton) singleton = createPlatform();
  return singleton;
}

/** Test helper / future feature-flag entry */
export function setPlatform(platform: Platform): void {
  singleton = platform;
}

export type { Platform, SyncProvider, OcrProvider, PushProvider, InviteProvider } from "@/platform/types";
