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

export function applyBackupToLocalStorage(backup: FriggBackup): void {
  if (backup.version !== 1) throw new Error("Unsupported backup version");
  const write = (key: string, value: unknown) => {
    if (value === undefined) return;
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  };
  write(STORAGE_KEYS.ITEMS, backup.items);
  write(STORAGE_KEYS.CATALOG, backup.catalog);
  write(STORAGE_KEYS.RECEIPTS, backup.receipts);
  write(STORAGE_KEYS.SHOPPING_LIST, backup.shoppingList);
  write(STORAGE_KEYS.ACTIVITY_LOG, backup.activityLog);
  write(STORAGE_KEYS.FAMILY_MEMBERS, backup.familyMembers);
  if (backup.household) localStorage.setItem(STORAGE_KEYS.HOUSEHOLD, backup.household);
  write(STORAGE_KEYS.PROFILE, backup.profile);
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
