/**
 * Platform contracts for deferred infrastructure (D-1…D-4).
 * Local adapters implement these today; cloud adapters plug in later.
 */

import type {
  FamilyMember,
  PantryItemsByStorage,
  StorageKey,
} from "@/types/pantry";

/** D-1 — multi-device pantry + family sync */
export interface SyncProvider {
  readonly id: string;
  readonly mode: "local" | "cloud";
  /** Pull remote snapshot if any; local returns null */
  pullPantry(): Promise<PantryItemsByStorage | null>;
  /** Push local pantry; local is no-op success */
  pushPantry(items: PantryItemsByStorage): Promise<{ ok: boolean; reason?: string }>;
  pullFamily(): Promise<FamilyMember[] | null>;
  pushFamily(members: FamilyMember[]): Promise<{ ok: boolean; reason?: string }>;
}

/** One product line returned by OCR / detection */
export type OcrLineItem = {
  name: string;
  qty: number;
  unit: string;
  emoji?: string;
  storage?: StorageKey;
  /** 0–1 model confidence */
  confidence?: number;
  /** Line total when known */
  price?: number;
  category?: string;
};

/** Structured result from OcrProvider.detectFromImage */
export type OcrDetectResult = {
  ok: boolean;
  mode: "live" | "demo" | "unavailable";
  provider: string;
  items: OcrLineItem[];
  store?: string | null;
  total?: number | null;
  currency?: string;
  /** Human-readable error / config message when ok is false or items empty */
  reason?: string;
};

/** D-2 — camera capture + OCR / item detection */
export interface OcrProvider {
  readonly id: string;
  readonly mode: "demo" | "live" | "unavailable";
  /**
   * Analyze a receipt image (data URL). Requires a real image for live mode.
   * Never invents grocery lines when the provider cannot read the image.
   */
  detectFromImage(imageDataUrl: string | null): Promise<OcrDetectResult>;
  /** Whether getUserMedia camera capture is available in this browser */
  supportsLiveCamera(): boolean;
  /** Best-effort probe (e.g. server has XAI_API_KEY) */
  isConfigured(): Promise<boolean>;
}

/** D-3 — push / system notifications */
export interface PushProvider {
  readonly id: string;
  readonly mode: "none" | "web-push";
  isSupported(): boolean;
  getPermission(): NotificationPermission | "unsupported";
  requestPermission(): Promise<NotificationPermission | "unsupported">;
  /** Schedule or send a local/push alert; no-op when unsupported */
  notify(title: string, body: string): Promise<void>;
}

/** D-4 — multi-device invite acceptance */
export interface InviteProvider {
  readonly id: string;
  readonly mode: "local" | "remote";
  /** Validate invite code; remote hits API */
  validateInvite(code: string): Promise<{
    ok: boolean;
    householdName?: string;
    memberName?: string;
    reason?: string;
  }>;
  /** Accept invite for current account */
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
