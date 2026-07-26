/**
 * Multi-device household snapshot — pure serialize / apply helpers.
 * Cloud transport lives in platform + server functions.
 */

import type {
  ActivityLogEntry,
  CatalogItem,
  FamilyMember,
  PantryItem,
  PantryItemsByStorage,
  ShoppingListItem,
  StoredReceipt,
} from "@/types/pantry";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { safeSetItem, stripLocalPhotosToFreeSpace } from "@/lib/storage-quota";

export const HOUSEHOLD_SYNC_VERSION = 2 as const;

export type HouseholdSyncProfile = {
  name?: string;
  email?: string;
  emoji?: string;
  memberId?: string;
  accountId?: string;
};

export type HouseholdSyncAccount = {
  id: string;
  memberId: string;
  email: string;
  /**
   * @deprecated Never write plain passwords into sync snapshots.
   * Legacy remote blobs may still contain this; stripped on apply/build.
   */
  password?: string;
  /** Preferred: SHA-256 via hashSyncPassword (same as local accounts) */
  passwordHash?: string;
  name: string;
  emoji: string;
};

/** Strip plain passwords from account rows before local/cloud persistence. */
export function sanitizeAccountsForSync(
  accounts: HouseholdSyncAccount[] | undefined | null
): HouseholdSyncAccount[] | undefined {
  if (!accounts || !Array.isArray(accounts)) return undefined;
  return accounts.map((a) => {
    const { password: _plain, ...rest } = a;
    return { ...rest, password: undefined };
  });
}

/** Full household blob shared across devices for one account/household */
export type HouseholdSyncSnapshot = {
  version: typeof HOUSEHOLD_SYNC_VERSION;
  updatedAt: string;
  /**
   * Last cloud `updatedAt` this device based the push on (optimistic concurrency).
   * Server rejects when cloud is strictly newer than this base.
   */
  baseUpdatedAt?: string;
  /** Canonical account email (lowercased) that owns this blob */
  email: string;
  items?: PantryItemsByStorage;
  catalog?: CatalogItem[];
  receipts?: StoredReceipt[];
  shoppingList?: ShoppingListItem[];
  activityLog?: ActivityLogEntry[];
  familyMembers?: FamilyMember[];
  household?: string;
  profile?: HouseholdSyncProfile;
  accounts?: HouseholdSyncAccount[];
  theme?: string;
  notifications?: string;
};

export type SyncCreds = {
  email: string;
  password: string;
};

export async function hashSyncPassword(email: string, password: string): Promise<string> {
  const normalized = `${email.trim().toLowerCase()}:${password}:frigg-sync-v2`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const data = new TextEncoder().encode(normalized);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Node fallback (server)
  try {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(normalized).digest("hex");
  } catch {
    // Last resort — not for production
    let h = 0;
    for (let i = 0; i < normalized.length; i++) h = (h * 31 + normalized.charCodeAt(i)) >>> 0;
    return `x${h.toString(16)}`;
  }
}

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Build snapshot from current localStorage (browser only) */
export function buildSnapshotFromLocalStorage(email: string): HouseholdSyncSnapshot {
  const rawAccounts = readJson<HouseholdSyncAccount[]>(STORAGE_KEYS.ACCOUNTS);
  const meta = readLocalSyncMeta();
  // Strip huge photos from cloud payload when over soft budget (keep local copies)
  let receipts = readJson<StoredReceipt[]>(STORAGE_KEYS.RECEIPTS);
  let items = readJson<PantryItemsByStorage>(STORAGE_KEYS.ITEMS);
  const approx =
    JSON.stringify(receipts || []).length + JSON.stringify(items || {}).length;
  if (approx > 1_500_000) {
    receipts = (receipts || []).map((r) => ({
      ...r,
      imageDataUrl: r.imageDataUrl && r.imageDataUrl.length > 8_000 ? "" : r.imageDataUrl,
    }));
    if (items) {
      const stripLabels = (list: PantryItem[] | undefined) =>
        (list || []).map((i) => {
          if (!i.labelPhotoDataUrl || i.labelPhotoDataUrl.length <= 4_000) return i;
          const { labelPhotoDataUrl: _p, ...rest } = i;
          return rest;
        });
      items = {
        fridge: stripLabels(items.fridge),
        freezer: stripLabels(items.freezer),
        pantry: stripLabels(items.pantry),
      };
    }
  }
  return {
    version: HOUSEHOLD_SYNC_VERSION,
    updatedAt: new Date().toISOString(),
    baseUpdatedAt: meta.lastRemoteUpdatedAt,
    email: email.trim().toLowerCase(),
    items,
    catalog: readJson(STORAGE_KEYS.CATALOG),
    receipts,
    shoppingList: readJson(STORAGE_KEYS.SHOPPING_LIST),
    activityLog: readJson(STORAGE_KEYS.ACTIVITY_LOG),
    familyMembers: readJson(STORAGE_KEYS.FAMILY_MEMBERS),
    household: localStorage.getItem(STORAGE_KEYS.HOUSEHOLD) || undefined,
    profile: readJson(STORAGE_KEYS.PROFILE),
    // Never push plain passwords into the cloud household blob
    accounts: sanitizeAccountsForSync(rawAccounts),
    theme: localStorage.getItem(STORAGE_KEYS.THEME) || undefined,
    notifications: localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || undefined,
  };
}

