import { useState, useEffect } from "react";
import { GlassHeader } from "./GlassHeader";
import { StorageTabs, type StorageKey } from "./StorageTabs";
import { ItemCard, type PantryItem } from "./ItemCard";
import { BottomNav } from "./BottomNav";
import { ScanFab } from "./ScanFab";
import { ReceiptScanFlow, type DetectedItem } from "./ReceiptScanFlow";

const SEED: Record<StorageKey, PantryItem[]> = {
  fridge: [
    { id: "1", name: "Whole milk", qty: 2, unit: "L", emoji: "🥛", daysLeft: 4 },
    { id: "2", name: "Free-range eggs", qty: 8, unit: "pcs", emoji: "🥚", daysLeft: 11 },
    { id: "3", name: "Greek yogurt", qty: 1, unit: "tub", emoji: "🥣", daysLeft: 2 },
    { id: "4", name: "Cherry tomatoes", qty: 1, unit: "pack", emoji: "🍅", daysLeft: 5 },
    { id: "5", name: "Aged cheddar", qty: 220, unit: "g", emoji: "🧀", daysLeft: 18 },
    { id: "6", name: "Baby spinach", qty: 1, unit: "bag", emoji: "🥬", daysLeft: 1 },
  ],
  freezer: [],
  pantry: [],
};

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
  const [items, setItems] = useState(SEED);
  const [scanOpen, setScanOpen] = useState(false);
  const [addedBanner, setAddedBanner] = useState<{ count: number; message: string } | null>(null);

  const current = items[active];

  const update = (id: string, delta: number) => {
    setItems((prev) => ({
      ...prev,
      [active]: prev[active]
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    }));
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

  return (
    <div className="relative min-h-screen pb-32 bg-background">
      <GlassHeader household="The Borg family" expiringSoon={expiringSoon} totalItems={current.length} />

      <main className="px-5 pt-5">
        <StorageTabs active={active} onChange={setActive} />

        {/* Silent success + motivational banner (only when items were added) */}
        {addedBanner && (
          <div
            onClick={dismissBanner}
            className="mt-4 mb-1 flex items-center gap-3 rounded-3xl border border-[color-mix(in_oklab,var(--color-fresh)_25%,transparent)] bg-[color-mix(in_oklab,var(--color-fresh)_8%,var(--color-card))] px-4 py-3 text-sm cursor-pointer active:opacity-90 transition"
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
                onInc={() => update(item.id, +1)}
                onDec={() => update(item.id, -1)}
              />
            ))}
          </ul>
        )}
      </main>

      <ScanFab onClick={() => setScanOpen(true)} />
      <BottomNav />

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