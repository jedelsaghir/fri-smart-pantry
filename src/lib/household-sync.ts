/**
 * Multi-device household snapshot — pure serialize / apply helpers.
 * Cloud transport lives in platform + server functions.
 */

import type {
  ActivityLogEntry,
  CatalogItem,
  FamilyMember,
  PantryItemsByStorage,
  ShoppingListItem,
  StoredReceipt,
} from "@/types/pantry";
import { STORAGE_KEYS } from "@/lib/storage-keys";

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
  /** Plain password kept for demo multi-device auth (same as local demo store) */
  password: string;
  name: string;
  emoji: string;
};

/** Full household blob shared across devices for one account/household */
export type HouseholdSyncSnapshot = {
  version: typeof HOUSEHOLD_SYNC_VERSION;
  updatedAt: string;
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
  return {
    version: HOUSEHOLD_SYNC_VERSION,
    updatedAt: new Date().toISOString(),
    email: email.trim().toLowerCase(),
    items: readJson(STORAGE_KEYS.ITEMS),
    catalog: readJson(STORAGE_KEYS.CATALOG),
    receipts: readJson(STORAGE_KEYS.RECEIPTS),
    shoppingList: readJson(STORAGE_KEYS.SHOPPING_LIST),
    activityLog: readJson(STORAGE_KEYS.ACTIVITY_LOG),
    familyMembers: readJson(STORAGE_KEYS.FAMILY_MEMBERS),
    household: localStorage.getItem(STORAGE_KEYS.HOUSEHOLD) || undefined,
    profile: readJson(STORAGE_KEYS.PROFILE),
    accounts: readJson(STORAGE_KEYS.ACCOUNTS),
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
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  };

  write(STORAGE_KEYS.ITEMS, s.items);
  write(STORAGE_KEYS.CATALOG, s.catalog);
  write(STORAGE_KEYS.RECEIPTS, s.receipts);
  write(STORAGE_KEYS.SHOPPING_LIST, s.shoppingList);
  write(STORAGE_KEYS.ACTIVITY_LOG, s.activityLog);
  write(STORAGE_KEYS.FAMILY_MEMBERS, s.familyMembers);
  if (s.household) localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, s.household);
  write(STORAGE_KEYS.PROFILE, s.profile);
  write(STORAGE_KEYS.ACCOUNTS, s.accounts);
  if (s.theme) localStorage.setItem(STORAGE_KEYS.THEME, s.theme);
  if (s.notifications != null) localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, s.notifications);

  if (opts?.currentUserId) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, opts.currentUserId);
  }
  localStorage.setItem(STORAGE_KEYS.LOGGED_IN, "true");
}

/** Prefer newer updatedAt; if equal, prefer remote for multi-device login */
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

export const LOCAL_SYNC_META_KEY = "friggg-sync-meta";

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
  try {
    const next = { ...readLocalSyncMeta(), ...patch };
    localStorage.setItem(LOCAL_SYNC_META_KEY, JSON.stringify(next));
  } catch {}
}
