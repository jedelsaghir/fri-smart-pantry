import { useState } from "react";
import { GlassHeader } from "./GlassHeader";
import { StorageTabs, type StorageKey } from "./StorageTabs";
import { ItemCard, type PantryItem, getStatus } from "./ItemCard";
import { BottomNav } from "./BottomNav";
import { ScanFab } from "./ScanFab";
import { ReceiptScanFlow, type DetectedItem } from "./ReceiptScanFlow";
import { toast } from "sonner";
import { FinancialsScreen } from "./FinancialsScreen";
import { Snowflake, Calendar, ArrowRight, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";

const SEED: Record<StorageKey, PantryItem[]> = {
  fridge: [
    { id: "1", name: "Whole milk", qty: 2, unit: "L", emoji: "🥛", daysLeft: 12, minStock: 2 },
    { id: "2", name: "Free-range eggs", qty: 8, unit: "pcs", emoji: "🥚", daysLeft: 19, minStock: 6 },
    { id: "3", name: "Greek yogurt", qty: 1, unit: "tub", emoji: "🥣", daysLeft: 2, minStock: 2 },
    { id: "4", name: "Cherry tomatoes", qty: 1, unit: "pack", emoji: "🍅", daysLeft: 5, minStock: 2 },
    { id: "5", name: "Aged cheddar", qty: 220, unit: "g", emoji: "🧀", daysLeft: 18, minStock: 150 },
    { id: "6", name: "Baby spinach", qty: 1, unit: "bag", emoji: "🥬", daysLeft: 1, minStock: 1 },
  ],
  freezer: [
    { id: "f1", name: "Chicken thighs", qty: 600, unit: "g", emoji: "🍗", daysLeft: 95, minStock: 1 },
  ],
  pantry: [],
};

function getDefaultMinStock(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("milk") || lower.includes("yogurt")) return 2;
  if (lower.includes("egg")) return 6;
  if (lower.includes("cheese")) return 150;
  if (lower.includes("frozen") || lower.includes("chicken")) return 1;
  if (lower.includes("bread") || lower.includes("pasta")) return 1;
  if (lower.includes("oil")) return 1;
  if (lower.includes("tomato") || lower.includes("spinach") || lower.includes("avocado") || lower.includes("herb")) return 1;
  return 2;
}

// Realistic default fridge shelf life (days) for newly scanned / added items
function getDefaultDaysLeft(name: string, targetStorage: StorageKey = "fridge"): number {
  const lower = name.toLowerCase();

  // If going directly into freezer via scan/review, use longer initial life
  const isFreezer = targetStorage === "freezer";

  // Meats / proteins
  if (lower.includes("chicken") || lower.includes("thigh") || lower.includes("breast")) {
    return isFreezer ? 120 + Math.floor(Math.random() * 30) : 4 + Math.floor(Math.random() * 2);
  }
  if (lower.includes("beef") || lower.includes("steak") || lower.includes("ground")) {
    return isFreezer ? 150 : 3 + Math.floor(Math.random() * 2);
  }
  if (lower.includes("fish") || lower.includes("salmon") || lower.includes("shrimp")) {
    return isFreezer ? 90 : 2 + Math.floor(Math.random() * 1);
  }

  // Dairy
  if (lower.includes("milk")) return isFreezer ? 90 : 12 + Math.floor(Math.random() * 4);
  if (lower.includes("yogurt") || lower.includes("greek")) return isFreezer ? 75 : 8 + Math.floor(Math.random() * 4);
  if (lower.includes("cheese") || lower.includes("cheddar")) return isFreezer ? 180 : 18 + Math.floor(Math.random() * 6);
  if (lower.includes("egg")) return isFreezer ? 180 : 18 + Math.floor(Math.random() * 6);

  // Produce
  if (lower.includes("spinach") || lower.includes("lettuce") || lower.includes("herb") || lower.includes("basil")) {
    return isFreezer ? 180 : 4 + Math.floor(Math.random() * 3);
  }
  if (lower.includes("tomato") || lower.includes("cherry")) return isFreezer ? 120 : 5 + Math.floor(Math.random() * 3);
  if (lower.includes("avocado")) return isFreezer ? 90 : 4 + Math.floor(Math.random() * 2);
  if (lower.includes("berry") || lower.includes("frozen")) return isFreezer ? 200 : 5 + Math.floor(Math.random() * 3);

  // Pantry staples
  if (lower.includes("bread")) return isFreezer ? 120 : 6 + Math.floor(Math.random() * 3);
  if (lower.includes("pasta") || lower.includes("rice")) return 45 + Math.floor(Math.random() * 15);
  if (lower.includes("oil")) return 120 + Math.floor(Math.random() * 30);

  // Default
  const base = isFreezer ? 120 : 7 + Math.floor(Math.random() * 5);
  return Math.max(1, base);
}

