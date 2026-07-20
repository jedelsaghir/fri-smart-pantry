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
import { RecipesView, countRecipeAvailability, canMakeRecipeFully } from "./RecipesView";
import { ALL_RECIPES } from "@/data/recipes";
import { applyIncomingToStorage, deductIngredients, sameProduct } from "@/lib/pantry-ops";
import { upsertShoppingListItem } from "@/lib/shopping";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { getPlatform } from "@/platform";
import { Plus } from "lucide-react";
import type {
  StorageKey,
  ActiveView,
  ShoppingListItem,
  Recipe,
  RecipeFilter,
  ActivityLogEntry,
  FamilyMember,
  CatalogItem,
} from "@/types/pantry";
import {
  usePantry,
  getDefaultDaysLeft,
  getDefaultMinStock,
} from "@/hooks/usePantry";
import { useReceipts } from "@/hooks/useReceipts";
import { useItemCatalog } from "@/hooks/useItemCatalog";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { PantryAddSheet } from "./PantryAddSheet";
import { AlertsDrawer } from "./AlertsDrawer";
import { SettingsDrawer } from "./SettingsDrawer";
import { FamilyDrawer } from "./FamilyDrawer";
import { ManageFamilyPage } from "./ManageFamilyPage";

const FinancialsScreen = lazy(() =>
  import("./FinancialsScreen").then((m) => ({ default: m.FinancialsScreen }))
);

import {
  buildInviteUrl,
  createMemberId,
  defaultFamilyMembers,
  generateInviteCode,
  loadFamilyMembers,
  loadHouseholdName,
  loadStoredProfile,
  normalizeFamilyMember,
  saveFamilyMembers,
  saveHouseholdName,
} from "@/lib/family";
import { firstNameFromDisplayName, personalGreeting } from "@/lib/greeting";