export function validateSnapshot(raw: unknown): HouseholdSyncSnapshot {
  if (!raw || typeof raw !== "object") throw new Error("Invalid sync snapshot");
  const s = raw as HouseholdSyncSnapshot;
  if (s.version !== HOUSEHOLD_SYNC_VERSION && (s as { version?: number }).version !== 1) {
    // accept v1 shape loosely as v2
    if ((s as { version?: number }).version !== 1 && s.version !== HOUSEHOLD_SYNC_VERSION) {
      throw new Error("Unsupported sync version");
    }
  }
  if (!s.email || typeof s.email !== "string") throw new Error("Snapshot missing email");
  return {
    ...s,
    version: HOUSEHOLD_SYNC_VERSION,
    email: s.email.trim().toLowerCase(),
    updatedAt: s.updatedAt || new Date().toISOString(),
  };
}

/**
 * Apply remote snapshot into localStorage.
 * Keeps LOGGED_IN / CURRENT_USER from the session that just authenticated.
 */
export function applySnapshotToLocalStorage(
  snapshot: HouseholdSyncSnapshot,
  opts?: { currentUserId?: string | null }
): void {
  const s = validateSnapshot(snapshot);

  const write = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    const result = safeSetItem(key, payload, { freeSpace: stripLocalPhotosToFreeSpace });
    if (!result.ok && result.reason === "quota") {
      // Prefer core data: retry without photos for receipt/items payloads
      if (key === STORAGE_KEYS.RECEIPTS && typeof value !== "string") {
        const stripped = (value as StoredReceipt[]).map((r) => ({ ...r, imageDataUrl: "" }));
        safeSetItem(key, JSON.stringify(stripped));
      } else if (key === STORAGE_KEYS.ITEMS && typeof value !== "string") {
        const items = value as PantryItemsByStorage;
        const strip = (list: typeof items.fridge) =>
          list.map(({ labelPhotoDataUrl: _p, ...rest }) => rest);
        safeSetItem(
          key,
          JSON.stringify({
            fridge: strip(items.fridge || []),
            freezer: strip(items.freezer || []),
            pantry: strip(items.pantry || []),
          })
        );
      }
    }
  };

  write(STORAGE_KEYS.ITEMS, s.items);
  write(STORAGE_KEYS.CATALOG, s.catalog);
  write(STORAGE_KEYS.RECEIPTS, s.receipts);
  write(STORAGE_KEYS.SHOPPING_LIST, s.shoppingList);
  write(STORAGE_KEYS.ACTIVITY_LOG, s.activityLog);
  write(STORAGE_KEYS.FAMILY_MEMBERS, s.familyMembers);
  if (s.household) {
    safeSetItem(STORAGE_KEYS.HOUSEHOLD, s.household);
  }
  write(STORAGE_KEYS.PROFILE, s.profile);
  // Strip plain passwords from remote/legacy blobs before writing local accounts
  const safeAccounts = sanitizeAccountsForSync(s.accounts);
  write(STORAGE_KEYS.ACCOUNTS, safeAccounts);
  if (s.theme) safeSetItem(STORAGE_KEYS.THEME, s.theme);
  if (s.notifications != null) safeSetItem(STORAGE_KEYS.NOTIFICATIONS, s.notifications);

  if (opts?.currentUserId) {
    safeSetItem(STORAGE_KEYS.CURRENT_USER, opts.currentUserId);
  }
  safeSetItem(STORAGE_KEYS.LOGGED_IN, "true");
}

/**
 * Prefer newer updatedAt; if equal, prefer remote for multi-device login.
 * Used on pull (local meta vs remote) and inverted for stale push rejection.
 */
export function shouldApplyRemote(
  localUpdatedAt: string | null | undefined,
  remoteUpdatedAt: string
): boolean {
  if (!localUpdatedAt) return true;
  const l = Date.parse(localUpdatedAt);
  const r = Date.parse(remoteUpdatedAt);
  if (Number.isNaN(r)) return false;
  if (Number.isNaN(l)) return true;
  return r >= l;
}

/** True when local pantry has no items in any storage (fresh device). */
export function isLocalPantryEmpty(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (!raw) return true;
    const items = JSON.parse(raw) as {
      fridge?: unknown[];
      freezer?: unknown[];
      pantry?: unknown[];
    };
    const n =
      (items.fridge?.length || 0) +
      (items.freezer?.length || 0) +
      (items.pantry?.length || 0);
    return n === 0;
  } catch {
    return true;
  }
}

/** @deprecated Prefer STORAGE_KEYS.SYNC_META */
export const LOCAL_SYNC_META_KEY = STORAGE_KEYS.SYNC_META;

export type LocalSyncMeta = {
  lastPulledAt?: string;
  lastPushedAt?: string;
  lastRemoteUpdatedAt?: string;
  lastError?: string;
  mode?: "local" | "cloud";
};

export function readLocalSyncMeta(): LocalSyncMeta {
  try {
    const raw = localStorage.getItem(LOCAL_SYNC_META_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LocalSyncMeta;
  } catch {
    return {};
  }
}

export function writeLocalSyncMeta(patch: Partial<LocalSyncMeta>): void {
  const next = { ...readLocalSyncMeta(), ...patch };
  safeSetItem(LOCAL_SYNC_META_KEY, JSON.stringify(next));
}
