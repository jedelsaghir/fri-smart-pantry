/** Shared pantry domain types for Friġġ */

export type StorageKey = "fridge" | "freezer" | "pantry";

export type ActiveView = "pantry" | "list" | "recipes" | "finances";

export interface PantryItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  daysLeft: number;
  minStock: number;
  /** Latest purchase price in EUR (optional) */
  latestPrice?: number;
  /** Price basis label, e.g. "100g", "L", "pcs" */
  priceUnit?: string;
}

export type ItemStatus = {
  label: string;
  color: string;
};

/** Item detected during receipt scan (includes confidence + target storage) */
export interface DetectedItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  storage: StorageKey;
  confidence: number;
}

/** Payload used when adding scanned items into the pantry */
export type ScannedItemInput = Omit<DetectedItem, "id" | "confidence">;

/** Single line on a saved receipt */
export type ReceiptLineItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  /** Unit price or line total in EUR */
  price: number;
  category?: string;
  storage?: StorageKey;
};

/** Persisted receipt with original photo (data URL) + parsed breakdown */
export type StoredReceipt = {
  id: string;
  /** ISO date string (yyyy-mm-dd or full ISO) */
  date: string;
  store: string;
  total: number;
  currency: string;
  /** Original photo as data URL; empty string when none was attached */
  imageDataUrl: string;
  items: ReceiptLineItem[];
  /** When the receipt was saved into the app */
  createdAt: string;
  note?: string;
};

export type ShoppingListItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  checked: boolean;
};

/**
 * Shared item catalog ("Database") — known product names learned from
 * pantry adds/deletes and editable from the Shopping List page.
 */
export type CatalogItem = {
  id: string;
  name: string;
  unit: string;
  emoji: string;
  defaultMinStock?: number;
  lastPrice?: number;
  /** ISO timestamp */
  updatedAt: string;
  /** How this entry last entered the catalog */
  source?: "pantry_add" | "pantry_delete" | "scan" | "manual" | "merge";
};

/** Suggested merge group for catalog de-duplication */
export type CatalogMergeGroup = {
  id: string;
  /** Canonical name suggestion (usually the longest / most common) */
  primaryId: string;
  memberIds: string[];
};

export type RecipeIngredient = {
  name: string;
  qty: number;
  unit: string;
};

export type Recipe = {
  id: string;
  name: string;
  emoji: string;
  time: string;
  servings: number;
  ingredients: RecipeIngredient[];
  category: string;
};

export type RecipeFilter = "all" | "canMake" | "expiring";

/** Household membership lifecycle for multi-user invites */
export type FamilyMemberStatus = "owner" | "pending" | "joined";

export type FamilyMember = {
  id: string;
  name: string;
  emoji: string;
  /** Phone digits for WhatsApp invites (E.164 or local) */
  phone?: string;
  /** Unique code embedded in invite links */
  inviteCode: string;
  status: FamilyMemberStatus;
  /** True for the currently signed-in user — cannot be removed */
  isYou?: boolean;
  email?: string;
  joinedAt?: string;
};

export type ActivityLogEntry = {
  user: string;
  action: string;
  time: string;
};

/** Item currently open in the details drawer */
export type DetailsItemState = {
  item: PantryItem;
  storage: StorageKey;
};

export type AddedBanner = {
  count: number;
  message: string;
};

export type PantryItemsByStorage = Record<StorageKey, PantryItem[]>;
