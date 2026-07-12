import { useState, useEffect } from "react";
import { GlassHeader } from "./GlassHeader";
import { StorageTabs, type StorageKey } from "./StorageTabs";
import { ItemCard, type PantryItem } from "./ItemCard";
import { BottomNav } from "./BottomNav";
import { ScanFab } from "./ScanFab";
import { ReceiptScanFlow, type DetectedItem } from "./ReceiptScanFlow";

const SEED: Record<StorageKey, PantryItem[]> = {
  fridge: [
    { id: "1", name: "Whole milk", qty: 2, unit: "L", emoji: "🥛", daysLeft: 4, minStock: 2 },
    { id: "2", name: "Free-range eggs", qty: 8, unit: "pcs", emoji: "🥚", daysLeft: 11, minStock: 6 },
    { id: "3", name: "Greek yogurt", qty: 1, unit: "tub", emoji: "🥣", daysLeft: 2, minStock: 2 },
    { id: "4", name: "Cherry tomatoes", qty: 1, unit: "pack", emoji: "🍅", daysLeft: 5, minStock: 2 },
    { id: "5", name: "Aged cheddar", qty: 220, unit: "g", emoji: "🧀", daysLeft: 18, minStock: 150 },
    { id: "6", name: "Baby spinach", qty: 1, unit: "bag", emoji: "🥬", daysLeft: 1, minStock: 1 },
  ],
  freezer: [],
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

// Reasonable default shelf life for newly scanned items
function getDefaultDaysLeft(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("milk") || lower.includes("yogurt") || lower.includes("spinach") || lower.includes("herb") || lower.includes("basil")) return 3 + Math.floor(Math.random() * 3);
  if (lower.includes("egg")) return 10 + Math.floor(Math.random() * 4);
  if (lower.includes("frozen") || lower.includes("chicken")) return 45 + Math.floor(Math.random() * 20);
  if (lower.includes("bread") || lower.includes("pasta") || lower.includes("oil")) return 25 + Math.floor(Math.random() * 10);
  if (lower.includes("tomato") || lower.includes("avocado")) return 4 + Math.floor(Math.random() * 3);
  if (lower.includes("cheese")) return 16 + Math.floor(Math.random() * 6);
  return 7 + Math.floor(Math.random() * 5);
}

export function PantryScreen() {
  const [active, setActive] = useState<StorageKey>("fridge");
  const [activeView, setActiveView] = useState<"pantry" | "list">("pantry");
  const [items, setItems] = useState(SEED);
  const [scanOpen, setScanOpen] = useState(false);
  const [addedBanner, setAddedBanner] = useState<{ count: number; message: string } | null>(null);

  // Shopping list state (for the List tab)
  const [shoppingList, setShoppingList] = useState<Array<{
    id: string;
    name: string;
    qty: number;
    unit: string;
    emoji: string;
    checked: boolean;
  }>>([]);

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

  // One-tap generate shopping list: adds items below min stock (or running low)
  const generateShoppingList = () => {
    const needed: Array<{
      id: string;
      name: string;
      qty: number;
      unit: string;
      emoji: string;
      checked: boolean;
    }> = [];

    (["fridge", "freezer", "pantry"] as StorageKey[]).forEach((storage) => {
      items[storage].forEach((item) => {
        const min = item.minStock ?? 2;
        const isBelowMin = item.qty < min;
        const isRunningLow = item.daysLeft <= 2 && item.qty <= Math.max(1, Math.floor(min / 2));

        if (isBelowMin || isRunningLow) {
          const buyQty = Math.max(min - item.qty, 1);
          // Avoid duplicates if already in list
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

    if (needed.length > 0) {
      setShoppingList(needed);
      setActiveView("list"); // Jump to the list view
    } else {
      // Show friendly message
      setAddedBanner({ count: 0, message: "Everything looks well stocked!" });
      setTimeout(() => setAddedBanner(null), 2800);
    }
  };

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
        daysLeft: getDefaultDaysLeft(s.name),
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
  const listCount = shoppingList.length;
  const checkedCount = shoppingList.filter((i) => i.checked).length;

  // For list view we show different header stats
  const headerTotal = isListView ? listCount : current.length;
  const headerExpiring = isListView ? checkedCount : expiringSoon;

  // Recalculate low stock count across all for potential future use
  const lowStockCount = (["fridge", "freezer", "pantry"] as StorageKey[]).reduce((sum, s) => {
    return sum + items[s].filter((i) => (i.minStock ?? 2) > i.qty).length;
  }, 0);

  return (
    <div className="relative min-h-screen pb-32 bg-background">
      <GlassHeader
        household="The Borg family"
        expiringSoon={headerExpiring}
        totalItems={headerTotal}
        title={isListView ? "Shopping List" : "Your Friġġ"}
        subtitle={isListView ? "Restock smart" : "Good morning, Elena"}
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
              <button
                onClick={generateShoppingList}
                className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition"
              >
                Regenerate
              </button>
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
                    className="rounded-3xl border px-5 py-3.5 text-sm font-medium active:bg-secondary/60"
                  >
                    Clear checked
                  </button>
                </div>
              </>
            )}
          </>
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
                    onInc={() => updateQty(item.id, +1)}
                    onDec={() => updateQty(item.id, -1)}
                    onUpdateMinStock={(newMin) => updateMinStock(item.id, newMin)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {!isListView && <ScanFab onClick={() => setScanOpen(true)} />}
      <BottomNav active={isListView ? "list" : "pantry"} onChange={(key) => {
        if (key === "pantry" || key === "list") {
          setActiveView(key as "pantry" | "list");
          if (key === "pantry") setActive("fridge"); // reset to fridge when going back
        } else {
          // Placeholder for future tabs
          setAddedBanner({ count: 0, message: "Coming soon" });
          setTimeout(() => setAddedBanner(null), 1500);
        }
      }} />

      <ReceiptScanFlow
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onItemsAdded={addScannedItems}
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
        Tap the scan button to add items from a receipt.
      </p>
    </div>
  );
}