export function PantryScreen() {
  const [activeView, setActiveView] = useState<ActiveView>("pantry");
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(STORAGE_KEYS.LOGGED_IN) === "true"; } catch { return false; }
  });
  const [forcedInviteCode, setForcedInviteCode] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // Premium calm splash / loading screen on initial mount (PWA friendly)
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 720);
    return () => clearTimeout(t);
  }, []);

  // Profile (persisted) — always the signed-in user, never a demo "Elena"
  const applyProfile = useCallback((profile: { name?: string; email?: string; emoji?: string }) => {
    const name = (profile.name || "").trim();
    const email = (profile.email || "").trim();
    const emoji = (profile.emoji || "").trim() || "👤";
    setUserFullName(name || "Your name");
    setUserName(firstNameFromDisplayName(name || null));
    setUserEmail(email);
    setUserEmoji(emoji);
    setProfileDraft({
      name: name || "Your name",
      email,
      emoji,
    });
  }, []);

  const [userName, setUserName] = useState("there");
  const [userFullName, setUserFullName] = useState("Your name");
  const [userEmail, setUserEmail] = useState("");
  const [userEmoji, setUserEmoji] = useState("👤");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    name: "Your name",
    email: "",
    emoji: "👤",
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const v = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (v === null) return true;
      return v === "true";
    } catch {
      return true;
    }
  });
  const [showAlerts, setShowAlerts] = useState(false);

  const [householdName, setHouseholdName] = useState(() =>
    typeof window === "undefined" ? "Family pantry" : loadHouseholdName("Family pantry")
  );
  useEffect(() => {
    applyProfile(loadStoredProfile());
    setHouseholdName(loadHouseholdName("Family pantry"));
  }, [applyProfile]);

  const saveProfile = () => {
    const name = profileDraft.name.trim() || "Your name";
    const email = profileDraft.email.trim();
    const emoji = profileDraft.emoji.trim() || "👤";
    try {
      const prev = loadStoredProfile();
      localStorage.setItem(
        STORAGE_KEYS.PROFILE,
        JSON.stringify({
          name,
          email,
          emoji,
          memberId: prev.memberId,
          accountId: prev.accountId,
        })
      );
      // Keep household "You" row in sync with the signed-in display name
      setFamilyMembers((members) =>
        members.map((m) =>
          m.isYou || m.status === "owner" ? { ...m, name, emoji, email } : m
        )
      );
    } catch {}
    applyProfile({ name, email, emoji });
    setEditingProfile(false);
    toast.success("Profile updated");
  };

  const toggleNotifications = async (checked: boolean) => {
    setNotificationsEnabled(checked);
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, String(checked));
    } catch {}
    if (checked) {
      const platform = getPlatform();
      const perm = await platform.push.requestPermission();
      toast.message("Alerts on", {
        description:
          perm === "granted"
            ? "In-app Alerts on. Browser notifications allowed if the OS permits."
            : "In-app Alerts on. Browser push not granted (optional).",
      });
    } else {
      toast.message("Alerts off", {
        description: "In-app alerts preference saved.",
      });
    }
  };

  // Dark mode (respects system + persisted, clean calm dark theme)
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved ? saved === "dark" : prefersDark;
    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = (checked?: boolean) => {
    const next = typeof checked === "boolean" ? checked : !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem(STORAGE_KEYS.THEME, "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem(STORAGE_KEYS.THEME, "light");
    }
  };

  // Family Sharing state (persisted; multi-user invites via Manage Family)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(() => {
    if (typeof window === "undefined") return defaultFamilyMembers();
    return loadFamilyMembers();
  });
  useEffect(() => {
    saveFamilyMembers(familyMembers);
  }, [familyMembers]);

  // Re-sync profile + household after login / invite join
  useEffect(() => {
    if (!isAuthenticated) return;
    setFamilyMembers(loadFamilyMembers());
    applyProfile(loadStoredProfile());
    setHouseholdName(loadHouseholdName("Family pantry"));
  }, [isAuthenticated, applyProfile]);

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as ActivityLogEntry[];
      }
    } catch {}
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify(activityLog.slice(0, 50)));
    } catch {}
  }, [activityLog]);
  const [showFamilyDrawer, setShowFamilyDrawer] = useState(false);
  const [showManageFamily, setShowManageFamily] = useState(false);

  const addActivity = useCallback((user: string, action: string) => {
    setActivityLog((prev) => [
      { user, action, time: "just now" },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const clearActivity = useCallback(() => {
    setActivityLog([]);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOG, JSON.stringify([]));
    } catch {}
  }, []);

  const renameHousehold = useCallback(
    (name: string) => {
      const saved = saveHouseholdName(name);
      setHouseholdName(saved);
      addActivity("You", `renamed household to ${saved}`);
    },
    [addActivity]
  );

  const addFamilyMember = useCallback(
    (member: Omit<FamilyMember, "id" | "isYou">) => {
      const id = createMemberId();
      const full = normalizeFamilyMember({
        id,
        name: member.name,
        emoji: member.emoji,
        phone: member.phone || "",
        inviteCode: member.inviteCode || generateInviteCode(),
        status: member.status || "pending",
        email: member.email,
      });
      setFamilyMembers((prev) => [...prev, full]);
      addActivity("You", `invited ${member.name} to the household`);
    },
    [addActivity]
  );

  const removeFamilyMember = useCallback(
    (id: string) => {
      setFamilyMembers((prev) => {
        const target = prev.find((m) => m.id === id);
        // Allow removing pending invites and joined members; never the owner / self
        if (!target || target.isYou || target.status === "owner") return prev;
        const action =
          target.status === "pending"
            ? `cancelled invite for ${target.name}`
            : `removed ${target.name} from the household`;
        addActivity("You", action);
        return prev.filter((m) => m.id !== id);
      });
    },
    [addActivity]
  );

  const updateFamilyMember = useCallback((id: string, patch: Partial<FamilyMember>) => {
    setFamilyMembers((prev) =>
      prev.map((m) => (m.id === id ? normalizeFamilyMember({ ...m, ...patch, id: m.id, name: patch.name ?? m.name }) : m))
    );
  }, []);

  const openManageFamily = useCallback(() => {
    setShowFamilyDrawer(false);
    setShowSettings(false);
    setShowManageFamily(true);
  }, []);

  /** Demo: log out and open invite acceptance as the invited member */
  const simulateAcceptInvite = useCallback(
    (member: FamilyMember) => {
      const code = member.inviteCode || generateInviteCode();
      if (!member.inviteCode) {
        updateFamilyMember(member.id, { inviteCode: code, status: "pending" });
      }
      setShowManageFamily(false);
      setShowFamilyDrawer(false);
      setShowSettings(false);
      try {
        localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
        localStorage.setItem(STORAGE_KEYS.PENDING_INVITE, code);
        // Keep pantry data so joiners see the same shared inventory
      } catch {}
      setIsAuthenticated(false);
      setForcedInviteCode(code);
      // Reflect invite URL for realism
      try {
        const url = buildInviteUrl(code);
        window.history.replaceState({}, "", new URL(url).pathname + new URL(url).search);
      } catch {}
      toast.message("Invite opened", {
        description: `Create an account as ${member.name} to join the shared pantry.`,
      });
    },
    [updateFamilyMember]
  );

  // Pantry domain state + actions (extracted from god component)
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
    dismissBanner,
  } = usePantry({ onActivity: addActivity });

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

  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const requestConfirm = useCallback((req: ConfirmRequest) => {
    setConfirmRequest(req);
  }, []);

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
    [items, removeItem, restoreItem, rememberPantryItem, requestConfirm]
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
    }) => {
      const newItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: input.name,
        qty: input.qty,
        unit: input.unit,
        emoji: input.emoji,
        daysLeft: getDefaultDaysLeft(input.name, active),
        minStock: input.minStock || getDefaultMinStock(input.name),
      };
      setItems((prev) => applyIncomingToStorage(prev, active, newItem));
      rememberPantryItem(newItem, "pantry_add");
      addActivity("You", `added ${input.qty} ${input.unit} ${input.name}`);
      toast.success("Added to pantry", { description: newItem.name });
    },
    [active, setItems, rememberPantryItem, addActivity]
  );

  const handleScannedItems = useCallback(
    (
      scanned: Parameters<typeof addScannedItems>[0],
      options?: Parameters<typeof addScannedItems>[1]
    ) => {
      addScannedItems(scanned, options);
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
    },
    [addScannedItems, rememberPantryItem]
  );

  // Persist auth for seamless PWA / reload / offline experience
  const doLogin = () => {
    try { localStorage.setItem(STORAGE_KEYS.LOGGED_IN, "true"); } catch {}
    setForcedInviteCode(null);
    setFamilyMembers(loadFamilyMembers());
    setIsAuthenticated(true);
  };
  const doLogout = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    } catch {}
    setIsAuthenticated(false);
  };

  // PWA install prompt (beforeinstallprompt) — native feel "Add to Home Screen"
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      const dismissed = localStorage.getItem(STORAGE_KEYS.INSTALL_DISMISSED);
      if (!dismissed) {
        // small delay so not jarring on first load
        setTimeout(() => setShowInstallBanner(true), 1200);
      }
    };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  const handleInstall = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    try {
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === "accepted") {
        toast.success("Installed!", { description: "Friġġ is now on your home screen." });
      }
    } catch {}
    setInstallPromptEvent(null);
    setShowInstallBanner(false);
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem(STORAGE_KEYS.INSTALL_DISMISSED, String(Date.now()));
  };

  // Recipes state
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>("all");

  const simulateFamilyUpdate = (memberName: string) => {
    // Simulate a family member adding an item or updating
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
    addActivity(memberName, `added ${demo.qty}${demo.unit} ${demo.name}`);
    toast.success(`${memberName} updated the pantry`, {
      description: `+${demo.qty} ${demo.unit} ${demo.name}`,
    });

    // Switch to pantry to see the update
    setActiveView("pantry");
    setActive(targetStorage);
  };

  // Shopping list state (persisted — P0-4)
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SHOPPING_LIST);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as ShoppingListItem[];
      }
    } catch {}
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SHOPPING_LIST, JSON.stringify(shoppingList));
    } catch {}
  }, [shoppingList]);

  // Compute items that should be on the shopping list (below min or running low)
  const computeSuggestedItems = (): ShoppingListItem[] => {
    const needed: ShoppingListItem[] = [];

    (["fridge", "freezer", "pantry"] as StorageKey[]).forEach((storage) => {
      items[storage].forEach((item) => {
        const min = item.minStock ?? 2;
        const isBelowMin = item.qty < min;
        const isRunningLow = item.daysLeft <= 2 && item.qty <= Math.max(1, Math.floor(min / 2));

        if (isBelowMin || isRunningLow) {
          const buyQty = Math.max(min - item.qty, 1);
          // Avoid duplicates by name (case-insensitive)
          if (!needed.some((n) => n.name.toLowerCase() === item.name.toLowerCase())) {
            needed.push({
              id: `shop-${item.id}-${Date.now()}`,
              name: item.name,
              qty: buyQty,
              unit: item.unit,
              emoji: item.emoji,
              checked: false,
            });
          }
        }
      });
    });

    return needed;
  };

  // One-tap generate shopping list
  const generateShoppingList = () => {
    const needed = computeSuggestedItems();

    if (needed.length > 0) {
      setShoppingList(needed);
      setActiveView("list"); // Jump to the list view
    } else {
      // Show friendly message
      setAddedBanner({ count: 0, message: "Everything looks well stocked!" });
      setTimeout(() => setAddedBanner(null), 2800);
    }
  };

  // Number of items the generator would suggest right now (for button badge)
  const suggestedCount = computeSuggestedItems().length;

  // Toggle check on shopping list item
  const toggleShoppingItem = (id: string) => {
    setShoppingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  // Update suggested qty on shopping list
  const updateShoppingQty = (id: string, delta: number) => {
    setShoppingList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );
  };

  // Remove from list (or clear checked)
  const removeFromShoppingList = (id?: string) => {
    if (id) {
      setShoppingList((prev) => prev.filter((item) => item.id !== id));
    } else {
      // Clear all checked
      setShoppingList((prev) => prev.filter((item) => !item.checked));
    }
  };

  // Mark purchased: bump pantry stock for checked items, then clear them
  const markPurchased = () => {
    const purchased = shoppingList.filter((i) => i.checked);
    if (purchased.length === 0) return;

    setItems((prev) => {
      let next = { ...prev };
      purchased.forEach((p) => {
        let merged = false;
        (Object.keys(next) as StorageKey[]).forEach((storage) => {
          const has = next[storage].some((item) => sameProduct(item, p));
          if (has) {
            next = {
              ...next,
              [storage]: next[storage].map((item) =>
                sameProduct(item, p) ? { ...item, qty: item.qty + p.qty } : item
              ),
            };
            merged = true;
          }
        });
        if (!merged) {
          const incoming = {
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: p.name,
            qty: p.qty,
            unit: p.unit,
            emoji: p.emoji,
            daysLeft: getDefaultDaysLeft(p.name, "fridge"),
            minStock: getDefaultMinStock(p.name),
          };
          next = applyIncomingToStorage(next, "fridge", incoming);
        }
      });
      return next;
    });

    setShoppingList((prev) => prev.filter((item) => !item.checked));

    purchased.forEach((p) => {
      rememberPantryItem(
        {
          name: p.name,
          unit: p.unit,
          emoji: p.emoji,
          minStock: getDefaultMinStock(p.name),
        },
        "pantry_add"
      );
    });

    setAddedBanner({
      count: purchased.length,
      message: `Added ${purchased.length} item${purchased.length > 1 ? "s" : ""} to your pantry`,
    });
    addActivity("You", `purchased ${purchased.length} item${purchased.length > 1 ? "s" : ""}`);
    setTimeout(() => setAddedBanner(null), 3200);
  };

  // Export / Share the current shopping list (uses Web Share API + clipboard fallback)
  const exportShoppingList = async () => {
    if (shoppingList.length === 0) return;

    const listText = shoppingList
      .map((item) => `${item.checked ? "☑" : "☐"} ${item.qty} ${item.unit}  ${item.name}`)
      .join("\n");

    const fullText = `🛒 Shopping List\n\n${listText}\n\nGenerated by Friġġ`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Shopping List",
          text: fullText,
        });
      } else {
        await navigator.clipboard.writeText(fullText);
        toast.success("Copied to clipboard", {
          description: "Your shopping list is ready to paste anywhere.",
        });
      }
    } catch (err) {
      // Fallback for when share is cancelled or unavailable
      try {
        await navigator.clipboard.writeText(fullText);
        toast.success("Copied to clipboard", {
          description: "Your shopping list is ready to paste anywhere.",
        });
      } catch {
        toast.error("Couldn't share", { description: "Please try again." });
      }
    }
  };

  const isListView = activeView === "list";
  const isRecipesView = activeView === "recipes";
  const isFinancesView = activeView === "finances";
  const listCount = shoppingList.length;
  const checkedCount = shoppingList.filter((i) => i.checked).length;

  // Alerts: expiring soon + low stock (for header bell)
  const alertItems = (() => {
    const rows: Array<{ id: string; emoji: string; name: string; reason: string; storage: StorageKey }> = [];
    (["fridge", "freezer", "pantry"] as StorageKey[]).forEach((storage) => {
      items[storage].forEach((item) => {
        if (item.daysLeft <= 3) {
          rows.push({
            id: `${item.id}-exp`,
            emoji: item.emoji,
            name: item.name,
            reason:
              item.daysLeft <= 0
                ? "Expired"
                : item.daysLeft === 1
                  ? "Use today"
                  : `${item.daysLeft}d left`,
            storage,
          });
        } else if (item.qty < (item.minStock ?? 2)) {
          rows.push({
            id: `${item.id}-low`,
            emoji: item.emoji,
            name: item.name,
            reason: `Low stock (${item.qty} ${item.unit})`,
            storage,
          });
        }
      });
    });
    return rows;
  })();
  const alertsCount = notificationsEnabled ? alertItems.length : 0;

  // === RECIPES DATA & HELPERS (P1-3 real stats) ===
  const allRecipes: Recipe[] = ALL_RECIPES;
  const getMatchingCount = (recipe: Recipe) => countRecipeAvailability(items, recipe);
  const canMakeRecipe = (recipe: Recipe) => canMakeRecipeFully(items, recipe);

  const getFilteredRecipes = (): Recipe[] => {
    let filtered = [...allRecipes];
    if (recipeFilter === "canMake") {
      filtered = filtered.filter(canMakeRecipe);
    } else if (recipeFilter === "expiring") {
      const expiringNames = new Set(
        (["fridge", "freezer", "pantry"] as StorageKey[]).flatMap((s) =>
          items[s].filter((i) => i.daysLeft <= 3).map((i) => i.name.toLowerCase())
        )
      );
      filtered = filtered.filter((r) =>
        r.ingredients.some((ing) => expiringNames.has(ing.name.toLowerCase()))
      );
    }
    return filtered.sort((a, b) => getMatchingCount(b) - getMatchingCount(a));
  };

  const filteredRecipes = getFilteredRecipes();
  const recipeIdeasCount = filteredRecipes.length;
  const recipeReadyCount = filteredRecipes.filter(canMakeRecipe).length;

  const headerTotal = isListView
    ? listCount
    : isRecipesView
      ? recipeIdeasCount
      : isFinancesView
        ? receipts.length
        : current.length;
  const headerAttention = isListView
    ? checkedCount
    : isRecipesView
      ? recipeReadyCount
      : isFinancesView
        ? new Set(receipts.map((r) => r.store)).size
        : expiringSoon;

  const financesMonthLabel = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // "Used in Recipe" - confirm then deduct (P1-4)
  const cookRecipe = (recipe: Recipe) => {
    const preview = recipe.ingredients
      .map((ing) => `${ing.qty} ${ing.unit} ${ing.name}`)
      .join(", ");
    requestConfirm({
      title: `Cook ${recipe.name}?`,
      description: `This will deduct from your pantry where stock allows: ${preview}.`,
      confirmLabel: "Cook & deduct",
      onConfirm: () => {
        const snapshot = JSON.parse(JSON.stringify(items)) as typeof items;
        const { next, used } = deductIngredients(items, recipe.ingredients);
        setItems(next);

        if (used.length > 0) {
          // Items removed at 0 after cook (confirmed) — keep names in Database
          used.forEach((name) => {
            const found = (["fridge", "freezer", "pantry"] as StorageKey[])
              .flatMap((s) => snapshot[s])
              .find((i) => i.name === name);
            if (found) rememberPantryItem(found, "pantry_delete");
          });
          toast.success(`Used in ${recipe.name}`, {
            description: `Deducted: ${used.join(", ")}`,
            action: {
              label: "Undo",
              onClick: () => setItems(snapshot),
            },
            duration: 5000,
          });
          addActivity("You", `cooked ${recipe.name}`);
          setActiveView("pantry");
          setActive("fridge");
        } else {
          toast("Not enough ingredients", { description: "Some items are low." });
        }
      },
    });
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
        <div className="text-center select-none">
          <div className="text-[78px] mb-3">🥛</div>
          <div className="font-display text-[44px] tracking-[-0.035em] text-foreground">Friġġ</div>
          <p className="mt-1.5 text-[15px] text-muted-foreground tracking-[-0.01em]">Your calm family pantry</p>
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
        onClearForcedInvite={() => setForcedInviteCode(null)}
      />
    );
  }

  const sharedItemCount =
    items.fridge.length + items.freezer.length + items.pantry.length;

  return (
    <div className="relative min-h-dvh pb-32 bg-background touch-manipulation">
      {showManageFamily && (
        <ManageFamilyPage
          householdName={householdName}
          members={familyMembers}
          activityLog={activityLog}
          sharedItemCount={sharedItemCount}
          onBack={() => setShowManageFamily(false)}
          onAddMember={addFamilyMember}
          onRemoveMember={removeFamilyMember}
          onUpdateMember={updateFamilyMember}
          onRenameHousehold={renameHousehold}
          onSimulateAcceptInvite={simulateAcceptInvite}
          onClearActivity={clearActivity}
        />
      )}

      <GlassHeader
        household={householdName}
        expiringSoon={headerAttention}
        totalItems={headerTotal}
        title={isListView ? "Shopping List" : isRecipesView ? "Recipes" : isFinancesView ? "Finances" : "Your Friġġ"}
        subtitle={
          isListView
            ? "Restock smart"
            : isRecipesView
              ? "Cook with what you have"
              : isFinancesView
                ? financesMonthLabel
                : personalGreeting(userFullName)
        }
        totalLabel={isFinancesView ? "receipts" : isRecipesView ? "ideas" : undefined}
        attentionLabel={
          isListView ? "checked" : isFinancesView ? "stores" : isRecipesView ? "ready" : undefined
        }
        attentionTone={isListView || isRecipesView || isFinancesView ? "calm" : undefined}
        familyMembers={familyMembers}
        isShared={true}
        onShowFamily={() => setShowFamilyDrawer(true)}
        onOpenSettings={() => setShowSettings(true)}
        onShowAlerts={() => {
          setShowAlerts(true);
          // Optional system notification when permission already granted (D-3 adapter)
          if (notificationsEnabled && alertItems.length > 0) {
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
            shoppingList={shoppingList}
            listCount={listCount}
            checkedCount={checkedCount}
            suggestedCount={suggestedCount}
            catalog={catalog}
            mergeGroups={mergeGroups}
            onExport={exportShoppingList}
            onRegenerate={() => {
              if (shoppingList.length > 0) {
                requestConfirm({
                  title: "Regenerate shopping list?",
                  description: "This replaces your current list with suggestions from pantry needs.",
                  confirmLabel: "Regenerate",
                  destructive: true,
                  onConfirm: generateShoppingList,
                });
              } else {
                generateShoppingList();
              }
            }}
            onUpdateQty={updateShoppingQty}
            onToggle={toggleShoppingItem}
            onMarkPurchased={() => {
              if (checkedCount === 0) return;
              requestConfirm({
                title: "Mark as purchased?",
                description: `Move ${checkedCount} checked item${checkedCount === 1 ? "" : "s"} into your pantry and clear them from the list.`,
                confirmLabel: "Mark purchased",
                onConfirm: markPurchased,
              });
            }}
            onClear={() => {
              const n = shoppingList.filter((i) => i.checked).length;
              if (n === 0) {
                requestConfirm({
                  title: "Clear shopping list?",
                  description: "Remove all items from the current shopping list. Your Database is not affected.",
                  confirmLabel: "Clear list",
                  destructive: true,
                  onConfirm: () => setShoppingList([]),
                });
                return;
              }
              requestConfirm({
                title: "Clear checked items?",
                description: `Remove ${n} checked item${n === 1 ? "" : "s"} from the shopping list.`,
                confirmLabel: "Clear",
                destructive: true,
                onConfirm: () => removeFromShoppingList(),
              });
            }}
            onAddFromCatalog={(c) => {
              setShoppingList((prev) =>
                upsertShoppingListItem(prev, {
                  id: `shop-cat-${c.id}-${Date.now()}`,
                  name: c.name,
                  qty: 1,
                  unit: c.unit,
                  emoji: c.emoji,
                })
              );
              toast.success("Added to list", { description: c.name });
            }}
            onAddManualToList={(name, unit, emoji, qty) => {
              setShoppingList((prev) =>
                upsertShoppingListItem(prev, {
                  id: `shop-manual-${Date.now()}`,
                  name,
                  qty,
                  unit,
                  emoji,
                })
              );
              addCatalogItem({ name, unit, emoji });
              toast.success("Added to list", { description: name });
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
                description: "Remove this item from the Database. Pantry stock is not deleted.",
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
            recipeFilter={recipeFilter}
            onFilterChange={setRecipeFilter}
            filteredRecipes={filteredRecipes}
            countAvailable={getMatchingCount}
            canMakeFully={canMakeRecipe}
            onCook={cookRecipe}
          />
        ) : isFinancesView ? (

          // === FINANCIALS / MONEY VIEW - receipts + charts ===
          <Suspense
            fallback={
              <div className="py-16 text-center text-sm text-muted-foreground">Loading finances…</div>
            }
          >
            <FinancialsScreen
              receipts={receipts}
              onDeleteReceipt={handleDeleteReceipt}
              onAddReceipt={addReceipt}
            />
          </Suspense>
        ) : (
          // === PANTRY VIEW ===
          // NOTE: Never re-add temporary "BUILD CHECK" / diagnostic green banners here.
          // They were removed permanently; layout is 1-column without them.
          <>
            {/* Full-width storage segmented control — never partial width */}
            <div
              className="mb-3"
              style={{ width: "100%", maxWidth: "100%", display: "block" }}
            >
              <StorageTabs active={active} onChange={setActive} />
            </div>
            <button
              type="button"
              onClick={() => setAddSheetOpen(true)}
              className="mb-1 flex w-full items-center justify-center gap-2 rounded-3xl border border-border/60 bg-card py-3 text-sm font-semibold active:bg-secondary/50 active:scale-[0.99] transition"
            >
              <Plus className="size-4" />
              Add item
            </button>
            {/* Silent success + motivational banner */}
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

            {/* PWA Install banner — calm, native-feel, dismissible */}
            {showInstallBanner && installPromptEvent && (
              <div className="mt-3 flex items-center gap-3 rounded-3xl border border-border/60 bg-card px-4 py-2.5 text-sm">
                <div className="text-xl">📱</div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">Add Friġġ to Home Screen</span>
                  <span className="ml-1 text-muted-foreground text-xs">for the full app experience.</span>
                </div>
                <button
                  onClick={handleInstall}
                  className="rounded-2xl bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground active:scale-[0.985] transition"
                >
                  Add
                </button>
                <button
                  onClick={dismissInstall}
                  className="text-muted-foreground/70 px-1 active:text-foreground"
                  aria-label="Dismiss install prompt"
                >
                  ×
                </button>
              </div>
            )}

            {current.length === 0 ? (
              <EmptyState label={active} />
            ) : (
              /* FINAL: 1-column vertical stack only — never grid / never 2-col */
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

      {!isListView && !isRecipesView && !isFinancesView && <ScanFab onClick={() => setScanOpen(true)} />}
      <BottomNav 
        active={isListView ? "list" : isRecipesView ? "recipes" : isFinancesView ? "money" : "pantry"} 
        badges={suggestedCount > 0 ? { list: suggestedCount } : {}}
        onChange={(key) => {
        if (key === "pantry" || key === "list") {
          setActiveView(key as "pantry" | "list");
          if (key === "pantry") setActive("fridge"); // reset to fridge when going back
        } else if (key === "recipes") {
          setActiveView("recipes");
        } else if (key === "money") {
          setActiveView("finances");
        } else {
          setAddedBanner({ count: 0, message: "Coming soon" });
          setTimeout(() => setAddedBanner(null), 1500);
        }
      }} />

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
        onReceiptSaved={(receipt) => {
          addReceipt(receipt);
          addActivity("You", `saved receipt from ${receipt.store}`);
        }}
      />

      <SettingsDrawer
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) setEditingProfile(false);
        }}
        userFullName={userFullName}
        userEmail={userEmail}
        userEmoji={userEmoji}
        householdName={householdName}
        memberCount={familyMembers.length}
        isDark={isDark}
        notificationsEnabled={notificationsEnabled}
        editingProfile={editingProfile}
        profileDraft={profileDraft}
        hasInstallPrompt={!!installPromptEvent}
        onStartEditProfile={() => {
          setProfileDraft({
            name: userFullName,
            email: userEmail,
            emoji: userEmoji,
          });
          setEditingProfile(true);
        }}
        onCancelEditProfile={() => setEditingProfile(false)}
        onProfileDraftChange={setProfileDraft}
        onSaveProfile={saveProfile}
        onToggleNotifications={toggleNotifications}
        onToggleDarkMode={toggleDarkMode}
        onManageFamily={() => {
          setShowSettings(false);
          openManageFamily();
        }}
        onInstall={() => {
          handleInstall();
          setShowSettings(false);
        }}
        onShowInstallHint={() => {
          setShowSettings(false);
          setShowInstallBanner(true);
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
        notificationsEnabled={notificationsEnabled}
        alertItems={alertItems}
      />

      <FamilyDrawer
        open={showFamilyDrawer}
        onOpenChange={setShowFamilyDrawer}
        householdName={householdName}
        members={familyMembers}
        activityLog={activityLog}
        onSimulateMember={simulateFamilyUpdate}
        onManageFamily={openManageFamily}
        onClearActivity={clearActivity}
      />

      {/* Item Details Drawer — rename, tappable numbers, date expiry, price */}
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

function EmptyState({ label }: { label: StorageKey }) {
  return (
    <div className="mt-20 flex flex-col items-center text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-3xl bg-secondary/70 text-4xl shadow-inner">
        {label === "freezer" ? "🧊" : "🫙"}
      </div>
      <p className="mt-5 font-display text-[21px] font-medium tracking-[-0.01em] text-foreground">
        Nothing here yet
      </p>
      <p className="mt-1.5 max-w-[220px] text-[13px] leading-snug text-muted-foreground">
        Tap the scan button to add items. Your family can update the shared pantry too.
      </p>
    </div>
  );
}