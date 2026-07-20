import type { OcrProvider } from "@/platform/types";
import type { ScannedItemInput, StorageKey } from "@/types/pantry";

const MOCK_BATCHES: ScannedItemInput[][] = [
  [
    { name: "Whole milk", qty: 2, unit: "L", emoji: "🥛", storage: "fridge" },
    { name: "Free-range eggs", qty: 12, unit: "pcs", emoji: "🥚", storage: "fridge" },
    { name: "Greek yogurt", qty: 2, unit: "tub", emoji: "🥣", storage: "fridge" },
    { name: "Baby spinach", qty: 1, unit: "bag", emoji: "🥬", storage: "fridge" },
    { name: "Avocados", qty: 5, unit: "pcs", emoji: "🥑", storage: "fridge" },
  ],
  [
    { name: "Frozen berries", qty: 2, unit: "bags", emoji: "🫐", storage: "freezer" },
    { name: "Chicken thighs", qty: 800, unit: "g", emoji: "🍗", storage: "freezer" },
    { name: "Aged cheddar", qty: 300, unit: "g", emoji: "🧀", storage: "fridge" },
    { name: "Organic bread", qty: 1, unit: "loaf", emoji: "🍞", storage: "pantry" },
  ],
  [
    { name: "Cherry tomatoes", qty: 2, unit: "packs", emoji: "🍅", storage: "fridge" },
    { name: "Olive oil", qty: 1, unit: "bottle", emoji: "🫒", storage: "pantry" },
    { name: "Pasta", qty: 2, unit: "packs", emoji: "🍝", storage: "pantry" },
    { name: "Fresh basil", qty: 1, unit: "bunch", emoji: "🌿", storage: "fridge" },
  ],
];

/**
 * Demo OCR (D-2 deferred): ignores image pixels, returns sample line items.
 * Swap for a live provider that calls a vision API.
 */
export const demoOcrProvider: OcrProvider = {
  id: "demo-ocr",
  mode: "demo",
  supportsLiveCamera() {
    return false;
  },
  async detectFromImage(_imageDataUrl: string | null) {
    // Small delay so UI processing state is visible
    await new Promise((r) => setTimeout(r, 80));
    const batch = MOCK_BATCHES[Math.floor(Math.random() * MOCK_BATCHES.length)];
    return batch.map((row) => ({ ...row, storage: row.storage as StorageKey }));
  },
};
