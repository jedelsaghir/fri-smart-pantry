import type {
  ActivityLogEntry,
  CatalogItem,
  PantryItemsByStorage,
  ShoppingListItem,
  StoredReceipt,
  FamilyMember,
} from "@/types/pantry";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export type FriggBackup = {
  version: 1;
  exportedAt: string;
  items?: PantryItemsByStorage;
  catalog?: CatalogItem[];
  receipts?: StoredReceipt[];
  shoppingList?: ShoppingListItem[];
  activityLog?: ActivityLogEntry[];
  familyMembers?: FamilyMember[];
  household?: string;
  profile?: { name?: string; email?: string; emoji?: string; memberId?: string };
};

export function buildBackupFromLocalStorage(): FriggBackup {
  const read = <T>(key: string): T | undefined => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  };

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: read(STORAGE_KEYS.ITEMS),
    catalog: read(STORAGE_KEYS.CATALOG),
    receipts: read(STORAGE_KEYS.RECEIPTS),
    shoppingList: read(STORAGE_KEYS.SHOPPING_LIST),
    activityLog: read(STORAGE_KEYS.ACTIVITY_LOG),
    familyMembers: read(STORAGE_KEYS.FAMILY_MEMBERS),
    household: localStorage.getItem(STORAGE_KEYS.HOUSEHOLD) || undefined,
    profile: read(STORAGE_KEYS.PROFILE),
  };
}

export function parseAndValidateBackup(raw: unknown): FriggBackup {
  if (!raw || typeof raw !== "object") throw new Error("Backup must be a JSON object");
  const b = raw as FriggBackup;
  if (b.version !== 1) throw new Error("Unsupported backup version (expected 1)");
  if (b.items && (!b.items.fridge || !b.items.freezer || !b.items.pantry)) {
    throw new Error("Invalid items: need fridge, freezer, pantry arrays");
  }
  if (b.catalog && !Array.isArray(b.catalog)) throw new Error("Invalid catalog");
  if (b.receipts && !Array.isArray(b.receipts)) throw new Error("Invalid receipts");
  if (b.shoppingList && !Array.isArray(b.shoppingList)) throw new Error("Invalid shopping list");
  if (b.activityLog && !Array.isArray(b.activityLog)) throw new Error("Invalid activity log");
  if (b.familyMembers && !Array.isArray(b.familyMembers)) throw new Error("Invalid family members");
  return b;
}

export function applyBackupToLocalStorage(backup: FriggBackup): void {
  const valid = parseAndValidateBackup(backup);
  const write = (key: string, value: unknown) => {
    if (value === undefined) return;
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  };
  write(STORAGE_KEYS.ITEMS, valid.items);
  write(STORAGE_KEYS.CATALOG, valid.catalog);
  write(STORAGE_KEYS.RECEIPTS, valid.receipts);
  write(STORAGE_KEYS.SHOPPING_LIST, valid.shoppingList);
  write(STORAGE_KEYS.ACTIVITY_LOG, valid.activityLog);
  write(STORAGE_KEYS.FAMILY_MEMBERS, valid.familyMembers);
  if (valid.household) localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, valid.household);
  write(STORAGE_KEYS.PROFILE, valid.profile);
}

export function downloadBackupJson(backup: FriggBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `frigg-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
