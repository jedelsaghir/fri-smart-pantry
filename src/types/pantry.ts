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

export type ShoppingListItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  emoji: string;
  checked: boolean;
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