// Days to add to expiration when moving an item into the freezer
function getFreezerExtensionDays(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("chicken") || lower.includes("thigh") || lower.includes("breast") || lower.includes("beef") || lower.includes("steak")) {
    return 90;
  }
  if (lower.includes("fish") || lower.includes("salmon") || lower.includes("shrimp")) {
    return 75;
  }
  if (lower.includes("milk") || lower.includes("yogurt")) {
    return 60;
  }
  if (lower.includes("spinach") || lower.includes("vegetable") || lower.includes("berry") || lower.includes("fruit") || lower.includes("tomato")) {
    return 180;
  }
  if (lower.includes("bread")) return 90;
  if (lower.includes("egg")) return 150;
  if (lower.includes("cheese")) return 120;
  return 90; // sensible default for most items
}

export function PantryScreen() {
  const [active, setActive] = useState<StorageKey>("fridge");
  const [activeView, setActiveView] = useState<"pantry" | "list" | "recipes" | "finances">("pantry");
  const [items, setItems] = useState(SEED);
  const [scanOpen, setScanOpen] = useState(false);
  const [addedBanner, setAddedBanner] = useState<{ count: number; message: string } | null>(null);

  // Item details drawer state (for expiration editing + move to freezer)
  const [detailsItem, setDetailsItem] = useState<{ item: PantryItem; storage: StorageKey } | null>(null);

  // Recipes state
  const [recipeFilter, setRecipeFilter] = useState<"all" | "canMake" | "expiring">("all");

  // Shopping list state (for the List tab)
  type ShoppingListItem = {
    id: string;
    name: string;
    qty: number;
    unit: string;
    emoji: string;
    checked: boolean;
  };

  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);

  const current = items[active];

  const updateQty = (id: string, delta: number) => {
    setItems((prev) => ({
      ...prev,
      [active]: prev[active]
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    }));
  };

  const updateMinStock = (id: string, newMin: number) => {
    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(next) as StorageKey[]).forEach((storage) => {
        next[storage] = next[storage].map((i) =>
          i.id === id ? { ...i, minStock: Math.max(0, newMin) } : i
        );
      });
      return next;
    });
  };

  const updateDaysLeft = (id: string, newDays: number) => {
    const clamped = Math.max(0, Math.floor(newDays));
    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(next) as StorageKey[]).forEach((storage) => {
        next[storage] = next[storage].map((i) =>
          i.id === id ? { ...i, daysLeft: clamped } : i
        );
      });
      return next;
    });
  };

  // Move item to a different storage (e.g. Fridge → Freezer) and extend expiration when freezing
  const moveItem = (id: string, fromStorage: StorageKey, toStorage: StorageKey) => {
    if (fromStorage === toStorage) return;

    // Capture item info + extension before state update
    const sourceItem = items[fromStorage].find((i) => i.id === id);
    if (!sourceItem) return;

    const extension = (toStorage === "freezer" && fromStorage !== "freezer")
      ? getFreezerExtensionDays(sourceItem.name)
      : 0;

    setItems((prev) => {
      const source = [...prev[fromStorage]];
      const idx = source.findIndex((i) => i.id === id);
      if (idx === -1) return prev;

      const item = { ...source[idx] };

      if (extension > 0) {
        item.daysLeft = item.daysLeft + extension;
      }

      source.splice(idx, 1);
      const target = [...prev[toStorage], item];

      return {
        ...prev,
        [fromStorage]: source,
        [toStorage]: target,
      };
    });

    // Close drawer if open for this item
    if (detailsItem && detailsItem.item.id === id) {
      setDetailsItem(null);
    }

    if (extension > 0) {
      toast.success(`Moved to Freezer`, {
        description: `Expiration extended by +${extension} days`,
      });
    } else {
      const dest = toStorage === "pantry" ? "Pantry" : toStorage === "freezer" ? "Freezer" : "Fridge";
      toast.success(`Moved to ${dest}`);
    }
  };

  // Convenience: move from current fridge to freezer (primary use case)
  const moveToFreezer = (id: string, fromStorage: StorageKey = "fridge") => {
    moveItem(id, fromStorage, "freezer");
  };

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

  // Open the item details drawer (expiration editor + move actions)
  const openItemDetails = (item: PantryItem, storage: StorageKey) => {
    setDetailsItem({ item: { ...item }, storage });
  };

  const closeItemDetails = () => setDetailsItem(null);

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
      const next = { ...prev };
      purchased.forEach((p) => {
        // Try to find matching item in any storage and increase qty
        (Object.keys(next) as StorageKey[]).forEach((storage) => {
          next[storage] = next[storage].map((item) => {
            if (item.name.toLowerCase() === p.name.toLowerCase()) {
              return { ...item, qty: item.qty + p.qty };
            }
            return item;
          });
        });
      });
      return next;
    });

    setShoppingList((prev) => prev.filter((item) => !item.checked));

    setAddedBanner({
      count: purchased.length,
      message: `Added ${purchased.length} item${purchased.length > 1 ? "s" : ""} to your pantry`,
    });
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

  // Core: add scanned items (can target any storage)
  const addScannedItems = (scanned: Array<Omit<DetectedItem, "id" | "confidence">>) => {
    if (scanned.length === 0) return;

    const newItemsByStorage: Partial<Record<StorageKey, PantryItem[]>> = {};

    scanned.forEach((s) => {
      const target = s.storage;
      const newItem: PantryItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: s.name,
        qty: s.qty,
        unit: s.unit,
        emoji: s.emoji,
        daysLeft: getDefaultDaysLeft(s.name, target),
        minStock: getDefaultMinStock(s.name),
      };

      if (!newItemsByStorage[target]) newItemsByStorage[target] = [];
      newItemsByStorage[target]!.push(newItem);
    });

    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(newItemsByStorage) as StorageKey[]).forEach((storage) => {
        next[storage] = [...(next[storage] || []), ...(newItemsByStorage[storage] || [])];
      });
      return next;
    });

    // Show premium silent success feedback
    const storages = Array.from(new Set(scanned.map((s) => s.storage)));
    const storageLabel =
      storages.length === 1
        ? storages[0] === "fridge"
          ? "Fridge"
          : storages[0] === "freezer"
          ? "Freezer"
          : "Pantry"
        : "pantry";

    const count = scanned.length;
    const message = `Added ${count} item${count > 1 ? "s" : ""} to your ${storageLabel.toLowerCase()}`;

    setAddedBanner({ count, message });

    // Auto-hide banner
    setTimeout(() => setAddedBanner(null), 5200);
  };

  const expiringSoon = current.filter((i) => i.daysLeft <= 3).length;

  // Clear banner if user switches tabs or manually
  const dismissBanner = () => setAddedBanner(null);

  const isListView = activeView === "list";
  const isRecipesView = activeView === "recipes";
  const isFinancesView = activeView === "finances";
  const listCount = shoppingList.length;
  const checkedCount = shoppingList.filter((i) => i.checked).length;

  // For list view we show different header stats
  const headerTotal = isListView ? listCount : isRecipesView ? 6 : isFinancesView ? 18 : current.length;
  const headerAttention = isListView ? checkedCount : isRecipesView ? 3 : isFinancesView ? 5 : expiringSoon;
  const attentionTone = isListView || isRecipesView || isFinancesView ? "calm" : (headerAttention > 0 ? "warn" : "calm");

  // Global low stock count (items currently below their minStock)
  const lowStockCount = (["fridge", "freezer", "pantry"] as StorageKey[]).reduce((sum, s) => {
    return sum + items[s].filter((i) => i.qty < (i.minStock ?? 2)).length;
  }, 0);

  // === RECIPES DATA & HELPERS ===
  type RecipeIngredient = { name: string; qty: number; unit: string };
  type Recipe = {
    id: string;
    name: string;
    emoji: string;
    time: string;
    servings: number;
    ingredients: RecipeIngredient[];
    category: string;
  };

  const allRecipes: Recipe[] = [
    {
      id: "r1",
      name: "Scrambled Eggs",
      emoji: "🍳",
      time: "10 min",
      servings: 2,
      ingredients: [
        { name: "Free-range eggs", qty: 3, unit: "pcs" },
        { name: "Whole milk", qty: 0.1, unit: "L" },
      ],
      category: "Breakfast",
    },
    {
      id: "r2",
      name: "Greek Yogurt Bowl",
      emoji: "🥣",
      time: "5 min",
      servings: 1,
      ingredients: [
        { name: "Greek yogurt", qty: 1, unit: "tub" },
        { name: "Baby spinach", qty: 0.5, unit: "bag" },
      ],
      category: "Breakfast",
    },
    {
      id: "r3",
      name: "Cherry Tomato Salad",
      emoji: "🥗",
      time: "8 min",
      servings: 2,
      ingredients: [
        { name: "Cherry tomatoes", qty: 1, unit: "pack" },
        { name: "Baby spinach", qty: 1, unit: "bag" },
      ],
      category: "Lunch",
    },
    {
      id: "r4",
      name: "Cheesy Omelette",
      emoji: "🧀",
      time: "12 min",
      servings: 2,
      ingredients: [
        { name: "Free-range eggs", qty: 4, unit: "pcs" },
        { name: "Aged cheddar", qty: 50, unit: "g" },
        { name: "Whole milk", qty: 0.05, unit: "L" },
      ],
      category: "Breakfast",
    },
    {
      id: "r5",
      name: "Spinach Chicken Stir",
      emoji: "🍗",
      time: "20 min",
      servings: 3,
      ingredients: [
        { name: "Chicken thighs", qty: 300, unit: "g" },
        { name: "Baby spinach", qty: 1, unit: "bag" },
      ],
      category: "Dinner",
    },
    {
      id: "r6",
      name: "Tomato Cheese Toast",
      emoji: "🍞",
      time: "7 min",
      servings: 2,
      ingredients: [
        { name: "Cherry tomatoes", qty: 0.5, unit: "pack" },
        { name: "Aged cheddar", qty: 40, unit: "g" },
      ],
      category: "Snack",
    },
  ];

  // Check how many ingredients you have enough of across all storages
  const getMatchingCount = (recipe: Recipe): number => {
    return recipe.ingredients.filter((ing) => {
      const lower = ing.name.toLowerCase();
      return (["fridge", "freezer", "pantry"] as StorageKey[]).some((storage) =>
        items[storage].some(
          (item) =>
            item.name.toLowerCase() === lower &&
            item.qty >= ing.qty
        )
      );
    }).length;
  };

  const canMakeRecipe = (recipe: Recipe): boolean => getMatchingCount(recipe) === recipe.ingredients.length;

  // Get recipes filtered and sorted by relevance (matching ingredients desc)
  const getFilteredRecipes = (): Recipe[] => {
    let filtered = [...allRecipes];

    if (recipeFilter === "canMake") {
      filtered = filtered.filter(canMakeRecipe);
    } else if (recipeFilter === "expiring") {
      // Prioritize recipes using items with low daysLeft
      const expiringNames = new Set(
        (["fridge", "freezer", "pantry"] as StorageKey[]).flatMap((s) =>
          items[s].filter((i) => i.daysLeft <= 3).map((i) => i.name.toLowerCase())
        )
      );
      filtered = filtered.filter((r) =>
        r.ingredients.some((ing) => expiringNames.has(ing.name.toLowerCase()))
      );
    }

    // Sort by how many ingredients you have (most relevant first)
    return filtered.sort((a, b) => getMatchingCount(b) - getMatchingCount(a));
  };

  const filteredRecipes = getFilteredRecipes();

  // "Used in Recipe" - deduct ingredients from pantry (any storage)
  const cookRecipe = (recipe: Recipe) => {
    const used: string[] = [];

    setItems((prev) => {
      const next = { ...prev };
      (Object.keys(next) as StorageKey[]).forEach((storage) => {
        next[storage] = next[storage]
          .map((item) => {
            const match = recipe.ingredients.find(
              (ing) => ing.name.toLowerCase() === item.name.toLowerCase()
            );
            if (match && item.qty >= match.qty) {
              const newQty = Math.max(0, item.qty - match.qty);
              if (newQty < item.qty) used.push(item.name);
              return { ...item, qty: newQty };
            }
            return item;
          })
          .filter((i) => i.qty > 0);
      });
      return next;
    });

    if (used.length > 0) {
      toast.success(`Used in ${recipe.name}`, {
        description: `Deducted: ${used.join(", ")}`,
      });
      // Auto switch to pantry to see updated stock
      setActiveView("pantry");
      setActive("fridge");
    } else {
      toast("Not enough ingredients", { description: "Some items are low." });
    }
  };

  return (
    <div className="relative min-h-screen pb-32 bg-background">
      <GlassHeader
        household="The Borg family"
        expiringSoon={headerAttention}
        totalItems={headerTotal}
        title={isListView ? "Shopping List" : isRecipesView ? "Recipes" : isFinancesView ? "Finances" : "Your Friġġ"}
        subtitle={isListView ? "Restock smart" : isRecipesView ? "Cook with what you have" : isFinancesView ? "July 2026" : "Good morning, Elena"}
        totalLabel={isFinancesView ? "receipts" : isRecipesView ? "ideas" : undefined}
        attentionLabel={isListView ? "checked" : isFinancesView ? "categories" : isRecipesView ? "ready" : undefined}
        attentionTone={isListView || isRecipesView || isFinancesView ? "calm" : undefined}
      />

      <main className="px-5 pt-5">
        {isListView ? (
          // === SHOPPING LIST VIEW - premium polished ===
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Shopping List</div>
                <div className="font-display text-[28px] leading-tight font-medium tracking-[-0.015em]">
                  {listCount} item{listCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportShoppingList}
                  className="rounded-2xl border px-3.5 py-2 text-sm font-semibold active:bg-secondary/60 transition"
                >
                  Share
                </button>
                <button
                  onClick={generateShoppingList}
                  className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
                >
                  Regenerate
                </button>
              </div>
            </div>

            {shoppingList.length === 0 ? (
              <div className="mt-12 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-secondary/70 text-3xl">🛒</div>
                <p className="mt-4 font-display text-xl text-foreground">Your list is empty</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-[240px] mx-auto">
                  Tap “Generate Shopping List” on the Pantry tab to intelligently fill it.
                </p>
                <button
                  onClick={() => setActiveView("pantry")}
                  className="mt-6 rounded-2xl border px-5 py-2 text-sm font-medium active:bg-secondary/60"
                >
                  Go to Pantry
                </button>
              </div>
            ) : (
              <>
                <ul className="space-y-3 mt-2">
                  {shoppingList.map((item) => (
                    <li
                      key={item.id}
                      className="elevated-card flex items-center gap-4 rounded-3xl px-4 py-4"
                    >
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                        {item.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[15px] tracking-[-0.01em]">{item.name}</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Buy {item.qty} {item.unit}
                        </p>
                      </div>

                      {/* Qty controls + checkbox */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-full bg-secondary/70 p-0.5">
                          <button
                            onClick={() => updateShoppingQty(item.id, -1)}
                            className="touch-target grid size-8 place-items-center rounded-full active:bg-background/60"
                          >
                            –
                          </button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => updateShoppingQty(item.id, +1)}
                            className="touch-target grid size-8 place-items-center rounded-full active:bg-background/60"
                          >
                            +
                          </button>
                        </div>

                        <button
                          onClick={() => toggleShoppingItem(item.id)}
                          className={`touch-target grid size-9 place-items-center rounded-2xl border text-lg transition ${
                            item.checked
                              ? "bg-brand text-brand-foreground border-brand"
                              : "bg-card border-border/60"
                          }`}
                          aria-label={item.checked ? "Uncheck" : "Check off"}
                        >
                          {item.checked ? "✓" : ""}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={markPurchased}
                    disabled={checkedCount === 0}
                    className="flex-1 rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] disabled:opacity-50 transition"
                  >
                    Mark {checkedCount || ""} as purchased
                  </button>
                  <button
                    onClick={() => removeFromShoppingList()}
                    className="rounded-3xl border px-4 py-3.5 text-sm font-medium active:bg-secondary/60"
                  >
                    Clear
                  </button>
                  <button
                    onClick={exportShoppingList}
                    className="rounded-3xl border px-4 py-3.5 text-sm font-medium active:bg-secondary/60"
                    aria-label="Share shopping list"
                  >
                    Share
                  </button>
                </div>
              </>
            )}
          </>
        ) : isRecipesView ? (
          // === RECIPES VIEW - suggestions, filters, use ingredients ===
          <div className="space-y-5">
            {/* Filter pills - premium segmented */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { key: "all", label: "All ideas" },
                { key: "canMake", label: "Can make now" },
                { key: "expiring", label: "Use expiring" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setRecipeFilter(f.key as "all" | "canMake" | "expiring")}
                  className={`rounded-2xl px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition active:scale-[0.985] ${
                    recipeFilter === f.key
                      ? "bg-brand text-brand-foreground"
                      : "bg-secondary/70 text-foreground/80 active:bg-secondary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredRecipes.length === 0 ? (
              <div className="mt-12 text-center">
                <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-secondary/70 text-3xl">🍳</div>
                <p className="mt-4 font-display text-xl text-foreground">No matches yet</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-[240px] mx-auto">
                  Add more items to your pantry or switch filters.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecipes.map((recipe) => {
                  const matchCount = getMatchingCount(recipe);
                  const totalIngs = recipe.ingredients.length;
                  const canMake = matchCount === totalIngs;

                  return (
                    <div key={recipe.id} className="elevated-card rounded-3xl px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                          {recipe.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-[15px] tracking-[-0.01em]">{recipe.name}</p>
                            <span className="text-[11px] text-muted-foreground">{recipe.time} · {recipe.servings} serv</span>
                          </div>

                          <div className="mt-2 text-[12px] text-muted-foreground">
                            {recipe.ingredients.map((ing, idx) => (
                              <span key={idx} className="mr-2">
                                {ing.qty} {ing.unit} {ing.name}
                                {idx < recipe.ingredients.length - 1 ? " · " : ""}
                              </span>
                            ))}
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                canMake
                                  ? "bg-[color-mix(in_oklab,var(--color-fresh)_15%,var(--color-card))] text-[var(--color-fresh)]"
                                  : "bg-secondary/60 text-foreground/70"
                              }`}
                            >
                              {canMake ? "Ready to cook" : `${matchCount}/${totalIngs} ingredients`}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{recipe.category}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => cookRecipe(recipe)}
                        className="mt-3 w-full rounded-3xl border py-2.5 text-sm font-semibold active:bg-secondary/60 transition disabled:opacity-50"
                        disabled={matchCount === 0}
                      >
                        {canMake ? "Cook this recipe" : "Use what I have"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-center text-[11px] text-muted-foreground pt-2">
              Recipes update automatically from your current pantry stock.
            </p>
          </div>
        ) : isFinancesView ? (
          // === FINANCIALS / MONEY VIEW - premium charts & insights ===
          <FinancialsScreen />
        ) : (
          // === PANTRY VIEW ===
          <>
            <div className="flex items-center justify-between mb-1">
              <StorageTabs active={active} onChange={setActive} />
            </div>

            {/* Prominent Generate Shopping List button - premium one-tap */}
            <button
              onClick={generateShoppingList}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-3xl bg-[color-mix(in_oklab,var(--color-brand)_8%,var(--color-card))] border border-[color-mix(in_oklab,var(--color-brand)_25%,transparent)] py-3 text-sm font-semibold text-foreground active:scale-[0.985] active:bg-[color-mix(in_oklab,var(--color-brand)_12%,var(--color-card))] transition"
            >
              🛒 Generate Shopping List
              {suggestedCount > 0 && (
                <span className="ml-1 rounded-full bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] px-2 py-px text-[11px] font-bold tabular-nums">
                  {suggestedCount}
                </span>
              )}
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

            {current.length === 0 ? (
              <EmptyState label={active} />
            ) : (
              <ul className="mt-6 space-y-4">
                {current.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    storage={active}
                    onInc={() => updateQty(item.id, +1)}
                    onDec={() => updateQty(item.id, -1)}
                    onUpdateMinStock={(newMin) => updateMinStock(item.id, newMin)}
                    onUpdateDaysLeft={(newDays) => updateDaysLeft(item.id, newDays)}
                    onOpenDetails={() => openItemDetails(item, active)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {!isListView && !isRecipesView && !isFinancesView && <ScanFab onClick={() => setScanOpen(true)} />}
      <BottomNav active={isListView ? "list" : isRecipesView ? "recipes" : isFinancesView ? "money" : "pantry"} onChange={(key) => {
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

      <ReceiptScanFlow
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onItemsAdded={addScannedItems}
      />

      {/* Item Details Drawer — full expiration tracking + move to freezer */}
      <Drawer open={!!detailsItem} onOpenChange={(open) => !open && closeItemDetails()}>
        <DrawerContent className="max-w-md mx-auto">
          {detailsItem && (() => {
            const { item, storage } = detailsItem;
            const isInFridge = storage === "fridge";
            const isInFreezer = storage === "freezer";

            return (
              <>
                <DrawerHeader className="text-left">
                  <div className="flex items-center gap-4">
                    <div className="grid size-16 place-items-center rounded-3xl bg-secondary text-4xl shadow-inner">
                      {item.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <DrawerTitle className="text-[21px] tracking-[-0.015em]">{item.name}</DrawerTitle>
                      <DrawerDescription>
                        In {storage === "fridge" ? "Fridge" : storage === "freezer" ? "Freezer" : "Pantry"} · {item.qty} {item.unit}
                      </DrawerDescription>
                    </div>
                  </div>
                </DrawerHeader>

                <div className="px-5 pb-2 space-y-6">
                  {/* Expiration editor */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Calendar className="size-4" />
                        Expiration
                      </div>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: "var(--color-foreground)" }}
                      >
                        {item.daysLeft} days left
                      </span>
                    </div>

                    <div className="flex items-center gap-3 rounded-3xl bg-secondary/70 p-1">
                      <button
                        onClick={() => {
                          const newVal = Math.max(0, item.daysLeft - 1);
                          // live update local + global
                          setDetailsItem((prev) => prev ? { ...prev, item: { ...prev.item, daysLeft: newVal } } : null);
                          updateDaysLeft(item.id, newVal);
                        }}
                        className="touch-target flex-1 grid h-12 place-items-center rounded-3xl text-xl font-medium active:bg-background/70"
                        aria-label="Decrease days left"
                      >
                        –
                      </button>

                      <div className="w-16 text-center text-3xl font-semibold tabular-nums text-foreground">
                        {item.daysLeft}
                      </div>

                      <button
                        onClick={() => {
                          const newVal = item.daysLeft + 1;
                          setDetailsItem((prev) => prev ? { ...prev, item: { ...prev.item, daysLeft: newVal } } : null);
                          updateDaysLeft(item.id, newVal);
                        }}
                        className="touch-target flex-1 grid h-12 place-items-center rounded-3xl bg-brand text-brand-foreground text-xl font-medium active:brightness-105"
                        aria-label="Increase days left"
                      >
                        +
                      </button>
                    </div>

                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Tap + / – to adjust. Freezer items last much longer.
                    </p>
                  </div>

                  {/* Min stock (also editable here for convenience) */}
                  <div>
                    <div className="text-sm font-semibold mb-2">Minimum Stock</div>
                    <div className="flex items-center rounded-3xl bg-secondary/70 p-1">
                      <button
                        onClick={() => {
                          const newMin = Math.max(0, item.minStock - 1);
                          setDetailsItem((prev) => prev ? { ...prev, item: { ...prev.item, minStock: newMin } } : null);
                          updateMinStock(item.id, newMin);
                        }}
                        className="touch-target flex-1 h-12 grid place-items-center rounded-3xl text-xl active:bg-background/70"
                      >
                        –
                      </button>
                      <div className="w-16 text-center text-2xl font-semibold tabular-nums">{item.minStock}</div>
                      <button
                        onClick={() => {
                          const newMin = item.minStock + 1;
                          setDetailsItem((prev) => prev ? { ...prev, item: { ...prev.item, minStock: newMin } } : null);
                          updateMinStock(item.id, newMin);
                        }}
                        className="touch-target flex-1 h-12 grid place-items-center rounded-3xl bg-brand text-brand-foreground text-xl active:brightness-105"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Move to Freezer action (prominent when applicable) */}
                  {isInFridge && (
                    <div className="pt-1">
                      <button
                        onClick={() => moveToFreezer(item.id, storage)}
                        className="w-full flex items-center justify-center gap-3 rounded-3xl bg-[color-mix(in_oklab,var(--color-fresh)_12%,var(--color-card))] border border-[color-mix(in_oklab,var(--color-fresh)_30%,transparent)] py-4 text-base font-semibold active:scale-[0.985] transition"
                      >
                        <Snowflake className="size-5" />
                        Move to Freezer
                        <span className="text-xs font-normal text-muted-foreground ml-1">+{getFreezerExtensionDays(item.name)} days</span>
                      </button>
                      <p className="text-center text-[11px] text-muted-foreground mt-2">
                        Automatically extends expiration using standard freezer guidelines.
                      </p>
                    </div>
                  )}

                  {isInFreezer && (
                    <div className="pt-1">
                      <button
                        onClick={() => moveItem(item.id, storage, "fridge")}
                        className="w-full flex items-center justify-center gap-3 rounded-3xl border py-4 text-base font-semibold active:bg-secondary/60 transition"
                      >
                        Move to Fridge <ArrowRight className="size-4" />
                      </button>
                      <p className="text-center text-[11px] text-muted-foreground mt-2">
                        Moving out of the freezer keeps current days remaining.
                      </p>
                    </div>
                  )}

                  {/* Quick move to other storage for completeness */}
                  {!isInFreezer && !isInFridge && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={() => moveItem(item.id, storage, "fridge")}
                        className="rounded-3xl border py-3 text-sm font-medium active:bg-secondary/60"
                      >
                        Move to Fridge
                      </button>
                      <button
                        onClick={() => moveItem(item.id, storage, "freezer")}
                        className="rounded-3xl border py-3 text-sm font-medium active:bg-secondary/60"
                      >
                        Move to Freezer
                      </button>
                    </div>
                  )}
                </div>

                <DrawerFooter className="pt-2 pb-6">
                  <DrawerClose asChild>
                    <button className="w-full rounded-3xl py-3.5 text-sm font-semibold border active:bg-secondary/60">
                      Done
                    </button>
                  </DrawerClose>
                </DrawerFooter>
              </>
            );
          })()}
        </DrawerContent>
      </Drawer>
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
        Tap the scan button to add items from a receipt.
      </p>
    </div>
  );
}