"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Image as ImageIcon,
  X,
  Loader2,
  Check,
  Trash2,
  Sparkles,
  Aperture,
} from "lucide-react";
import type {
  StorageKey,
  DetectedItem,
  StoredReceipt,
  ReviewDisposition,
} from "@/types/pantry";
import { toast } from "sonner";
import { buildReceiptFromScan, readFileAsDataUrl } from "@/lib/receipts";
import { captureAndPrepareFrame, prepareImageForOcr } from "@/lib/ocr-image";
import {
  analyzeCaptureQuality,
  hapticPhotoQueued,
  hapticShutter,
  type CaptureQuality,
} from "@/lib/capture-quality";
import { getPlatform } from "@/platform";
import type { OcrDetectResult } from "@/platform/types";
import {
  mergeOcrResults,
  multiPhotoErrorMessage,
  ocrLinesToDetected,
  splitAutoAndReview,
  type FlatPantryRef,
} from "@/lib/ocr-merge";

export type { DetectedItem };

type CapturedPhoto = {
  id: string;
  dataUrl: string;
};

interface ReceiptScanFlowProps {
  open: boolean;
  onClose: () => void;
  onItemsAdded: (
    items: Array<Omit<DetectedItem, "confidence" | "id">>,
    options?: { silent?: boolean }
  ) => void;
  /** Persist full receipt (photo + line items) for Finances history */
  onReceiptSaved?: (receipt: StoredReceipt) => void;
  /** Existing pantry rows — similar / duplicate lines go to review */
  pantryItems?: FlatPantryRef[];
  /** Called when scan finishes cleanly (no review) so parent can open Pantry tab */
  onNavigateToPantry?: () => void;
}

function formatStorageLabel(storage: StorageKey) {
  return storage === "fridge" ? "Fridge" : storage === "freezer" ? "Freezer" : "Pantry";
}

