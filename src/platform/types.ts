/**
 * Platform contracts for deferred infrastructure (D-1…D-4).
 * Local adapters implement these today; cloud adapters plug in later.
 */

import type {
  FamilyMember,
  PantryItemsByStorage,
  StorageKey,
} from "@/types/pantry";
import type { HouseholdSyncSnapshot, SyncCreds } from "@/lib/household-sync";

/** D-1 — multi-device pantry + household sync */
export interface SyncProvider {
  readonly id: string;
  readonly mode: "local" | "cloud";
  /** Pull remote pantry if any; local returns null */
  pullPantry(): Promise<PantryItemsByStorage | null>;
  pushPantry(items: PantryItemsByStorage): Promise<{ ok: boolean; reason?: string }>;
  pullFamily(): Promise<FamilyMember[] | null>;
  pushFamily(members: FamilyMember[]): Promise<{ ok: boolean; reason?: string }>;
  /**
   * Full household pull (items, members, profile, receipts, …).
   * Optional on local-only providers.
   */
  pullHousehold?(creds: SyncCreds): Promise<HouseholdSyncSnapshot | null>;
  pushHousehold?(
    creds: SyncCreds,
    snapshot?: HouseholdSyncSnapshot
  ): Promise<{ ok: boolean; reason?: string; backend?: string }>;
  getStatus?(): Promise<{ configured: boolean; backend: string; durable: boolean }>;
}

/** One product line returned by OCR / detection */
export type OcrLineItem = {
  name: string;
  qty: number;
  unit: string;
  emoji?: string;
  storage?: StorageKey;
  confidence?: number;
  price?: number;
  category?: string;
};

export type OcrDetectResult = {
  ok: boolean;
  mode: "live" | "demo" | "unavailable";
  provider: string;
  items: OcrLineItem[];
  store?: string | null;
  total?: number | null;
  currency?: string;
  reason?: string;
};

export interface OcrProvider {
  readonly id: string;
  readonly mode: "demo" | "live" | "unavailable";
  detectFromImage(imageDataUrl: string | null): Promise<OcrDetectResult>;
  supportsLiveCamera(): boolean;
  isConfigured(): Promise<boolean>;
}

export interface PushProvider {
  readonly id: string;
  readonly mode: "none" | "web-push";
  isSupported(): boolean;
  getPermission(): NotificationPermission | "unsupported";
  requestPermission(): Promise<NotificationPermission | "unsupported">;
  notify(title: string, body: string): Promise<void>;
}

export interface InviteProvider {
  readonly id: string;
  readonly mode: "local" | "remote";
  validateInvite(code: string): Promise<{
    ok: boolean;
    householdName?: string;
    memberName?: string;
    reason?: string;
  }>;
  acceptInvite(
    code: string,
    account: { email: string; name: string; password: string }
  ): Promise<{
    ok: boolean;
    reason?: string;
  }>;
}

export type Platform = {
  sync: SyncProvider;
  ocr: OcrProvider;
  push: PushProvider;
  invite: InviteProvider;
};
