/**
 * Shared types + small helpers for the receipt scan flow.
 */

import type { DetectedItem, StorageKey, StoredReceipt } from "@/types/pantry";
import type { FlatPantryRef } from "@/lib/ocr-merge";

export type { DetectedItem };

export type CapturedPhoto = {
  id: string;
  dataUrl: string;
};

export type ScanStep =
  | "capture"
  | "processing"
  | "result"
  | "review"
  | "expiry-assist"
  | "error";

/** Post-scan expiry photo / days-left signal for one scanned line */
export type ExpiryAssistSignal = {
  /** Stable key within this scan session (detected item id) */
  scanItemId: string;
  name: string;
  unit: string;
  storage: StorageKey;
  emoji: string;
  /** Compressed label photo data URL */
  labelPhotoDataUrl?: string;
  /** User-entered days until expiry when they can read the label */
  daysLeft?: number;
};

export type OcrMeta = {
  store?: string | null;
  total?: number | null;
  currency?: string;
};

export interface ReceiptScanFlowProps {
  open: boolean;
  onClose: () => void;
  onItemsAdded: (
    items: Array<Omit<DetectedItem, "confidence" | "id">>,
    options?: { silent?: boolean }
  ) => void;
  /** Persist full receipt (photo + line items) for Finances history */
  onReceiptSaved?: (receipt: StoredReceipt) => void;
  /** Optional label photos + days-left after a successful scan */
  onExpirySignals?: (signals: ExpiryAssistSignal[]) => void;
  /** Existing pantry rows — similar / duplicate lines go to review */
  pantryItems?: FlatPantryRef[];
  /** Called when scan finishes cleanly (no review) so parent can open Pantry tab */
  onNavigateToPantry?: () => void;
}

export function formatStorageLabel(storage: StorageKey) {
  return storage === "fridge" ? "Fridge" : storage === "freezer" ? "Freezer" : "Pantry";
}

export function createPhotoId() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function scanHeaderTitle(step: ScanStep, resultOk: boolean): string {
  if (step === "result") return resultOk ? "Receipt ready" : "Scan issue";
  if (step === "review") return "Review items";
  if (step === "expiry-assist") return "Expiry labels";
  if (step === "processing") return "Processing";
  return "Scan receipt";
}
