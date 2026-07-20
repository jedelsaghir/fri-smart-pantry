/**
 * Platform factory — OCR + multi-device household sync.
 */

import type { Platform } from "@/platform/types";
import { cloudSyncProvider } from "@/platform/local/sync-cloud";
import { xaiOcrProvider } from "@/platform/local/ocr-xai";
import { nonePushProvider } from "@/platform/local/push-none";
import { localInviteProvider } from "@/platform/local/invite-local";

export type PlatformConfig = Partial<Platform>;

let singleton: Platform | null = null;

export function createPlatform(overrides: PlatformConfig = {}): Platform {
  return {
    sync: overrides.sync ?? cloudSyncProvider,
    ocr: overrides.ocr ?? xaiOcrProvider,
    push: overrides.push ?? nonePushProvider,
    invite: overrides.invite ?? localInviteProvider,
  };
}

export function getPlatform(): Platform {
  if (!singleton) singleton = createPlatform();
  return singleton;
}

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
