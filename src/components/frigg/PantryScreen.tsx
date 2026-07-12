import { useState } from "react";
import { GlassHeader } from "./GlassHeader";
import { StorageTabs, type StorageKey } from "./StorageTabs";
import { ItemCard, type PantryItem } from "./ItemCard";
import { BottomNav } from "./BottomNav";
import { ScanFab } from "./ScanFab";

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

export function PantryScreen() {
  const [active, setActive] = useState<StorageKey>("fridge");
  const [items, setItems] = useState(SEED);

  const current = items[active];

  const update = (id: string, delta: number) => {
    setItems((prev) => ({
      ...prev,
      [active]: prev[active]
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    }));
  };

  const expiringSoon = current.filter((i) => i.daysLeft <= 3).length;

  return (
    <div className="relative min-h-screen pb-32">
      <GlassHeader household="The Borg family" expiringSoon={expiringSoon} totalItems={current.length} />

      <main className="px-5 pt-4">
        <StorageTabs active={active} onChange={setActive} />

        {current.length === 0 ? (
          <EmptyState label={active} />
        ) : (
          <ul className="mt-5 space-y-3">
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

      <ScanFab />
      <BottomNav />
    </div>
  );
}

function EmptyState({ label }: { label: StorageKey }) {
  return (
    <div className="mt-16 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-secondary text-3xl">
        {label === "freezer" ? "🧊" : "🫙"}
      </div>
      <p className="mt-4 font-display text-xl text-foreground">Nothing here yet</p>
      <p className="mt-1 text-sm text-muted-foreground">Scan a receipt to fill your {label}.</p>
    </div>
  );
}