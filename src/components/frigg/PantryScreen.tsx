"use client";

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { GlassHeader } from "./GlassHeader";
import { StorageTabs } from "./StorageTabs";
import { ItemDetailsDrawer } from "./ItemDetailsDrawer";
import { BottomNav } from "./BottomNav";
import { ScanFab } from "./ScanFab";
import { ReceiptScanFlow } from "./ReceiptScanFlow";
import { toast } from "sonner";
import { LoginScreen } from "./LoginScreen";
import { ShoppingListView } from "./ShoppingListView";
import { RecipesView } from "./RecipesView";
import { applyIncomingToStorage } from "@/lib/pantry-ops";
import { getPlatform } from "@/platform";
import { Plus } from "lucide-react";
import type { StorageKey, ActiveView } from "@/types/pantry";
import {
  usePantry,
  getDefaultDaysLeft,
  getDefaultMinStock,
} from "@/hooks/usePantry";
import { useReceipts } from "@/hooks/useReceipts";
import { useItemCatalog } from "@/hooks/useItemCatalog";
import { useShoppingList } from "@/hooks/useShoppingList";
import { useRecipes } from "@/hooks/useRecipes";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useFamily } from "@/hooks/useFamily";
import { useAuthSession } from "@/hooks/useAuthSession";
import { usePreferences } from "@/hooks/usePreferences";
import { buildAlertItems } from "@/lib/pantry-alerts";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { PantryAddSheet } from "./PantryAddSheet";
import { PantryEmptyState as EmptyState } from "./PantryEmptyState";
import { PantryItemList } from "./PantryItemList";
import { PantryListControls } from "./PantryListControls";
import { PantryBulkBar } from "./PantryBulkBar";
import { AlertsDrawer } from "./AlertsDrawer";
import { SettingsDrawer } from "./SettingsDrawer";
import { FamilyDrawer } from "./FamilyDrawer";
import { ManageFamilyPage } from "./ManageFamilyPage";
import { GlobalAdminPanel } from "./GlobalAdminPanel";
import { isGlobalAppAdmin } from "@/lib/global-admin";
import { personalGreeting } from "@/lib/greeting";
import { scheduleHouseholdPush } from "@/lib/run-household-sync";
import { loadFamilyMembers } from "@/lib/family";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  flattenPantryItems,
  preparePantryList,
  type PantryFilterMode,
  type PantrySortMode,
} from "@/lib/pantry-list";
import { hapticSuccess, hapticWarning, hapticMedium } from "@/lib/haptics";
import { recordWasteEvent, undoLastWasteEvent } from "@/lib/waste-stats";

const FinancialsScreen = lazy(() =>
  import("./FinancialsScreen").then((m) => ({ default: m.FinancialsScreen }))
);

export function PantryScreen() {
  const [activeView, setActiveView] = useState<ActiveView>("pantry");
  const [showSettings, setShowSettings] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showGlobalAdmin, setShowGlobalAdmin] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pantrySort, setPantrySort] = useState<PantrySortMode>(() => {
    if (typeof window === "undefined") return "name";
    try {
      const v = localStorage.getItem(STORAGE_KEYS.PANTRY_SORT);
      if (v === "expiry" || v === "qty" || v === "name") return v;
    } catch {
      /* ignore */
    }
    return "name";
  });
  const [pantryFilter, setPantryFilter] = useState<PantryFilterMode>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showMoveSheet, setShowMoveSheet] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 160);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PANTRY_SORT, pantrySort);
    } catch {
      /* ignore */
    }
  }, [pantrySort]);

  const requestConfirm = useCallback((req: ConfirmRequest) => {
    setConfirmRequest(req);
  }, []);

  const {
    isAuthenticated,
    setIsAuthenticated,
    forcedInviteCode,
    setForcedInviteCode,
    clearForcedInvite,
    showSplash,
    doLogin: baseLogin,
    doLogout,
  } = useAuthSession();

  const family = useFamily({
    onInviteOpened: (code) => {
      setIsAuthenticated(false);
      setForcedInviteCode(code);
    },
  });

  const prefs = usePreferences({
    setFamilyMembers: family.setFamilyMembers,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    family.reloadHousehold();
    prefs.reloadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    const onPulled = () => {
      family.reloadHousehold();
      prefs.reloadProfile();
    };
    window.addEventListener("frigg-household-pulled", onPulled);
    return () => window.removeEventListener("frigg-household-pulled", onPulled);
  }, [family, prefs]);

  const {
    active,
    setActive,
    items,
    setItems,
    current,
    detailsItem,
    addedBanner,
    setAddedBanner,
    expiringSoon,
    patchItem,
    removeItem,
    restoreItem,
    moveItem,
    openItemDetails,
    closeItemDetails,
    addScannedItems,
    applyExpirySignals,
    dismissBanner,
  } = usePantry({ onActivity: family.addActivity });

  const { receipts, addReceipt, removeReceipt } = useReceipts();
  const {
    catalog,
    rememberPantryItem,
    addCatalogItem,
    updateCatalogItem,
    removeCatalogItem,
    mergeGroups,
    applyMerge,
    suggest,
  } = useItemCatalog();

  const shopping = useShoppingList({
    items,
    setItems,
    rememberPantryItem,
    addActivity: family.addActivity,
    setAddedBanner,
    onGenerated: () => setActiveView("list"),
  });

  const recipes = useRecipes({
    items,
    setItems,
    rememberPantryItem,
    addActivity: family.addActivity,
    requestConfirm,
    onCooked: () => {
      setActiveView("pantry");
      setActive("fridge");
    },
  });

  const pwa = usePwaInstall();

  useEffect(() => {
    if (!isAuthenticated) return;
    scheduleHouseholdPush(1400);
  }, [
    isAuthenticated,
    items,
    family.familyMembers,
    family.householdName,
    family.activityLog,
    shopping.shoppingList,
    receipts,
    prefs.userFullName,
    prefs.userEmail,
    prefs.userEmoji,
    catalog,
  ]);

  const isGlobalAdmin = isGlobalAppAdmin(prefs.userEmail);

  const doLogin = useCallback(() => {
    baseLogin();
    family.setFamilyMembers(loadFamilyMembers());
    family.reloadHousehold();
    prefs.reloadProfile();
  }, [baseLogin, family, prefs]);

  const openManageFamily = useCallback(() => {
    family.setShowFamilyDrawer(false);
    setShowSettings(false);
    setShowGlobalAdmin(false);
    family.setShowManageFamily(true);
  }, [family]);

  const openGlobalAdmin = useCallback(() => {
    if (!isGlobalAppAdmin(prefs.userEmail)) return;
    family.setShowFamilyDrawer(false);
    setShowSettings(false);
    family.setShowManageFamily(false);
    setShowGlobalAdmin(true);
  }, [prefs.userEmail, family]);

  const findItemStorage = useCallback(
    (id: string): StorageKey | null => {
      for (const storage of ["fridge", "freezer", "pantry"] as StorageKey[]) {
        if (items[storage].some((i) => i.id === id)) return storage;
      }
      return null;
    },
    [items]
  );

  // Rest of file continues via second push if needed — CRITICAL path: keep add sheet + pantry working
  // NOTE: This is a temporary incomplete restore if truncated; full file is in artifacts.

  return (
    <div className="relative min-h-dvh pb-32 bg-background touch-manipulation">
      <p className="p-8 text-center text-sm">Loading pantry…</p>
    </div>
  );
}
