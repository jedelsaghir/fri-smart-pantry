"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DetectedItem } from "@/types/pantry";
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
} from "@/lib/ocr-merge";
import {
  createPhotoId,
  scanHeaderTitle,
  type CapturedPhoto,
  type OcrMeta,
  type ReceiptScanFlowProps,
  type ScanStep,
} from "./receipt-scan/types";
import { ReceiptCaptureStage } from "./receipt-scan/ReceiptCaptureStage";
import {
  ReceiptErrorStage,
  ReceiptProcessingStage,
  ReceiptResultStage,
} from "./receipt-scan/ReceiptProcessingStage";
import {
  ReceiptRemoveConfirmDialog,
  ReceiptReviewFooter,
  ReceiptReviewStage,
} from "./receipt-scan/ReceiptReviewStage";

export type { DetectedItem };
export type { ReceiptScanFlowProps } from "./receipt-scan/types";

export function ReceiptScanFlow({
  open,
  onClose,
  onItemsAdded,
  onReceiptSaved,
  pantryItems = [],
  onNavigateToPantry,
}: ReceiptScanFlowProps) {
  const [step, setStep] = useState<ScanStep>("capture");
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
  const ocrMetaRef = useRef<OcrMeta>({});
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

  useEffect(() => {
    if (!cameraOn || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [cameraOn]);

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
        /* ignore */
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
      const settled = await Promise.all(
        enhanced.map(async (dataUrl) => {
          const result = await platform.ocr.detectFromImage(dataUrl);
          done += 1;
          setProcessProgress(40 + Math.round((done / total) * 50));
          setProcessSub(
            total === 1 ? "Vision OCR on your photo" : `Read ${done} of ${total} photos`
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

  const handleShutter = () => {
    if (capturing) return;
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      void startCamera();
      return;
    }
    setCapturing(true);

    hapticShutter();
    setShutterFlash(true);
    setShutterPulse(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setShutterFlash(false);
      setShutterPulse(false);
    }, 220);

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
      if (detected.length > 0) saveReceiptSnapshot(detected, primaryImage);
      else if (autoOnly.length > 0) saveReceiptSnapshot(autoOnly, primaryImage);
      onNavigateToPantry?.();
      handleClose();
      return;
    }

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
      description: parts.length
        ? parts.join(" · ") + " · saved in Finances"
        : "Receipt saved in Finances",
    });
    onNavigateToPantry?.();
    handleClose();
  };

  const handleRetryFromError = () => {
    setErrorMessage(null);
    setStep("capture");
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
              {scanHeaderTitle(step, resultOk)}
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
            <ReceiptCaptureStage
              ocrConfigured={ocrConfigured}
              cameraOn={cameraOn}
              cameraError={cameraError}
              videoRef={videoRef}
              fileInputRef={fileInputRef}
              photos={photos}
              captureQuality={captureQuality}
              shutterFlash={shutterFlash}
              shutterPulse={shutterPulse}
              capturing={capturing}
              onStartCamera={startCamera}
              onShutter={handleShutter}
              onProcess={() => void startProcessing(photos)}
              onUpload={(e) => void handleUpload(e)}
              onRemovePhoto={removePhoto}
            />
          )}

          {step === "processing" && (
            <ReceiptProcessingStage
              processLabel={processLabel}
              processSub={processSub}
              processProgress={processProgress}
              photos={photos}
            />
          )}

          {step === "result" && (
            <ReceiptResultStage resultOk={resultOk} resultMessage={resultMessage} />
          )}

          {step === "error" && (
            <ReceiptErrorStage
              errorMessage={errorMessage}
              photoCount={photoCount}
              onRetry={handleRetryFromError}
              onClearAndRetry={() => {
                setPhotos([]);
                handleRetryFromError();
              }}
            />
          )}

          {step === "review" && (
            <ReceiptReviewStage
              reviewItems={reviewItems}
              onUpdateItem={updateReviewItem}
              onRemoveItem={removeReviewItem}
            />
          )}
        </div>

        {step === "review" && (
          <ReceiptReviewFooter
            reviewCount={reviewItems.length}
            onConfirm={confirmReview}
            onSkip={() => {
              if (detected.length > 0) {
                const reviewIds = new Set(reviewItems.map((r) => r.id));
                const autoPart = detected.filter((i) => !reviewIds.has(i.id));
                if (autoPart.length > 0) saveReceiptSnapshot(autoPart, primaryImage);
              }
              onNavigateToPantry?.();
              handleClose();
            }}
          />
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
        <ReceiptRemoveConfirmDialog
          itemName={pendingRemoveName}
          onCancel={() => setPendingRemoveReviewId(null)}
          onConfirm={confirmRemoveReviewItem}
        />
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
