"use client";

import { useState } from "react";
import { Camera, Image as ImageIcon, X, Loader2, Check, Trash2 } from "lucide-react";
import { StorageTabs } from "./StorageTabs";
import type { StorageKey, DetectedItem } from "@/types/pantry";
import { toast } from "sonner";

export type { DetectedItem };

interface ReceiptScanFlowProps {
  open: boolean;
  onClose: () => void;
  onItemsAdded: (items: Array<Omit<DetectedItem, "confidence" | "id">>, options?: { silent?: boolean }) => void;
}

// Realistic mock receipt results
const MOCK_RECEIPTS: Array<Partial<DetectedItem>[]> = [
  [
    { name: "Whole milk", qty: 2, unit: "L", storage: "fridge", confidence: 0.96 },
    { name: "Free-range eggs", qty: 12, unit: "pcs", storage: "fridge", confidence: 0.94 },
    { name: "Greek yogurt", qty: 3, unit: "tub", storage: "fridge", confidence: 0.91 },
    { name: "Baby spinach", qty: 1, unit: "bag", storage: "fridge", confidence: 0.89 },
    { name: "Avocados", qty: 5, unit: "pcs", storage: "fridge", confidence: 0.64 }, // ambiguous
  ],
  [
    { name: "Frozen berries", qty: 2, unit: "bags", storage: "freezer", confidence: 0.95 },
    { name: "Chicken thighs", qty: 800, unit: "g", storage: "freezer", confidence: 0.88 },
    { name: "Aged cheddar", qty: 300, unit: "g", storage: "fridge", confidence: 0.93 },
    { name: "Organic bread", qty: 1, unit: "loaf", storage: "pantry", confidence: 0.71 }, // ambiguous
  ],
  [
    { name: "Cherry tomatoes", qty: 2, unit: "packs", storage: "fridge", confidence: 0.97 },
    { name: "Olive oil", qty: 1, unit: "bottle", storage: "pantry", confidence: 0.92 },
    { name: "Pasta", qty: 2, unit: "packs", storage: "pantry", confidence: 0.9 },
    { name: "Fresh basil", qty: 1, unit: "bunch", storage: "fridge", confidence: 0.58 }, // ambiguous
  ],
];

const EMOJI_MAP: Record<string, string> = {
  "Whole milk": "🥛",
  "Free-range eggs": "🥚",
  "Greek yogurt": "🥣",
  "Baby spinach": "🥬",
  Avocados: "🥑",
  "Frozen berries": "🫐",
  "Chicken thighs": "🍗",
  "Aged cheddar": "🧀",
  "Organic bread": "🍞",
  "Cherry tomatoes": "🍅",
  "Olive oil": "🫒",
  Pasta: "🍝",
  "Fresh basil": "🌿",
};

function getEmoji(name: string): string {
  return EMOJI_MAP[name] || "🛒";
}

function generateMockDetections(): DetectedItem[] {
  const base = MOCK_RECEIPTS[Math.floor(Math.random() * MOCK_RECEIPTS.length)];
  return base.map((item, index) => ({
    id: `det-${Date.now()}-${index}`,
    name: item.name!,
    qty: item.qty!,
    unit: item.unit!,
    emoji: getEmoji(item.name!),
    storage: item.storage as StorageKey,
    confidence: item.confidence!,
  }));
}

function formatStorageLabel(storage: StorageKey) {
  return storage === "fridge" ? "Fridge" : storage === "freezer" ? "Freezer" : "Pantry";
}

