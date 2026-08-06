/** Shared pantry domain types for Friġġ */

export type StorageKey = "fridge" | "freezer" | "pantry";

export type ActiveView = "pantry" | "list" | "recipes" | "finances";

export interface PantryItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  /**
   * Days until expiry from today. null = no expiry tracked (default for manual add).
   * Negative = already expired.
   */
  daysLeft: number | null;
  minStock: number;
  /** Latest purchase price in EUR (optional) */
  latestPrice?: number;
  /** Price basis label, e.g. "100g", "L", "pcs" */
  priceUnit?: string;
  /**
   * Optional compressed product-label / expiry photo (data URL).
   * Attached via post-scan expiry assist — not auto-OCR’d for dates.
   * Keep under MAX_LABEL_PHOTO_CHARS (~100k) so sync/localStorage stay healthy (L-25).
   */
  labelPhotoDataUrl?: string;
  /** When the label photo was captured (ISO) */
  labelPhotoAt?: string;
  /** Optional barcode / GTIN if known (from barcode assist) */
  barcode?: string;
  /**
   * Optional brand from last known purchase / OCR (e.g. "Granarolo").
   * Not shown on pantry cards; used for price context in details / finances.
   * Does not affect sameProduct merge identity.
   */
  brand?: string;
}

export type ItemStatus = {
  label: string;
  color: string;
};

/** How a review line should apply against an existing pantry row */
export type ReviewDisposition = "merge" | "update" | "add_new";

/** Strength of pantry name/unit match for a scanned line */
export type PantryMatchKind = "exact" | "similar";

/** Best pantry row matched to a scanned / OCR line */
export type PantryMatchInfo = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  storage: StorageKey;
  /** 0–1 similarity score */
  score: number;
  kind: PantryMatchKind;
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
  /** Brand if OCR line contained a known brand (separate from simplified name) */
  brand?: string;
  /** Line total from OCR when known */
  price?: number;
  /** Existing pantry item this line likely refers to */
  pantryMatch?: PantryMatchInfo;
  /**
   * Review action when confirming:
   * - merge: add scanned qty onto matched row
   * - update: set matched row qty to scanned qty
   * - add_new: create a separate pantry row
   */
  disposition?: ReviewDisposition;
  /**
   * Uncertain non-food / non-pantry signal — shown in Review so the user can
   * Keep (add) or Discard. High-confidence non-pantry lines are excluded before review.
   */
  possiblyNonFood?: boolean;
  /** Short reason / category for non-food flag (e.g. "cleaning") */
  nonFoodReason?: string;
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
  /** Optional brand for price comparison in Finances */
  brand?: string;
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
  /** Last known brand from a scan (optional) */
  brand?: string;
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
  /** Optional phone (display only; invites are shareable links) */
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
