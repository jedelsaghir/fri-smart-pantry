/** Single source of truth for localStorage keys (P2-3) */

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
} as const;

export type StorageKeyName = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