export function ReceiptScanFlow({ open, onClose, onItemsAdded }: ReceiptScanFlowProps) {
  const [step, setStep] = useState<"capture" | "processing" | "review" | "prompt">("capture");
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [reviewItems, setReviewItems] = useState<DetectedItem[]>([]);
  const [previewReceipt, setPreviewReceipt] = useState(false);
  const [addedCountForPrompt, setAddedCountForPrompt] = useState(0);

  if (!open) return null;

  const resetFlow = () => {
    setStep("capture");
    setDetected([]);
    setReviewItems([]);
    setPreviewReceipt(false);
    setAddedCountForPrompt(0);
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const startProcessing = () => {
    setPreviewReceipt(true);
    setStep("processing");

    // Realistic 600-800ms processing
    const delay = 650 + Math.random() * 150;

    setTimeout(() => {
      const results = generateMockDetections();
      setDetected(results);

      // Split: high confidence go straight in, low need review
      const autoItems = results.filter((i) => i.confidence >= 0.8);
      const ambiguous = results.filter((i) => i.confidence < 0.8);

      // Immediately add the clear ones (silently for new flow)
      if (autoItems.length > 0) {
        onItemsAdded(
          autoItems.map(({ id, confidence, ...rest }) => rest),
          { silent: true }
        );
      }

      if (ambiguous.length > 0) {
        setReviewItems(ambiguous);
        setStep("review");
      } else {
        // High confidence — silently added, show clean toast then optional prompt
        const count = autoItems.length;
        toast.success("Pantry Updated");
        setAddedCountForPrompt(count);
        setStep("prompt");
      }
    }, delay);
  };

  const handleTakePhoto = () => {
    startProcessing();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // We don't actually read the image for the demo
      startProcessing();
    }
    // Reset input so same file can be chosen again
    e.target.value = "";
  };

  // ---- Review step handlers ----
  const updateReviewItem = (id: string, updates: Partial<DetectedItem>) => {
    setReviewItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeReviewItem = (id: string) => {
    setReviewItems((prev) => prev.filter((item) => item.id !== id));
  };

  const confirmReview = () => {
    if (reviewItems.length === 0) {
      handleClose();
      return;
    }

    const toAdd = reviewItems.map(({ id, confidence, ...rest }) => rest);
    onItemsAdded(toAdd, { silent: true });

    const count = toAdd.length;
    toast.success("Pantry Updated");

    setAddedCountForPrompt(count);
    setStep("prompt");
  };

  // ---- Post-add expiration photo prompt handlers (optional) ----
  const handleSkipExpirationPrompt = () => {
    setAddedCountForPrompt(0);
    handleClose();
  };

  const handleTakePhotosForExpiration = () => {
    setAddedCountForPrompt(0);
    toast.success("Photos captured", {
      description: "Expiration dates & quantities improved.",
      duration: 2500,
    });
    handleClose();
  };

  // ---- UI ----
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex-1 flex flex-col bg-background rounded-t-3xl mt-auto max-h-[94dvh] overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/60">
          <div className="font-semibold text-lg tracking-tight">
            {step === "prompt" ? "Update complete" : "Scan receipt"}
          </div>
          <button
            onClick={handleClose}
            className="touch-target grid size-10 place-items-center rounded-full bg-secondary/70 text-foreground/70 active:bg-secondary"
            aria-label="Close scanner"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {step === "capture" && (
            <div className="flex flex-col h-full">
              {/* Camera viewfinder simulation */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-full max-w-[320px] aspect-[3/4] rounded-3xl border border-border/60 bg-secondary/30 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="text-center px-6">
                    <div className="mx-auto mb-4 grid size-20 place-items-center rounded-2xl bg-background/70 text-4xl shadow-inner">
                      📄
                    </div>
                    <p className="text-base font-medium text-foreground">Point your camera at the receipt</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Make sure the text is clear and well lit
                    </p>
                  </div>

                  {/* Subtle scan frame */}
                  <div className="absolute inset-6 rounded-2xl border border-white/30" />
                </div>
              </div>

              {/* Actions — large thumb friendly */}
              <div className="mt-auto space-y-3 pt-6">
                <button
                  onClick={handleTakePhoto}
                  className="w-full flex items-center justify-center gap-3 rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground active:scale-[0.985] active:brightness-105 transition"
                >
                  <Camera className="size-6" />
                  Take Photo
                </button>

                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                  />
                  <div className="w-full flex items-center justify-center gap-3 rounded-3xl border border-border bg-card py-4 text-base font-semibold active:bg-secondary/60 active:scale-[0.985] transition cursor-pointer">
                    <ImageIcon className="size-5" />
                    Choose from Library
                  </div>
                </label>

                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  We’ll detect items and add them automatically
                </p>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center min-h-[420px] text-center pt-8">
              <div className="mb-8">
                <div className="mx-auto mb-6 grid size-20 place-items-center rounded-3xl bg-secondary/70">
                  <Loader2 className="size-10 animate-spin text-brand" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xl font-semibold tracking-tight">Analyzing receipt…</p>
                  <p className="text-sm text-muted-foreground">This only takes a moment</p>
                </div>
              </div>

              {/* Mini receipt preview */}
              {previewReceipt && (
                <div className="w-full max-w-[280px] rounded-2xl border bg-card p-4 text-left text-xs font-mono text-foreground/80 shadow-sm">
                  <div className="mb-2 text-center text-[10px] tracking-[2px] text-muted-foreground">RECEIPT</div>
                  <div className="space-y-px opacity-75">
                    <div>WHOLE MILK 2L ................ 5.98</div>
                    <div>EGGS FREE RANGE .............. 4.49</div>
                    <div>YOGURT GREEK 3PK ............. 6.29</div>
                    <div className="pt-1 text-[10px] text-muted-foreground">+ 2 more items</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "review" && (
            <div>
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold tracking-tight">Review items</div>
                  <div className="rounded-full bg-amber-100 px-2.5 py-px text-[10px] font-medium text-amber-700">Needs confirmation</div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  A few items weren’t 100% clear. Adjust if needed.
                </p>
              </div>

              <div className="space-y-3 pb-4">
                {reviewItems.map((item) => (
                  <div key={item.id} className="elevated-card rounded-3xl p-4">
                    <div className="flex items-start gap-4">
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                        {item.emoji}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Name (editable) */}
                        <input
                          value={item.name}
                          onChange={(e) => updateReviewItem(item.id, { name: e.target.value })}
                          className="w-full bg-transparent text-[15px] font-semibold tracking-[-0.01em] outline-none border-b border-transparent focus:border-border/50 pb-0.5"
                        />

                        {/* Qty + unit + storage controls */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                          {/* Qty stepper (small) */}
                          <div className="flex items-center gap-1 rounded-full bg-secondary/70 p-0.5">
                            <button
                              onClick={() =>
                                updateReviewItem(item.id, { qty: Math.max(1, item.qty - 1) })
                              }
                              className="touch-target grid size-8 place-items-center rounded-full active:bg-background/70"
                            >
                              –
                            </button>
                            <span className="w-7 text-center text-sm font-semibold tabular-nums">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => updateReviewItem(item.id, { qty: item.qty + 1 })}
                              className="touch-target grid size-8 place-items-center rounded-full active:bg-background/70"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-xs text-muted-foreground">{item.unit}</div>

                          {/* Storage selector — premium segmented */}
                          <div className="flex-1 min-w-[148px]">
                            <div className="inline-flex rounded-2xl bg-secondary/70 p-0.5 text-xs font-semibold">
                              {(["fridge", "freezer", "pantry"] as StorageKey[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => updateReviewItem(item.id, { storage: s })}
                                  className={`rounded-[10px] px-3 py-1 transition ${
                                    item.storage === s
                                      ? "bg-card text-foreground shadow-sm"
                                      : "text-muted-foreground active:bg-card/50"
                                  }`}
                                >
                                  {formatStorageLabel(s)}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => removeReviewItem(item.id)}
                            className="ml-auto touch-target grid size-9 place-items-center text-muted-foreground hover:text-destructive active:bg-secondary/60 rounded-full"
                            aria-label="Remove item"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "prompt" && (
            <div className="flex flex-col min-h-[320px] px-5 pt-6">
              {/* Compact success message */}
              <div className="text-center mb-6">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--color-fresh)_12%,var(--color-card))] text-3xl">
                  ✓
                </div>
                <p className="font-semibold tracking-tight">Added to your pantry</p>
                <p className="text-sm text-muted-foreground mt-0.5">{addedCountForPrompt} item{addedCountForPrompt === 1 ? "" : "s"} saved</p>
              </div>

              {/* Less intrusive, smaller, dismissible banner for optional photo */}
              <div className="mt-auto rounded-3xl border bg-secondary/60 px-4 py-3.5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-xl leading-none mt-0.5">📸</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold tracking-[-0.01em]">Add expiration photos?</div>
                    <div className="text-xs text-muted-foreground mt-0.5 pr-2">
                      Optional — improves tracking for these items.
                    </div>
                  </div>
                  <button
                    onClick={handleSkipExpirationPrompt}
                    className="touch-target -mr-1 -mt-1 grid size-8 place-items-center rounded-full text-muted-foreground/70 active:text-foreground active:bg-background/60"
                    aria-label="Dismiss photo prompt"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleTakePhotosForExpiration}
                    className="flex-1 rounded-2xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] active:brightness-105 transition"
                  >
                    Take photos
                  </button>
                  <button
                    onClick={handleSkipExpirationPrompt}
                    className="flex-1 rounded-2xl border py-2.5 text-sm font-medium active:bg-background/60 transition"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        {step === "review" && (
          <div className="border-t border-border/60 bg-background px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              onClick={confirmReview}
              disabled={reviewItems.length === 0}
              className="w-full rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground active:scale-[0.985] disabled:opacity-60 transition disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              <Check className="size-5" />
              Add {reviewItems.length} item{reviewItems.length === 1 ? "" : "s"} to pantry
            </button>
            <button
              onClick={handleClose}
              className="mt-2.5 w-full py-2 text-sm font-medium text-muted-foreground active:text-foreground"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === "capture" && (
          <div className="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
            <button
              onClick={handleClose}
              className="text-sm font-medium text-muted-foreground py-2 active:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
