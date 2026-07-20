import type { OcrProvider } from "@/platform/types";
import type { ScannedItemInput, StorageKey } from "@/types/pantry";

const MOCK_BATCHES: ScannedItemInput[][] = [
  [
    { name: "Whole milk", qty: 2, unit: "L", emoji: "🥛", storage: "fridge" },
    { name: "Free-range eggs", qty: 12, unit: "pcs", emoji: "🥚", storage: "fridge" },
    { name: "Greek yogurt", qty: 2, unit: "tub", emoji: "🥣", storage: "fridge" },
  ],
  [
    { name: "Chicken thighs", qty: 600, unit: "g", emoji: "🍗", storage: "freezer" },
    { name: "Cherry tomatoes", qty: 1, unit: "pack", emoji: "🍅", storage: "fridge" },
    { name: "Aged cheddar", qty: 220, unit: "g", emoji: "🧀", storage: "fridge" },
  ],
  [
    { name: "Olive oil", qty: 1, unit: "bottle", emoji: "🫒", storage: "pantry" },
    { name: "Pasta", qty: 2, unit: "packs", emoji: "🍝", storage: "pantry" },
    { name: "Baby spinach", qty: 1, unit: "bag", emoji: "🥬", storage: "fridge" },
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
    const batch = MOCK_BATCHES[Math.floor(Math.random() * MOCK_BATCHES.length)];
    return batch.map((row) => ({ ...row, storage: row.storage as StorageKey }));
  },
};
