/**
 * Single source of truth for localStorage / session keys (M-01, N-01).
 * Prefix `friggg-*` is intentional (legacy product slug) — not a typo of Friġġ.
 */

export const STORAGE_KEYS = {
  ITEMS: "friggg-items",
  FAMILY_MEMBERS: "friggg-family-members",
  HOUSEHOLD: "friggg-household",
  PROFILE: "friggg-profile",
  LOGGED_IN: "friggg-logged-in",
  CURRENT_USER: "friggg-current-user-id",
  ACCOUNTS: "friggg-accounts",
  PENDING_INVITE: "friggg-pending-invite",
  RECEIPTS: "friggg-receipts",
  CATALOG: "friggg-item-catalog",
  SHOPPING_LIST: "friggg-shopping-list",
  ACTIVITY_LOG: "friggg-activity-log",
  THEME: "friggg-theme",
  NOTIFICATIONS: "friggg-notifications",
  INSTALL_DISMISSED: "friggg-install-dismissed",
  /** Structured auth session (JSON AuthSession) */
  AUTH_SESSION: "friggg-auth-session",
  /** Local admin force-logout id list */
  FORCED_LOGOUT_IDS: "friggg-forced-logout-ids",
  /** Camera denied sticky (sessionStorage) */
  CAMERA_DENIED: "friggg-camera-denied",
  /** Sync meta (last pull/push clocks) */
  SYNC_META: "friggg-sync-meta",
  /** Pantry list sort preference: name | expiry | qty */
  PANTRY_SORT: "friggg-pantry-sort",
  /** First-scan coach marks dismissed */
  SCAN_TIPS_SEEN: "friggg-scan-tips-seen",
  /** Used vs expired waste events */
  WASTE_STATS: "friggg-waste-stats",
} as const;

export type StorageKeyName = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