function createPhotoId() {
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ReceiptScanFlow({
  open,
  onClose,
  onItemsAdded,
  onReceiptSaved,
  pantryItems = [],
  onNavigateToPantry,
}: ReceiptScanFlowProps) {
  const [step, setStep] = useState<
    "capture" | "processing" | "result" | "review" | "error"
  >("capture");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [reviewItems, setReviewItems] = useState<DetectedItem[]>([]);
  const [resultOk, setResultOk] = useState(true);
  const [resultMessage, setResultMessage] = useState("");
  const [processLabel, setProcessLabel] = useState("Reading receipt…");
  const [processSub, setProcessSub] = useState("Vision OCR on your photos");
  const [processProgress, setProcessProgress] = useState(0);
  const [pendingRemoveReviewId, setPendingRemoveReviewId] = useState<string | null>(null);
  const [ocrConfigured, setOcrConfigured] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [shutterPulse, setShutterPulse] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureQuality, setCaptureQuality] = useState<CaptureQuality | null>(null);

  const receiptSavedRef = useRef(false);
  const ocrMetaRef = useRef<{ store?: string | null; total?: number | null; currency?: string }>(
    {}
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  const clearResultTimer = () => {
    if (resultTimerRef.current) {
      clearTimeout(resultTimerRef.current);
      resultTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      clearResultTimer();
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
      // Auto-open camera for seamless scan → capture
      if (!cancelled && getPlatform().ocr.supportsLiveCamera()) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 1920 },
            },
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          setCameraOn(true);
          setCameraError(null);
        } catch {
          if (!cancelled) {
            setCameraError(
              "Camera permission denied or unavailable. You can still add photos from your library."
            );
            setCameraOn(false);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
      clearResultTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Attach MediaStream after <video> mounts
  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [cameraOn]);

  // Live capture quality feedback (~2.5 Hz while camera open on capture step)
  useEffect(() => {
    if (qualityTimerRef.current) {
      clearInterval(qualityTimerRef.current);
      qualityTimerRef.current = null;
    }
    if (!open || !cameraOn || step !== "capture") {
      setCaptureQuality(null);
      return;
    }
    const tick = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        setCaptureQuality(analyzeCaptureQuality(video));
      } catch {
        /* ignore analysis errors */
      }
    };
    tick();
    qualityTimerRef.current = setInterval(tick, 400);
    return () => {
      if (qualityTimerRef.current) {
        clearInterval(qualityTimerRef.current);
        qualityTimerRef.current = null;
      }
    };
  }, [open, cameraOn, step]);

  if (!open) return null;

  const resetFlow = () => {
    stopCamera();
    clearResultTimer();
    if (qualityTimerRef.current) {
      clearInterval(qualityTimerRef.current);
      qualityTimerRef.current = null;
    }
    setStep("capture");
    setPhotos([]);
    setDetected([]);
    setReviewItems([]);
    setResultOk(true);
    setResultMessage("");
    setProcessLabel("Reading receipt…");
    setProcessSub("Enhancing photos · Vision OCR");
    setProcessProgress(0);
    setErrorMessage(null);
    setCameraError(null);
    setShutterFlash(false);
    setShutterPulse(false);
    setCapturing(false);
    setCaptureQuality(null);
    receiptSavedRef.current = false;
    ocrMetaRef.current = {};
  };

  const handleClose = () => {
    resetFlow();
    onClose();
  };

  const primaryImage = photos[0]?.dataUrl ?? null;

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

  const finishCleanToPantry = (allItems: DetectedItem[]) => {
    saveReceiptSnapshot(allItems, primaryImage);
    toast.success("Pantry Updated", {
      description: ocrMetaRef.current.store
        ? `Saved receipt from ${ocrMetaRef.current.store}`
        : "Receipt saved in Finances",
    });
    stopCamera();
    onNavigateToPantry?.();
    handleClose();
  };

  const showResultThen = (opts: {
    ok: boolean;
    message: string;
    next: "review" | "error";
    errorText?: string;
  }) => {
    setResultOk(opts.ok);
    setResultMessage(opts.message);
    setStep("result");
    clearResultTimer();
    resultTimerRef.current = setTimeout(() => {
      if (opts.next === "error") {
        setErrorMessage(opts.errorText || opts.message);
        setStep("error");
        return;
      }
      setStep("review");
    }, opts.ok ? 1250 : 1400);
  };

  const startProcessing = async (photoList: CapturedPhoto[]) => {
    if (photoList.length === 0) {
      toast.error("Add at least one photo");
      return;
    }

    stopCamera();
    setStep("processing");
    setErrorMessage(null);
    receiptSavedRef.current = false;
    setProcessProgress(0);
    setProcessLabel("Enhancing photos…");
    setProcessSub(
      photoList.length === 1
        ? "Crop · contrast · sharpen for clearer text"
        : `Enhancing ${photoList.length} photos for OCR`
    );

    try {
      const platform = getPlatform();
      const total = photoList.length;

      // Pre-process each photo (crop, deskew, contrast, denoise, sharpen)
      const enhanced: string[] = [];
      for (let i = 0; i < photoList.length; i++) {
        setProcessSub(`Enhancing photo ${i + 1} of ${total}`);
        setProcessProgress(Math.round(((i + 0.4) / total) * 35));
        try {
          const ready = await prepareImageForOcr(photoList[i].dataUrl, {
            enhance: true,
            maxEdge: 1600,
            quality: 0.88,
          });
          enhanced.push(ready);
        } catch {
          enhanced.push(photoList[i].dataUrl);
        }
      }

      setProcessLabel("Reading receipt…");
      setProcessSub(
        total === 1 ? "Vision OCR on your photo" : `OCR on ${total} photos · merging lines`
      );
      setProcessProgress(40);

      let done = 0;
      // Parallel OCR for speed; progress ticks as each settles
      const settled = await Promise.all(
        enhanced.map(async (dataUrl) => {
          const result = await platform.ocr.detectFromImage(dataUrl);
          done += 1;
          setProcessProgress(40 + Math.round((done / total) * 50));
          setProcessSub(
            total === 1
              ? "Vision OCR on your photo"
              : `Read ${done} of ${total} photos`
          );
          return result;
        })
      );

      setProcessLabel("Matching your pantry…");
      setProcessSub("Fuzzy match · merge overlaps · split review");
      setProcessProgress(95);
      await new Promise((r) => setTimeout(r, 320));

      const merged = mergeOcrResults(settled as OcrDetectResult[]);

      if (!merged.ok || merged.items.length === 0) {
        const msg = multiPhotoErrorMessage(settled as OcrDetectResult[]);
        setDetected([]);
        setReviewItems([]);
        showResultThen({
          ok: false,
          message: "Couldn't read receipt",
          next: "error",
          errorText: msg,
        });
        return;
      }

      ocrMetaRef.current = {
        store: merged.store,
        total: merged.total,
        currency: merged.currency,
      };

      const results = ocrLinesToDetected(merged.items);
      setDetected(results);

      const {
        autoItems,
        reviewItems: ambiguous,
        excludedItems,
      } = splitAutoAndReview(results, pantryItems);

      if (autoItems.length > 0) {
        onItemsAdded(
          autoItems.map(({ id, confidence, ...rest }) => rest),
          { silent: true }
        );
      }

      setProcessProgress(100);

      const skippedNonFood = excludedItems.length;
      if (skippedNonFood > 0) {
        toast.message(
          skippedNonFood === 1
            ? "Skipped 1 non-pantry item"
            : `Skipped ${skippedNonFood} non-pantry items`,
          {
            description: "Cleaning, household, and personal care stay off your fridge.",
            duration: 3200,
          }
        );
      }

      // Receipt snapshot should only track pantry-bound lines for pantry flow;
      // financials still get store total from OCR meta.
      const pantryBound = results.filter((r) => !excludedItems.some((e) => e.id === r.id));
      setDetected(pantryBound);

      if (ambiguous.length > 0) {
        setReviewItems(ambiguous);
        const parts: string[] = [];
        if (autoItems.length > 0) parts.push(`Added ${autoItems.length}`);
        parts.push(`${ambiguous.length} to review`);
        if (skippedNonFood > 0) parts.push(`${skippedNonFood} skipped`);
        showResultThen({
          ok: true,
          message: parts.join(" · "),
          next: "review",
        });
      } else {
        setResultOk(true);
        setResultMessage(
          autoItems.length > 0
            ? `Added ${autoItems.length} item${autoItems.length === 1 ? "" : "s"}` +
                (skippedNonFood > 0 ? ` · ${skippedNonFood} non-food skipped` : "")
            : skippedNonFood > 0
              ? "No pantry items on this receipt"
              : "Nothing to add"
        );
        setStep("result");
        clearResultTimer();
        resultTimerRef.current = setTimeout(() => {
          if (autoItems.length > 0) {
            finishCleanToPantry(pantryBound);
          } else {
            stopCamera();
            onNavigateToPantry?.();
            handleClose();
          }
        }, 1250);
      }
    } catch (err) {
      const text =
        err instanceof Error
          ? err.message
          : "Something went wrong while reading the receipt.";
      setErrorMessage(text);
      showResultThen({
        ok: false,
        message: "Processing failed",
        next: "error",
        errorText: text,
      });
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!getPlatform().ocr.supportsLiveCamera()) {
      setCameraError("Camera not available in this browser. Use Add from Library instead.");
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
      setCameraError(
        "Camera permission denied or unavailable. You can still add photos from your library."
      );
      setCameraOn(false);
    }
  };

  /** Instant capture — camera stays live for the next shot */
  const handleShutter = () => {
    if (capturing) return;
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      void startCamera();
      return;
    }
    setCapturing(true);

    // Strong shutter feedback: flash + ring pulse + haptic
    hapticShutter();
    setShutterFlash(true);
    setShutterPulse(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setShutterFlash(false);
      setShutterPulse(false);
    }, 220);

    // Capture + light enhance; re-arm shutter ASAP for multi-shot
    void (async () => {
      try {
        const prepared = await captureAndPrepareFrame(video, {
          maxEdge: 1600,
          quality: 0.9,
          fast: true,
        });
        if (!prepared) {
          toast.error("Could not capture frame");
          return;
        }
        setPhotos((prev) => [...prev, { id: createPhotoId(), dataUrl: prepared }]);
        hapticPhotoQueued();
      } catch {
        toast.error("Could not capture frame");
      } finally {
        requestAnimationFrame(() => setCapturing(false));
      }
    })();
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    try {
      const next: CapturedPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await readFileAsDataUrl(file);
        // Light enhance for library picks (full enhance again before OCR)
        let prepared = dataUrl;
        try {
          prepared = await prepareImageForOcr(dataUrl, { fast: true, enhance: true });
        } catch {
          prepared = dataUrl;
        }
        next.push({ id: createPhotoId(), dataUrl: prepared });
      }
      if (next.length === 0) {
        toast.error("No images selected");
      } else {
        setPhotos((prev) => [...prev, ...next]);
        toast.success(
          next.length === 1 ? "Photo added" : `${next.length} photos added`,
          { description: "Tap Process Receipt when ready." }
        );
      }
    } catch {
      setErrorMessage("Could not read that image file. Try another photo.");
      setStep("error");
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
      const autoOnly = detected.filter((i) => !reviewItems.some((r) => r.id === i.id));
      // Prefer detected high-confidence set already applied; save receipt if needed
      if (detected.length > 0) saveReceiptSnapshot(detected, primaryImage);
      else if (autoOnly.length > 0) saveReceiptSnapshot(autoOnly, primaryImage);
      onNavigateToPantry?.();
      handleClose();
      return;
    }

    // Preserve disposition + pantryMatch for merge/update handling in usePantry
    const toAdd = reviewItems.map(({ id, confidence, ...rest }) => rest);
    if (toAdd.length > 0) {
      onItemsAdded(toAdd, { silent: true });
    }

    const reviewIds = new Set(reviewItems.map((r) => r.id));
    const autoPart = detected.filter((i) => !reviewIds.has(i.id));
    const allForReceipt = [...autoPart, ...reviewItems];
    saveReceiptSnapshot(allForReceipt, primaryImage);

    const mergeN = reviewItems.filter(
      (i) => i.pantryMatch && (i.disposition ?? "merge") === "merge"
    ).length;
    const updateN = reviewItems.filter(
      (i) => i.pantryMatch && i.disposition === "update"
    ).length;
    const newN = reviewItems.length - mergeN - updateN;

    const parts: string[] = [];
    if (newN > 0) parts.push(`${newN} new`);
    if (mergeN > 0) parts.push(`${mergeN} merged`);
    if (updateN > 0) parts.push(`${updateN} updated`);

    toast.success("Pantry Updated", {
      description: parts.length ? parts.join(" · ") + " · saved in Finances" : "Receipt saved in Finances",
    });
    onNavigateToPantry?.();
    handleClose();
  };

  const handleRetryFromError = () => {
    setErrorMessage(null);
    setStep("capture");
    // Re-open camera; keep existing photos so user can delete/retake
    void startCamera();
  };

  const pendingRemoveName = reviewItems.find((i) => i.id === pendingRemoveReviewId)?.name;
  const photoCount = photos.length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex-1 flex flex-col bg-background rounded-t-3xl mt-auto max-h-[94dvh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/60">
          <div className="min-w-0">
            <div className="font-semibold text-lg tracking-tight">
              {step === "result"
                ? resultOk
                  ? "Receipt ready"
                  : "Scan issue"
                : step === "review"
                  ? "Review items"
                  : step === "processing"
                    ? "Processing"
                    : "Scan receipt"}
            </div>
            {step === "capture" && photoCount > 0 && (
              <p className="text-[12px] text-muted-foreground">
                {photoCount} photo{photoCount === 1 ? "" : "s"} · long receipts OK
              </p>
            )}
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

        <div
          className={
            "flex-1 overflow-y-auto overscroll-contain " +
            (step === "capture" ? "px-0 py-0 flex flex-col" : "px-5 py-6")
          }
        >
          {step === "capture" && (
            <div className="flex flex-col flex-1 min-h-0">
              {ocrConfigured === false && (
                <div className="mx-5 mt-3 mb-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] leading-snug text-foreground/90">
                  <span className="font-semibold">OCR not configured.</span> Set{" "}
                  <code className="text-[11px]">XAI_API_KEY</code> on the server to read real
                  receipts.
                </div>
              )}

              {/* Camera / preview stage */}
              <div className="relative flex-1 min-h-[280px] bg-black/90">
                {cameraOn ? (
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-secondary/40">
                    <div className="mx-auto mb-4 grid size-20 place-items-center rounded-2xl bg-background/80 text-4xl shadow-inner">
                      📄
                    </div>
                    <p className="text-base font-medium text-foreground">
                      Point at the receipt
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground max-w-[260px]">
                      Take multiple photos for long receipts — no pause between shots
                    </p>
                    <button
                      type="button"
                      onClick={() => void startCamera()}
                      className="mt-5 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground active:scale-[0.98]"
                    >
                      Open camera
                    </button>
                  </div>
                )}

                {/* Shutter flash + expanding ring */}
                {shutterFlash && (
                  <>
                    <div className="pointer-events-none absolute inset-0 z-20 bg-white/80 animate-[fadeOut_0.2s_ease-out_forwards]" />
                    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
                      <div className="size-24 rounded-full border-2 border-white/90 animate-[shutterRing_0.35s_ease-out_forwards]" />
                    </div>
                  </>
                )}

                {/* Frame guide — tinted when quality issues */}
                {cameraOn && (
                  <div
                    className={
                      "pointer-events-none absolute inset-5 rounded-2xl border-2 transition-all duration-300 " +
                      (captureQuality && !captureQuality.ok
                        ? "border-amber-300/80 shadow-[0_0_0_1px_rgba(251,191,36,0.15),inset_0_0_40px_rgba(0,0,0,0.12)]"
                        : captureQuality?.ok
                          ? "border-emerald-300/45 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
                          : "border-white/35 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]")
                    }
                  />
                )}

                {/* Live quality guidance */}
                {cameraOn && captureQuality?.message && (
                  <div className="absolute left-3 right-3 top-3 z-10 flex justify-center px-1">
                    <div className="max-w-[min(100%,320px)] rounded-full border border-white/10 bg-black/60 px-3.5 py-1.5 text-center text-[12px] font-medium leading-snug text-white/95 shadow-lg backdrop-blur-md">
                      {captureQuality.message}
                    </div>
                  </div>
                )}
                {cameraOn && captureQuality?.ok && !captureQuality.message && (
                  <div className="absolute left-3 right-3 top-3 z-10 flex justify-center">
                    <div className="rounded-full border border-emerald-400/25 bg-black/45 px-3 py-1 text-[11px] font-medium text-emerald-100/90 backdrop-blur-md">
                      Looking good — snap when ready
                    </div>
                  </div>
                )}

                {cameraError && (
                  <p className="absolute bottom-2 left-3 right-3 text-center text-[11px] text-amber-200 drop-shadow">
                    {cameraError}
                  </p>
                )}
              </div>

              {/* Thumbnail strip */}
              {photoCount > 0 && (
                <div className="border-t border-border/50 bg-background/95 px-3 py-2.5">
                  <div className="mb-1.5 flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {photoCount} photo{photoCount === 1 ? "" : "s"} ready
                    </span>
                    <span className="text-[10px] text-muted-foreground/80">Tap × to remove</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="relative shrink-0 size-16 overflow-hidden rounded-xl ring-1 ring-border/50 bg-secondary animate-[thumbPop_0.28s_ease-out]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.dataUrl}
                          alt={`Receipt photo ${index + 1}`}
                          className="size-full object-cover"
                        />
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 text-[9px] font-semibold text-white">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.id)}
                          className="absolute -right-0.5 -top-0.5 grid size-6 place-items-center rounded-full bg-black/70 text-white active:scale-95"
                          aria-label={`Delete photo ${index + 1}`}
                        >
                          <X className="size-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="space-y-2.5 px-5 pt-3 pb-2 bg-background">
                {cameraOn && (
                  <button
                    type="button"
                    onClick={handleShutter}
                    disabled={capturing}
                    className={
                      "relative w-full flex items-center justify-center gap-3 rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground shadow-[0_10px_28px_-12px_color-mix(in_oklab,var(--color-brand)_55%,transparent)] active:scale-[0.97] active:brightness-110 transition touch-manipulation disabled:opacity-80 " +
                      (shutterPulse ? "scale-[0.97] brightness-110" : "")
                    }
                  >
                    <span className="relative grid size-9 place-items-center">
                      {shutterPulse && (
                        <span className="absolute inset-0 rounded-full border-2 border-brand-foreground/50 animate-[shutterRing_0.35s_ease-out_forwards]" />
                      )}
                      <span
                        className={
                          "grid size-9 place-items-center rounded-full border-2 border-brand-foreground/90 transition-transform " +
                          (shutterPulse ? "scale-90" : "")
                        }
                      >
                        <span className="size-5 rounded-full bg-brand-foreground/95" />
                      </span>
                    </span>
                    {photoCount === 0 ? "Capture" : "Capture next"}
                  </button>
                )}

                <button
                  type="button"
                  disabled={photoCount === 0}
                  onClick={() => void startProcessing(photos)}
                  className="w-full flex items-center justify-center gap-2 rounded-3xl bg-foreground py-3.5 text-base font-semibold text-background active:scale-[0.985] transition touch-manipulation disabled:opacity-40 disabled:active:scale-100"
                >
                  <Sparkles className="size-5" strokeWidth={2.25} />
                  Process Receipt
                  {photoCount > 0 ? ` (${photoCount})` : ""}
                </button>

                <label className="block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
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
                    className="w-full flex items-center justify-center gap-2 rounded-3xl border border-border bg-card py-3 text-sm font-semibold active:bg-secondary/60 active:scale-[0.985] transition cursor-pointer touch-manipulation"
                  >
                    <ImageIcon className="size-4.5" />
                    Add from Library
                  </div>
                </label>

                <p className="text-center text-[11px] text-muted-foreground pb-1">
                  Snap freely · enhance · merge · works on iOS &amp; Android
                </p>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center min-h-[420px] text-center pt-4 px-2">
              <div className="relative mb-8 size-28">
                <div className="absolute inset-0 rounded-full border-2 border-brand/12" />
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand animate-spin" />
                <div
                  className="absolute inset-3 rounded-full border-2 border-transparent border-b-[var(--color-fresh)] animate-spin"
                  style={{ animationDuration: "1.05s", animationDirection: "reverse" }}
                />
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid size-14 place-items-center rounded-2xl bg-secondary/85 shadow-inner">
                    {processProgress < 40 ? (
                      <Aperture className="size-7 text-brand animate-pulse" />
                    ) : (
                      <Loader2 className="size-7 animate-spin text-brand" />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 mb-5">
                <p className="text-xl font-semibold tracking-tight">{processLabel}</p>
                <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                  {processSub}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5 mb-5 max-w-[300px]">
                {(
                  [
                    { label: "Enhance", done: processProgress >= 40, active: processProgress < 40 },
                    {
                      label: "Read",
                      done: processProgress >= 90,
                      active: processProgress >= 40 && processProgress < 90,
                    },
                    {
                      label: "Match",
                      done: processProgress >= 100,
                      active: processProgress >= 90 && processProgress < 100,
                    },
                  ] as const
                ).map((s) => (
                  <span
                    key={s.label}
                    className={
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition " +
                      (s.active
                        ? "bg-brand/15 text-brand ring-1 ring-brand/20"
                        : s.done
                          ? "bg-[color-mix(in_oklab,var(--color-fresh)_14%,var(--color-secondary))] text-[var(--color-fresh)]"
                          : "bg-secondary/60 text-muted-foreground/70")
                    }
                  >
                    {s.done && !s.active ? "✓ " : ""}
                    {s.label}
                  </span>
                ))}
              </div>

              <div className="w-full max-w-[260px] mb-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground tabular-nums">
                <span>Progress</span>
                <span>{Math.min(100, Math.round(processProgress))}%</span>
              </div>
              <div className="w-full max-w-[260px] h-2 rounded-full bg-secondary overflow-hidden mb-8">
                <div
                  className="h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${Math.min(100, processProgress)}%`,
                    background:
                      "linear-gradient(90deg, var(--color-brand), color-mix(in oklab, var(--color-fresh) 70%, var(--color-brand)))",
                    backgroundSize: "200% 100%",
                    animation: "progressShimmer 1.4s linear infinite",
                  }}
                />
              </div>

              {photos.length > 0 && (
                <div className="flex justify-center gap-1.5 flex-wrap max-w-[280px]">
                  {photos.map((p, i) => {
                    const done =
                      processProgress >= 40 + ((i + 1) / Math.max(1, photos.length)) * 50;
                    return (
                      <div
                        key={p.id}
                        className={
                          "relative size-12 overflow-hidden rounded-lg ring-1 transition " +
                          (done ? "ring-brand/40 opacity-100" : "ring-border/40 opacity-80")
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.dataUrl} alt="" className="size-full object-cover" />
                        {done && (
                          <div className="absolute inset-0 grid place-items-center bg-black/30">
                            <Check className="size-4 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                        <span className="sr-only">Photo {i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === "result" && (
            <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-4 animate-in fade-in duration-300">
              <div
                className={
                  "mx-auto mb-5 grid size-[4.75rem] place-items-center rounded-[1.75rem] text-3xl shadow-[0_1px_0_0_oklch(1_0_0/0.5)_inset,0_12px_28px_-12px_oklch(0.2_0.02_150/0.18)] " +
                  (resultOk
                    ? "bg-[color-mix(in_oklab,var(--color-fresh)_14%,var(--color-card))] text-[var(--color-fresh)]"
                    : "bg-destructive/10 text-destructive")
                }
              >
                {resultOk ? <Check className="size-9" strokeWidth={2.25} /> : "!"}
              </div>
              <p className="font-display text-[1.35rem] font-medium tracking-[-0.02em]">
                {resultOk ? "All set" : "Couldn’t finish"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-xs">
                {resultMessage}
              </p>
              <div className="mt-8 flex gap-1.5">
                <span className="size-1.5 rounded-full bg-brand/60 animate-pulse" />
                <span
                  className="size-1.5 rounded-full bg-brand/40 animate-pulse"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="size-1.5 rounded-full bg-brand/25 animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-2">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-secondary text-3xl">
                📄
              </div>
              <p className="text-lg font-semibold tracking-tight">Couldn’t read that receipt</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                {errorMessage ||
                  "Blurry, incomplete, or poorly lit shots can't be read. Retake with good light and fill the frame."}
              </p>
              <ul className="mt-4 max-w-xs text-left text-[12px] text-muted-foreground space-y-1.5">
                <li>· Hold steady — avoid motion blur</li>
                <li>· Fill the frame with the receipt</li>
                <li>· Use even light; avoid heavy glare</li>
                <li>· Long receipts: a few clear sections work best</li>
              </ul>
              <button
                type="button"
                onClick={handleRetryFromError}
                className="mt-6 w-full max-w-xs rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground"
              >
                Retry capture
              </button>
              {photoCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotos([]);
                    handleRetryFromError();
                  }}
                  className="mt-2 w-full max-w-xs py-2.5 text-sm font-medium text-muted-foreground"
                >
                  Clear photos &amp; start over
                </button>
              )}
            </div>
          )}

          {step === "review" && (
            <div>
              <div className="mb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-lg font-semibold tracking-tight">Review items</div>
                  <div className="rounded-full bg-amber-100 px-2.5 py-px text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    Needs confirmation
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Low-confidence reads, similar pantry stock, or possible non-food items.
                </p>
              </div>

              <div className="space-y-3 pb-4">
                {reviewItems.map((item) => {
                  const match = item.pantryMatch;
                  const disposition: ReviewDisposition =
                    item.disposition ?? (match ? "merge" : "add_new");
                  const isLow = item.confidence < 0.8;
                  const isNonFoodSuspect = !!item.possiblyNonFood;
                  const resultQtyPreview =
                    match && disposition === "merge"
                      ? match.qty + item.qty
                      : disposition === "update"
                        ? item.qty
                        : item.qty;

                  return (
                    <div
                      key={item.id}
                      className={
                        "elevated-card rounded-3xl p-4 " +
                        (isNonFoodSuspect
                          ? "ring-1 ring-violet-500/25 bg-[color-mix(in_oklab,var(--color-card)_90%,oklch(0.72_0.06_300))]"
                          : match
                            ? "ring-1 ring-sky-500/25 bg-[color-mix(in_oklab,var(--color-card)_88%,oklch(0.7_0.06_230))]"
                            : "")
                      }
                    >
                      <div className="flex items-start gap-4">
                        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl">
                          {item.emoji}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {isNonFoodSuspect && (
                              <span className="rounded-full bg-violet-100 dark:bg-violet-500/15 px-2 py-px text-[10px] font-medium text-violet-800 dark:text-violet-300">
                                Possibly non-food
                                {item.nonFoodReason ? ` · ${item.nonFoodReason}` : ""}
                              </span>
                            )}
                            {isLow && !isNonFoodSuspect && (
                              <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                Low confidence · {Math.round(item.confidence * 100)}%
                              </span>
                            )}
                            {match && !isNonFoodSuspect && (
                              <span className="rounded-full bg-sky-100 dark:bg-sky-500/15 px-2 py-px text-[10px] font-medium text-sky-800 dark:text-sky-300">
                                {match.kind === "exact" ? "Likely match" : "Similar item"}
                                {typeof match.score === "number"
                                  ? ` · ${Math.round(match.score * 100)}%`
                                  : ""}
                              </span>
                            )}
                          </div>

                          <input
                            value={item.name}
                            onChange={(e) => updateReviewItem(item.id, { name: e.target.value })}
                            className="w-full bg-transparent text-[15px] font-semibold tracking-[-0.01em] outline-none border-b border-transparent focus:border-border/50 pb-0.5"
                          />

                          {/* Uncertain non-food: Keep / Discard */}
                          {isNonFoodSuspect && (
                            <div className="mt-2.5 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2.5">
                              <p className="text-[12px] leading-snug text-muted-foreground">
                                This doesn’t look like fridge, freezer, or pantry stock. Keep it only
                                if you want it tracked.
                              </p>
                              <div className="mt-2.5 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateReviewItem(item.id, {
                                      disposition: "add_new",
                                      possiblyNonFood: false,
                                    })
                                  }
                                  className={
                                    "flex-1 rounded-2xl py-2 text-[12px] font-semibold transition active:scale-[0.98] " +
                                    (!item.possiblyNonFood || disposition === "add_new"
                                      ? "bg-brand text-brand-foreground shadow-sm"
                                      : "bg-background/80 text-foreground border border-border/60")
                                  }
                                >
                                  Keep
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeReviewItem(item.id)}
                                  className="flex-1 rounded-2xl border border-border/60 bg-background/80 py-2 text-[12px] font-semibold text-foreground transition active:scale-[0.98]"
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Clear match line: “Similar to: X (current qty)” */}
                          {match && !isNonFoodSuspect && (
                            <div className="mt-2.5 rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2.5">
                              <p className="text-[13px] leading-snug text-foreground">
                                <span className="text-muted-foreground">Similar to: </span>
                                <span className="font-semibold">
                                  {match.emoji} {match.name}
                                </span>
                                <span className="text-muted-foreground tabular-nums">
                                  {" "}
                                  (current {match.qty} {match.unit})
                                </span>
                              </p>
                              {disposition === "merge" && (
                                <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                                  Update → {resultQtyPreview} {match.unit} (+{item.qty})
                                </p>
                              )}

                              <div className="mt-2.5 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateReviewItem(item.id, { disposition: "merge" })
                                  }
                                  className={
                                    "flex-1 rounded-2xl py-2 text-[12px] font-semibold transition active:scale-[0.98] " +
                                    (disposition === "merge" || disposition === "update"
                                      ? "bg-brand text-brand-foreground shadow-sm"
                                      : "bg-background/80 text-foreground border border-border/60")
                                  }
                                >
                                  Update existing
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateReviewItem(item.id, { disposition: "add_new" })
                                  }
                                  className={
                                    "flex-1 rounded-2xl py-2 text-[12px] font-semibold transition active:scale-[0.98] " +
                                    (disposition === "add_new"
                                      ? "bg-brand text-brand-foreground shadow-sm"
                                      : "bg-background/80 text-foreground border border-border/60")
                                  }
                                >
                                  Add as new
                                </button>
                              </div>
                            </div>
                          )}

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
                  );
                })}
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
              Confirm {reviewItems.length} item{reviewItems.length === 1 ? "" : "s"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (detected.length > 0) {
                  const reviewIds = new Set(reviewItems.map((r) => r.id));
                  const autoPart = detected.filter((i) => !reviewIds.has(i.id));
                  if (autoPart.length > 0) saveReceiptSnapshot(autoPart, primaryImage);
                }
                onNavigateToPantry?.();
                handleClose();
              }}
              className="mt-2.5 w-full py-2 text-sm font-medium text-muted-foreground active:text-foreground"
            >
              Skip for now
            </button>
          </div>
        )}

        {step === "capture" && (
          <div className="px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center bg-background">
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

      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
