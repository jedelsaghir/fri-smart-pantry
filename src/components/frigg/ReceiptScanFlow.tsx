"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, X, Loader2, Check, Trash2 } from "lucide-react";
import type { StorageKey, DetectedItem, StoredReceipt } from "@/types/pantry";
import { toast } from "sonner";
import { buildReceiptFromScan, readFileAsDataUrl } from "@/lib/receipts";
import { captureVideoFrame } from "@/lib/ocr-image";
import { getPlatform } from "@/platform";
import type { OcrDetectResult } from "@/platform/types";

export type { DetectedItem };

interface ReceiptScanFlowProps {
  open: boolean;
  onClose: () => void;
  onItemsAdded: (
    items: Array<Omit<DetectedItem, "confidence" | "id">>,
    options?: { silent?: boolean }
  ) => void;
  /** Persist full receipt (photo + line items) for Finances history */
  onReceiptSaved?: (receipt: StoredReceipt) => void;
}

function formatStorageLabel(storage: StorageKey) {
  return storage === "fridge" ? "Fridge" : storage === "freezer" ? "Freezer" : "Pantry";
}

export function ReceiptScanFlow({
  open,
  onClose,
  onItemsAdded,
  onReceiptSaved,
}: ReceiptScanFlowProps) {
  const [step, setStep] = useState<"capture" | "processing" | "review" | "prompt" | "error">(
    "capture"
  );
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [reviewItems, setReviewItems] = useState<DetectedItem[]>([]);
  const [addedCountForPrompt, setAddedCountForPrompt] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [pendingRemoveReviewId, setPendingRemoveReviewId] = useState<string | null>(null);
  const [ocrConfigured, setOcrConfigured] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const receiptSavedRef = useRef(false);
  const ocrMetaRef = useRef<{ store?: string | null; total?: number | null; currency?: string }>(
    {}
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ok = await getPlatform().ocr.isConfigured();
        if (!cancelled) setOcrConfigured(ok);
      } catch {
        if (!cancelled) setOcrConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Attach MediaStream after <video> mounts
  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [cameraOn]);

  if (!open) return null;

  const resetFlow = () => {
    stopCamera();
    setStep("capture");
    setDetected([]);
    setReviewItems([]);
    setAddedCountForPrompt(0);
    setCapturedImage(null);
    setErrorMessage(null);
    setCameraError(null);
    receiptSavedRef.current = false;
    ocrMetaRef.current = {};
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const saveReceiptSnapshot = (allItems: DetectedItem[], imageDataUrl: string | null) => {
    if (receiptSavedRef.current || allItems.length === 0) return;
    receiptSavedRef.current = true;
    const receipt = buildReceiptFromScan({
      items: allItems.map(({ name, qty, unit, emoji, storage, price }) => ({
        name,
        qty,
        unit,
        emoji,
        storage,
        price,
      })),
      imageDataUrl,
      store: ocrMetaRef.current.store,
      total: ocrMetaRef.current.total,
      currency: ocrMetaRef.current.currency,
    });
    onReceiptSaved?.(receipt);
  };

  const mapOcrToDetected = (result: OcrDetectResult): DetectedItem[] => {
    ocrMetaRef.current = {
      store: result.store,
      total: result.total,
      currency: result.currency,
    };
    return result.items.map((row, index) => ({
      id: `det-${Date.now()}-${index}`,
      name: row.name,
      qty: row.qty,
      unit: row.unit,
      emoji: row.emoji || "🛒",
      storage: row.storage || "fridge",
      confidence: typeof row.confidence === "number" ? row.confidence : 0.75,
      price: row.price,
    }));
  };

  const startProcessing = async (imageDataUrl: string) => {
    stopCamera();
    setCapturedImage(imageDataUrl);
    setStep("processing");
    setErrorMessage(null);
    receiptSavedRef.current = false;

    try {
      const platform = getPlatform();
      const result = await platform.ocr.detectFromImage(imageDataUrl);

      if (!result.ok || result.items.length === 0) {
        setErrorMessage(
          result.reason ||
            (result.mode === "unavailable"
              ? "OCR is not configured on the server (set XAI_API_KEY)."
              : "No items could be read from this image. Try a clearer photo.")
        );
        setDetected([]);
        setReviewItems([]);
        setStep("error");
        return;
      }

      const results = mapOcrToDetected(result);
      setDetected(results);

      const autoItems = results.filter((i) => i.confidence >= 0.8);
      const ambiguous = results.filter((i) => i.confidence < 0.8);

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
        saveReceiptSnapshot(results, imageDataUrl);
        toast.success("Pantry Updated", {
          description: result.store
            ? `Saved receipt from ${result.store}`
            : "Receipt saved in Finances",
        });
        setAddedCountForPrompt(autoItems.length);
        setStep("prompt");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "OCR failed");
      setStep("error");
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!getPlatform().ocr.supportsLiveCamera()) {
      setCameraError("Camera not available in this browser. Use Choose from Library instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1920 },
        },
      });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      setCameraError("Camera permission denied or unavailable. You can still pick a photo from your library.");
      setCameraOn(false);
    }
  };

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      void startCamera();
      return;
    }
    const frame = captureVideoFrame(video);
    if (!frame) {
      toast.error("Could not capture frame");
      return;
    }
    void startProcessing(frame);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await startProcessing(dataUrl);
      } catch {
        setErrorMessage("Could not read that image file.");
        setStep("error");
      }
    }
    e.target.value = "";
  };

  const updateReviewItem = (id: string, updates: Partial<DetectedItem>) => {
    setReviewItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeReviewItem = (id: string) => {
    setPendingRemoveReviewId(id);
  };

  const confirmRemoveReviewItem = () => {
    if (!pendingRemoveReviewId) return;
    setReviewItems((prev) => prev.filter((item) => item.id !== pendingRemoveReviewId));
    setPendingRemoveReviewId(null);
  };

  const confirmReview = () => {
    if (reviewItems.length === 0) {
      const autoOnly = detected.filter((i) => i.confidence >= 0.8);
      if (autoOnly.length > 0) saveReceiptSnapshot(autoOnly, capturedImage);
      handleClose();
      return;
    }

    const toAdd = reviewItems.map(({ id, confidence, ...rest }) => rest);
    onItemsAdded(toAdd, { silent: true });

    const allForReceipt = [...detected.filter((i) => i.confidence >= 0.8), ...reviewItems];
    saveReceiptSnapshot(allForReceipt, capturedImage);

    toast.success("Pantry Updated", {
      description: "Receipt saved in Finances",
    });

    setAddedCountForPrompt(toAdd.length);
    setStep("prompt");
  };

  const handleSkipExpirationPrompt = () => {
    setAddedCountForPrompt(0);
    handleClose();
  };

  const handleTakePhotosForExpiration = () => {
    setAddedCountForPrompt(0);
    toast.message("Not available yet", {
      description: "Per-item expiration photos are still optional polish.",
      duration: 3200,
    });
    handleClose();
  };

  const pendingRemoveName = reviewItems.find((i) => i.id === pendingRemoveReviewId)?.name;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex-1 flex flex-col bg-background rounded-t-3xl mt-auto max-h-[94dvh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/60">
          <div className="font-semibold text-lg tracking-tight">
            {step === "prompt" ? "Update complete" : "Scan receipt"}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="touch-target grid size-10 place-items-center rounded-full bg-secondary/70 text-foreground/70 active:bg-secondary"
            aria-label="Close scanner"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6">
          {step === "capture" && (
            <div className="flex flex-col h-full">
              {ocrConfigured === false && (
                <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] leading-snug text-foreground/90">
                  <span className="font-semibold">OCR not configured.</span> Set{" "}
                  <code className="text-[11px]">XAI_API_KEY</code> on the server to read real
                  receipts. Photos still open the flow so you can see the error path.
                </div>
              )}
              {ocrConfigured === true && (
                <div className="mb-4 rounded-2xl border border-[color-mix(in_oklab,var(--color-fresh)_35%,transparent)] bg-[color-mix(in_oklab,var(--color-fresh)_10%,transparent)] px-3.5 py-2.5 text-[12px] leading-snug text-foreground/90">
                  <span className="font-semibold">Live OCR ready.</span> Your photo is sent to the
                  server vision model — no sample groceries.
                </div>
              )}

              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-[320px] aspect-[3/4] rounded-3xl border border-border/60 bg-secondary/30 overflow-hidden">
                  {cameraOn ? (
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                      <div className="mx-auto mb-4 grid size-20 place-items-center rounded-2xl bg-background/70 text-4xl shadow-inner">
                        📄
                      </div>
                      <p className="text-base font-medium text-foreground">
                        Point your camera at the receipt
                      </p>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Live camera or library photo — real OCR when configured
                      </p>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-6 rounded-2xl border border-white/35" />
                </div>
                {cameraError && (
                  <p className="mt-3 max-w-[320px] text-center text-[12px] text-amber-700 dark:text-amber-400">
                    {cameraError}
                  </p>
                )}
              </div>

              <div className="mt-auto space-y-3 pt-6">
                {!cameraOn ? (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="w-full flex items-center justify-center gap-3 rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground active:scale-[0.985] active:brightness-105 transition touch-manipulation"
                  >
                    <Camera className="size-6" />
                    Open camera
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleShutter}
                    className="w-full flex items-center justify-center gap-3 rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground active:scale-[0.985] active:brightness-105 transition touch-manipulation"
                  >
                    <Camera className="size-6" />
                    Capture &amp; read
                  </button>
                )}

                <label className="block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => void handleUpload(e)}
                    className="hidden"
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center justify-center gap-3 rounded-3xl border border-border bg-card py-4 text-base font-semibold active:bg-secondary/60 active:scale-[0.985] transition cursor-pointer touch-manipulation"
                  >
                    <ImageIcon className="size-5" />
                    Choose from Library
                  </div>
                </label>

                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  Image is analyzed server-side · only your real line items are added
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
                  <p className="text-xl font-semibold tracking-tight">Reading receipt…</p>
                  <p className="text-sm text-muted-foreground">Vision OCR on your photo</p>
                </div>
              </div>

              {capturedImage && (
                <div className="w-full max-w-[220px] overflow-hidden rounded-2xl border bg-card shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capturedImage}
                    alt="Captured receipt"
                    className="max-h-48 w-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-2">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-secondary text-3xl">
                📄
              </div>
              <p className="text-lg font-semibold tracking-tight">Couldn’t read items</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {errorMessage || "Try a clearer, well-lit photo of the full receipt."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStep("capture");
                }}
                className="mt-6 w-full max-w-xs rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground"
              >
                Try again
              </button>
            </div>
          )}

          {step === "review" && (
            <div>
              <div className="mb-5">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold tracking-tight">Review items</div>
                  <div className="rounded-full bg-amber-100 px-2.5 py-px text-[10px] font-medium text-amber-700">
                    Needs confirmation
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Low-confidence OCR lines — adjust before adding.
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
                        <input
                          value={item.name}
                          onChange={(e) => updateReviewItem(item.id, { name: e.target.value })}
                          className="w-full bg-transparent text-[15px] font-semibold tracking-[-0.01em] outline-none border-b border-transparent focus:border-border/50 pb-0.5"
                        />

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                          <div className="flex items-center gap-1 rounded-full bg-secondary/70 p-0.5">
                            <button
                              type="button"
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
                              type="button"
                              onClick={() => updateReviewItem(item.id, { qty: item.qty + 1 })}
                              className="touch-target grid size-8 place-items-center rounded-full active:bg-background/70"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-xs text-muted-foreground">{item.unit}</div>
                          {typeof item.price === "number" && (
                            <div className="text-xs font-medium tabular-nums">
                              €{item.price.toFixed(2)}
                            </div>
                          )}

                          <div className="flex-1 min-w-[148px]">
                            <div className="inline-flex rounded-2xl bg-secondary/70 p-0.5 text-xs font-semibold">
                              {(["fridge", "freezer", "pantry"] as StorageKey[]).map((s) => (
                                <button
                                  type="button"
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

                          <button
                            type="button"
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
              <div className="text-center mb-6">
                <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--color-fresh)_12%,var(--color-card))] text-3xl">
                  ✓
                </div>
                <p className="font-semibold tracking-tight">Added to your pantry</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {addedCountForPrompt} item{addedCountForPrompt === 1 ? "" : "s"} saved
                </p>
              </div>

              <div className="mt-auto rounded-3xl border bg-secondary/60 px-4 py-3.5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="text-xl leading-none mt-0.5">📸</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold tracking-[-0.01em]">
                      Add expiration photos?
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 pr-2">
                      Optional — improves tracking for these items.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSkipExpirationPrompt}
                    className="touch-target -mr-1 -mt-1 grid size-8 place-items-center rounded-full text-muted-foreground/70 active:text-foreground active:bg-background/60"
                    aria-label="Dismiss photo prompt"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={handleTakePhotosForExpiration}
                    className="flex-1 rounded-2xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] active:brightness-105 transition"
                  >
                    Take photos
                  </button>
                  <button
                    type="button"
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

        {step === "review" && (
          <div className="border-t border-border/60 bg-background px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={confirmReview}
              disabled={reviewItems.length === 0}
              className="w-full rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground active:scale-[0.985] disabled:opacity-60 transition disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              <Check className="size-5" />
              Add {reviewItems.length} item{reviewItems.length === 1 ? "" : "s"} to pantry
            </button>
            <button
              type="button"
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
              type="button"
              onClick={handleClose}
              className="text-sm font-medium text-muted-foreground py-2 active:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {pendingRemoveReviewId && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-xl">
            <p className="font-display text-lg font-medium tracking-tight">
              Remove {pendingRemoveName}?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              This drops it from the review list only. Already-added high-confidence items stay in
              the pantry.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold"
                onClick={() => setPendingRemoveReviewId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-2xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"
                onClick={confirmRemoveReviewItem}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
