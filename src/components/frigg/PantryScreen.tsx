"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { GlassHeader } from "./GlassHeader";
import { StorageTabs } from "./StorageTabs";
import { ItemCard } from "./ItemCard";
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
import { Plus, ScanLine } from "lucide-react";
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
import { AlertsDrawer } from "./AlertsDrawer";
import { SettingsDrawer } from "./SettingsDrawer";
import { FamilyDrawer } from "./FamilyDrawer";
import { ManageFamilyPage } from "./ManageFamilyPage";
import { GlobalAdminPanel } from "./GlobalAdminPanel";
import { isGlobalAppAdmin } from "@/lib/global-admin";
import { personalGreeting } from "@/lib/greeting";
import { scheduleHouseholdPush } from "@/lib/run-household-sync";
import { loadFamilyMembers } from "@/lib/family";

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

  const requestConfirm = useCallback((req: ConfirmRequest) => {
    setConfirmRequest(req);
  }, []);

  // --- Auth / session ---
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

  // --- Family / household ---
  const family = useFamily({
    onInviteOpened: (code) => {
      setIsAuthenticated(false);
      setForcedInviteCode(code);
    },
  });

  // --- Profile / theme / notifications ---
  const prefs = usePreferences({
    setFamilyMembers: family.setFamilyMembers,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    family.reloadHousehold();
    prefs.reloadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync on auth only
  }, [isAuthenticated]);

  // After Manage Family pulls cloud snapshot, re-read members (pending → joined)
  useEffect(() => {
    const onPulled = () => {
      family.reloadHousehold();
      prefs.reloadProfile();
    };
    window.addEventListener("frigg-household-pulled", onPulled);
    return () => window.removeEventListener("frigg-household-pulled", onPulled);
  }, [family, prefs]);

  // --- Pantry domain ---
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

  // --- Shopping list ---
  const shopping = useShoppingList({
    items,
    setItems,
    rememberPantryItem,
    addActivity: family.addActivity,
    setAddedBanner,
    onGenerated: () => setActiveView("list"),
  });

  // --- Recipes ---
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

  // --- PWA install ---
  const pwa = usePwaInstall();

  // Multi-device: debounce cloud push when household data changes
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

  const handleDeleteItem = useCallback(
    (id: string) => {
      let found: { item: (typeof current)[0]; storage: StorageKey } | null = null;
      for (const storage of ["fridge", "freezer", "pantry"] as StorageKey[]) {
        const item = items[storage].find((i) => i.id === id);
        if (item) {
          found = { item, storage };
          break;
        }
      }
      if (!found) return;

      requestConfirm({
        title: `Delete ${found.item.name}?`,
        description: `Remove ${found.item.emoji} ${found.item.name} from your ${found.storage}. It will stay in the Shopping List Database for future use.`,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: () => {
          const snapshot = removeItem(id);
          if (!snapshot) return;
          rememberPantryItem(snapshot.item, "pantry_delete");
          toast(`${snapshot.item.emoji} ${snapshot.item.name} removed`, {
            action: {
              label: "Undo",
              onClick: () => restoreItem(snapshot.item, snapshot.storage),
            },
            duration: 4500,
          });
        },
      });
    },
    [items, current, removeItem, restoreItem, rememberPantryItem, requestConfirm]
  );

  const handleDeleteReceipt = useCallback(
    (id: string) => {
      const r = receipts.find((x) => x.id === id);
      if (!r) return;
      requestConfirm({
        title: "Delete receipt?",
        description: `Remove the ${r.store} receipt (€${r.total.toFixed(2)}) and its photo from Finances.`,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: () => removeReceipt(id),
      });
    },
    [receipts, removeReceipt, requestConfirm]
  );

  const handleAddToPantry = useCallback(
    (input: {
      name: string;
      unit: string;
      emoji: string;
      qty: number;
      minStock: number;
      barcode?: string;
    }) => {
      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name,
        qty: input.qty,
        unit: input.unit,
        emoji: input.emoji,
        daysLeft: getDefaultDaysLeft(input.name, active),
        minStock: input.minStock || getDefaultMinStock(input.name),
        ...(input.barcode ? { barcode: input.barcode } : {}),
      };
      setItems((prev) => applyIncomingToStorage(prev, active, newItem));
      rememberPantryItem(newItem, "pantry_add");
      family.addActivity("You", `added ${input.qty} ${input.unit} ${input.name}`);
      toast.success("Added to pantry", { description: newItem.name });
    },
    [active, setItems, rememberPantryItem, family]
  );

  const handleScannedItems = useCallback(
    (
      scanned: Parameters<typeof addScannedItems>[0],
      options?: Parameters<typeof addScannedItems>[1]
    ) => {
      const ids = addScannedItems(scanned, options);
      scanned.forEach((s) => {
        rememberPantryItem(
          {
            name: s.name,
            unit: s.unit,
            emoji: s.emoji,
            minStock: getDefaultMinStock(s.name),
          },
          "scan"
        );
      });
      return ids;
    },
    [addScannedItems, rememberPantryItem]
  );

  /**
   * H-06: Demo simulation only when VITE_AUTH_MODE=demo (or explicit VITE_FAMILY_SIMULATE=1).
   * Real multi-user updates come from household sync + invites — not invented items.
   */
  const simulateFamilyUpdate = useCallback(
    (memberName: string) => {
      const allowSim =
        String(import.meta.env?.VITE_FAMILY_SIMULATE || "").toLowerCase() === "1" ||
        String(import.meta.env?.VITE_AUTH_MODE || "").toLowerCase() === "demo";
      if (!allowSim) {
        toast.message("Invite a real member", {
          description: `Use Manage Family to invite someone — ${memberName} won’t invent pantry items here.`,
        });
        openManageFamily();
        return;
      }
      const demoItems = [
        { name: "Whole milk", qty: 1, unit: "L", emoji: "🥛" },
        { name: "Free-range eggs", qty: 4, unit: "pcs", emoji: "🥚" },
        { name: "Cherry tomatoes", qty: 1, unit: "pack", emoji: "🍅" },
      ];
      const demo = demoItems[Math.floor(Math.random() * demoItems.length)];
      const targetStorage: StorageKey = Math.random() > 0.6 ? "fridge" : "pantry";

      setItems((prev) =>
        applyIncomingToStorage(prev, targetStorage, {
          id: `fam-${Date.now()}`,
          name: demo.name,
          qty: demo.qty,
          unit: demo.unit,
          emoji: demo.emoji,
          daysLeft: getDefaultDaysLeft(demo.name, targetStorage),
          minStock: getDefaultMinStock(demo.name),
        })
      );

      rememberPantryItem(
        {
          name: demo.name,
          unit: demo.unit,
          emoji: demo.emoji,
          minStock: getDefaultMinStock(demo.name),
        },
        "pantry_add"
      );
      family.addActivity(memberName, `added ${demo.qty}${demo.unit} ${demo.name} (demo)`);
      toast.success(`Demo: ${memberName} updated the pantry`, {
        description: `+${demo.qty} ${demo.unit} ${demo.name} · not a real multi-device sync`,
      });
      setActiveView("pantry");
      setActive(targetStorage);
    },
    [setItems, rememberPantryItem, family, setActive, openManageFamily]
  );

  const isListView = activeView === "list";
  const isRecipesView = activeView === "recipes";
  const isFinancesView = activeView === "finances";

  const alertItems = buildAlertItems(items);
  const alertsCount = prefs.notificationsEnabled ? alertItems.length : 0;

  const headerTotal = isListView
    ? shopping.listCount
    : isRecipesView
      ? recipes.recipeIdeasCount
      : isFinancesView
        ? receipts.length
        : current.length;
  const headerAttention = isListView
    ? shopping.checkedCount
    : isRecipesView
      ? recipes.recipeReadyCount
      : isFinancesView
        ? new Set(receipts.map((r) => r.store)).size
        : expiringSoon;

  const financesMonthLabel = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
        <div className="text-center select-none">
          <div className="text-[78px] mb-3">🥛</div>
          <div className="font-display text-[44px] tracking-[-0.035em] text-foreground">Friġġ</div>
          <p className="mt-1.5 text-[15px] text-muted-foreground tracking-[-0.01em]">
            Your calm family pantry
          </p>
          <div className="mt-10 flex items-center justify-center gap-2 opacity-50">
            <div className="h-px w-6 bg-foreground/50" />
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-1 rounded-full bg-foreground animate-pulse"
                  style={{ animationDelay: `${i * 140}ms` }}
                />
              ))}
            </div>
            <div className="h-px w-6 bg-foreground/50" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        onLogin={doLogin}
        forcedInviteCode={forcedInviteCode}
        onClearForcedInvite={clearForcedInvite}
      />
    );
  }

  const sharedItemCount =
    items.fridge.length + items.freezer.length + items.pantry.length;

  return (
    <div className="relative min-h-dvh pb-32 bg-background touch-manipulation">
      {family.showManageFamily && (
        <ManageFamilyPage
          householdName={family.householdName}
          members={family.familyMembers}
          activityLog={family.activityLog}
          sharedItemCount={sharedItemCount}
          onBack={() => family.setShowManageFamily(false)}
          onAddMember={family.addFamilyMember}
          onRemoveMember={family.removeFamilyMember}
          onUpdateMember={family.updateFamilyMember}
          onRenameHousehold={family.renameHousehold}
          onSimulateAcceptInvite={family.simulateAcceptInvite}
          onClearActivity={family.clearActivity}
        />
      )}

      {showGlobalAdmin && isGlobalAdmin && (
        <GlobalAdminPanel
          onBack={() => setShowGlobalAdmin(false)}
          onRegistryChanged={() => {
            family.setFamilyMembers(loadFamilyMembers());
          }}
          onForceSignedOut={() => {
            setShowGlobalAdmin(false);
            doLogout();
          }}
        />
      )}

      <GlassHeader
        household={family.householdName}
        expiringSoon={headerAttention}
        totalItems={headerTotal}
        title={
          isListView
            ? "Shopping List"
            : isRecipesView
              ? "Recipes"
              : isFinancesView
                ? "Finances"
                : "Your Friġġ"
        }
        subtitle={
          isListView
            ? "Restock smart"
            : isRecipesView
              ? "Cook with what you have"
              : isFinancesView
                ? financesMonthLabel
                : personalGreeting(prefs.userFullName)
        }
        totalLabel={isFinancesView ? "receipts" : isRecipesView ? "ideas" : undefined}
        attentionLabel={
          isListView ? "checked" : isFinancesView ? "stores" : isRecipesView ? "ready" : undefined
        }
        attentionTone={isListView || isRecipesView || isFinancesView ? "calm" : undefined}
        familyMembers={family.familyMembers}
        isShared={true}
        onShowFamily={() => family.setShowFamilyDrawer(true)}
        onOpenSettings={() => setShowSettings(true)}
        onShowAlerts={() => {
          setShowAlerts(true);
          if (prefs.notificationsEnabled && alertItems.length > 0) {
            const platform = getPlatform();
            void platform.push.notify(
              "Friġġ alerts",
              `${alertItems.length} item${alertItems.length === 1 ? "" : "s"} need attention`
            );
          }
        }}
        alertsCount={alertsCount}
      />

      <main className="mobile-main px-5 pt-5 pb-2">
        {isListView ? (
          <ShoppingListView
            shoppingList={shopping.shoppingList}
            listCount={shopping.listCount}
            checkedCount={shopping.checkedCount}
            suggestedCount={shopping.suggestedCount}
            catalog={catalog}
            mergeGroups={mergeGroups}
            onExport={shopping.exportShoppingList}
            onRegenerate={() => {
              if (shopping.shoppingList.length > 0) {
                requestConfirm({
                  title: "Regenerate shopping list?",
                  description:
                    "This replaces your current list with suggestions from pantry needs.",
                  confirmLabel: "Regenerate",
                  destructive: true,
                  onConfirm: shopping.generateShoppingList,
                });
              } else {
                shopping.generateShoppingList();
              }
            }}
            onUpdateQty={shopping.updateShoppingQty}
            onToggle={shopping.toggleShoppingItem}
            onMarkPurchased={() => {
              if (shopping.checkedCount === 0) return;
              requestConfirm({
                title: "Mark as purchased?",
                description: `Move ${shopping.checkedCount} checked item${shopping.checkedCount === 1 ? "" : "s"} into your pantry and clear them from the list.`,
                confirmLabel: "Mark purchased",
                onConfirm: shopping.markPurchased,
              });
            }}
            onClear={() => {
              const n = shopping.shoppingList.filter((i) => i.checked).length;
              if (n === 0) {
                requestConfirm({
                  title: "Clear shopping list?",
                  description:
                    "Remove all items from the current shopping list. Your Database is not affected.",
                  confirmLabel: "Clear list",
                  destructive: true,
                  onConfirm: () => shopping.setShoppingList([]),
                });
                return;
              }
              requestConfirm({
                title: "Clear checked items?",
                description: `Remove ${n} checked item${n === 1 ? "" : "s"} from the shopping list.`,
                confirmLabel: "Clear",
                destructive: true,
                onConfirm: () => shopping.removeFromShoppingList(),
              });
            }}
            onAddFromCatalog={shopping.addFromCatalog}
            onAddManualToList={(name, unit, emoji, qty) => {
              shopping.addManualToList(name, unit, emoji, qty);
              addCatalogItem({ name, unit, emoji });
            }}
            onCatalogAdd={(input) => {
              addCatalogItem(input);
              toast.success("Added to Database", { description: input.name });
            }}
            onCatalogUpdate={updateCatalogItem}
            onCatalogMerge={(group, primaryId) => {
              applyMerge(group, primaryId);
              toast.success("Merged", { description: "Duplicates combined in Database." });
            }}
            onCatalogRequestDelete={(item) => {
              requestConfirm({
                title: `Delete ${item.name}?`,
                description:
                  "Remove this item from the Database. Pantry stock is not deleted.",
                confirmLabel: "Delete",
                destructive: true,
                onConfirm: () => removeCatalogItem(item.id),
              });
            }}
            pantrySuggestions={(["fridge", "freezer", "pantry"] as StorageKey[]).flatMap((s) =>
              items[s].map((i) => ({ name: i.name, unit: i.unit, emoji: i.emoji }))
            )}
          />
        ) : isRecipesView ? (
          <RecipesView
            items={items}
            recipeFilter={recipes.recipeFilter}
            onFilterChange={recipes.setRecipeFilter}
            filteredRecipes={recipes.filteredRecipes}
            countAvailable={recipes.getMatchingCount}
            canMakeFully={recipes.canMakeRecipe}
            onCook={recipes.cookRecipe}
          />
        ) : isFinancesView ? (
          <Suspense
            fallback={
              <div className="py-16 text-center text-sm text-muted-foreground">
                Loading finances…
              </div>
            }
          >
            <FinancialsScreen
              receipts={receipts}
              onDeleteReceipt={handleDeleteReceipt}
              onAddReceipt={addReceipt}
            />
          </Suspense>
        ) : (
          <>
            <div
              className="mb-3.5"
              style={{ width: "100%", maxWidth: "100%", display: "block" }}
            >
              <StorageTabs active={active} onChange={setActive} />
            </div>
            {current.length > 0 && (
              <button
                type="button"
                onClick={() => setAddSheetOpen(true)}
                className="group relative mb-1 flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-3xl border border-border/45 bg-card py-3.5 text-[15px] font-semibold tracking-[-0.015em] text-foreground shadow-[0_1px_0_0_oklch(1_0_0/0.75)_inset,0_10px_28px_-14px_oklch(0.2_0.02_150/0.14)] active:scale-[0.985] transition duration-200 dark:shadow-[0_1px_0_0_oklch(1_0_0/0.06)_inset,0_10px_28px_-14px_oklch(0_0_0/0.4)]"
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      "linear-gradient(180deg, color-mix(in oklab, var(--color-brand) 5%, transparent), transparent 55%)",
                  }}
                  aria-hidden
                />
                <span className="relative grid size-7 place-items-center rounded-full bg-brand text-brand-foreground shadow-[0_4px_12px_-4px_color-mix(in_oklab,var(--color-brand)_50%,transparent)] transition group-active:scale-95">
                  <Plus className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="relative">Add item</span>
              </button>
            )}
            {addedBanner && (
              <div
                onClick={dismissBanner}
                className="mt-4 flex items-center gap-3 rounded-3xl border border-[color-mix(in_oklab,var(--color-fresh)_25%,transparent)] bg-[color-mix(in_oklab,var(--color-fresh)_8%,var(--color-card))] px-4 py-3 text-sm cursor-pointer active:opacity-90 transition"
              >
                <div className="text-xl">✨</div>
                <div className="flex-1">
                  <span className="font-semibold text-foreground/90">{addedBanner.message}</span>
                  <span className="ml-1.5 text-muted-foreground">Nice work.</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissBanner();
                  }}
                  className="text-muted-foreground/70 active:text-foreground"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}

            {pwa.showInstallBanner && pwa.installPromptEvent && (
              <div className="mt-3 flex items-center gap-3 rounded-3xl border border-border/60 bg-card px-4 py-2.5 text-sm">
                <div className="text-xl">📱</div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">Add Friġġ to Home Screen</span>
                  <span className="ml-1 text-muted-foreground text-xs">
                    for the full app experience.
                  </span>
                </div>
                <button
                  onClick={pwa.handleInstall}
                  className="rounded-2xl bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground active:scale-[0.985] transition"
                >
                  Add
                </button>
                <button
                  onClick={pwa.dismissInstall}
                  className="text-muted-foreground/70 px-1 active:text-foreground"
                  aria-label="Dismiss install prompt"
                >
                  ×
                </button>
              </div>
            )}

            {current.length === 0 ? (
              <EmptyState
                label={active}
                onAdd={() => setAddSheetOpen(true)}
                onScan={() => setScanOpen(true)}
              />
            ) : (
              <div className="mt-5 flex flex-col gap-4" style={{ width: "100%" }}>
                {[...current]
                  .sort((a, b) =>
                    a.name.localeCompare(b.name, undefined, {
                      sensitivity: "base",
                      numeric: true,
                    })
                  )
                  .map((item) => (
                    <div key={item.id} className="w-full" style={{ width: "100%" }}>
                      <ItemCard
                        item={item}
                        storage={active}
                        onOpenDetails={() => openItemDetails(item, active)}
                        onDelete={() => handleDeleteItem(item.id)}
                      />
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </main>

      {!isListView &&
        !isRecipesView &&
        !isFinancesView &&
        current.length > 0 && <ScanFab onClick={() => setScanOpen(true)} />}

      <BottomNav
        active={
          isListView
            ? "list"
            : isRecipesView
              ? "recipes"
              : isFinancesView
                ? "money"
                : "pantry"
        }
        badges={shopping.suggestedCount > 0 ? { list: shopping.suggestedCount } : {}}
        onChange={(key) => {
          if (key === "pantry" || key === "list") {
            setActiveView(key as "pantry" | "list");
            if (key === "pantry") setActive("fridge");
          } else if (key === "recipes") {
            setActiveView("recipes");
          } else if (key === "money") {
            setActiveView("finances");
          } else {
            setAddedBanner({ count: 0, message: "Coming soon" });
            setTimeout(() => setAddedBanner(null), 1500);
          }
        }}
      />

      <ConfirmDialog request={confirmRequest} onDismiss={() => setConfirmRequest(null)} />

      <PantryAddSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        storage={active}
        suggest={suggest}
        onAdd={handleAddToPantry}
      />

      <ReceiptScanFlow
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onItemsAdded={handleScannedItems}
        onExpirySignals={(signals) => applyExpirySignals(signals)}
        onReceiptSaved={(receipt) => {
          addReceipt(receipt);
          family.addActivity("You", `saved receipt from ${receipt.store}`);
        }}
        pantryItems={[
          ...items.fridge.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            qty: i.qty,
            emoji: i.emoji,
            storage: "fridge" as const,
          })),
          ...items.freezer.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            qty: i.qty,
            emoji: i.emoji,
            storage: "freezer" as const,
          })),
          ...items.pantry.map((i) => ({
            id: i.id,
            name: i.name,
            unit: i.unit,
            qty: i.qty,
            emoji: i.emoji,
            storage: "pantry" as const,
          })),
        ]}
        onNavigateToPantry={() => setActiveView("pantry")}
      />

      <SettingsDrawer
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) prefs.setEditingProfile(false);
        }}
        userFullName={prefs.userFullName}
        userEmail={prefs.userEmail}
        userEmoji={prefs.userEmoji}
        householdName={family.householdName}
        memberCount={family.familyMembers.length}
        isDark={prefs.isDark}
        notificationsEnabled={prefs.notificationsEnabled}
        editingProfile={prefs.editingProfile}
        profileDraft={prefs.profileDraft}
        hasInstallPrompt={!!pwa.installPromptEvent}
        onStartEditProfile={() => {
          prefs.setProfileDraft({
            name: prefs.userFullName,
            email: prefs.userEmail,
            emoji: prefs.userEmoji,
          });
          prefs.setEditingProfile(true);
        }}
        onCancelEditProfile={() => prefs.setEditingProfile(false)}
        onProfileDraftChange={prefs.setProfileDraft}
        onSaveProfile={prefs.saveProfile}
        onToggleNotifications={prefs.toggleNotifications}
        onToggleDarkMode={prefs.toggleDarkMode}
        onManageFamily={() => {
          setShowSettings(false);
          openManageFamily();
        }}
        isGlobalAdmin={isGlobalAdmin}
        onOpenGlobalAdmin={() => {
          setShowSettings(false);
          openGlobalAdmin();
        }}
        onInstall={() => {
          void pwa.handleInstall();
          setShowSettings(false);
        }}
        onShowInstallHint={() => {
          setShowSettings(false);
          // Banner only shows when prompt exists; otherwise tip via toast
          if (pwa.installPromptEvent) {
            // force show by clearing dismiss is heavy — toast is enough
          }
          toast("Look for the prompt", {
            description: "Or use your browser menu → Add to Home Screen",
          });
        }}
        onLogout={() => {
          setShowSettings(false);
          doLogout();
          toast("Signed out", { description: "See you soon." });
        }}
      />

      <AlertsDrawer
        open={showAlerts}
        onOpenChange={setShowAlerts}
        notificationsEnabled={prefs.notificationsEnabled}
        alertItems={alertItems}
      />

      <FamilyDrawer
        open={family.showFamilyDrawer}
        onOpenChange={family.setShowFamilyDrawer}
        householdName={family.householdName}
        members={family.familyMembers}
        activityLog={family.activityLog}
        onSimulateMember={simulateFamilyUpdate}
        onManageFamily={openManageFamily}
        isGlobalAdmin={isGlobalAdmin}
        onOpenGlobalAdmin={openGlobalAdmin}
        onClearActivity={family.clearActivity}
      />

      <ItemDetailsDrawer
        detailsItem={detailsItem}
        onClose={closeItemDetails}
        onPatch={patchItem}
        onMove={moveItem}
        onRequestDelete={handleDeleteItem}
      />
    </div>
  );
}
