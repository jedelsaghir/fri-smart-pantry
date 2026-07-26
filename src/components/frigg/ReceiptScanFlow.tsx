"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { DetectedItem } from "@/types/pantry";
import { toast } from "sonner";
import { buildReceiptFromScan, readFileAsDataUrl } from "@/lib/receipts";
import { captureAndPrepareFrame, prepareImageForOcr } from "@/lib/ocr-image";
import {
  analyzeCaptureQuality,
  hapticLight,
  hapticPhotoQueued,
  hapticShutter,
  hapticSuccess,
  type CaptureQuality,
} from "@/lib/capture-quality";
import { getPlatform } from "@/platform";
import type { OcrDetectResult } from "@/platform/types";
import {
  AUTO_ADD_CONFIDENCE,
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
  type PhotoProcessState,
  type ScanOutcomeSummary,
} from "./receipt-scan/ReceiptProcessingStage";
import {
  ReceiptRemoveConfirmDialog,
  ReceiptReviewFooter,
  ReceiptReviewStage,
} from "./receipt-scan/ReceiptReviewStage";
import { ReceiptExpiryAssistStage } from "./receipt-scan/ReceiptExpiryAssistStage";
import type { ExpiryAssistSignal } from "./receipt-scan/types";

export type { DetectedItem };
export type { ReceiptScanFlowProps } from "./receipt-scan/types";

export function ReceiptScanFlow({
  open,
  onClose,
  onItemsAdded,
  onReceiptSaved,
  onExpirySignals,
  pantryItems = [],
  onNavigateToPantry,
}: ReceiptScanFlowProps) {
  const [step, setStep] = useState<ScanStep>("capture");
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [reviewItems, setReviewItems] = useState<DetectedItem[]>([]);
  /** Items eligible for optional post-scan expiry photo assist */
  const [expiryCandidates, setExpiryCandidates] = useState<DetectedItem[]>([]);
  const [resultOk, setResultOk] = useState(true);
  const [resultMessage, setResultMessage] = useState("");
  const [processLabel, setProcessLabel] = useState("Reading receipt…");
  const [processSub, setProcessSub] = useState("Vision OCR on your photos");
  const [processProgress, setProcessProgress] = useState(0);
  const [pendingRemoveReviewId, setPendingRemoveReviewId] = useState<string | null>(null);
  const [ocrConfigured, setOcrConfigured] = useState<boolean | null>(null);
  /** Rich OCR health for banner (missing key vs auth/network vs ok) */
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string | null>(null);
  const [ocrHealth, setOcrHealth] = useState<
    "missing" | "ok" | "auth_failed" | "network" | "model" | "error" | "unknown" | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [shutterPulse, setShutterPulse] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureQuality, setCaptureQuality] = useState<CaptureQuality | null>(null);
  const [photoStates, setPhotoStates] = useState<PhotoProcessState[]>([]);
  const [processPhase, setProcessPhase] = useState<"enhance" | "read" | "merge">("enhance");
  const [outcomeSummary, setOutcomeSummary] = useState<ScanOutcomeSummary | null>(null);

  const receiptSavedRef = useRef(false);
  const photosRef = useRef<CapturedPhoto[]>([]);
  const pantryToastShownRef = useRef(false);
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
        const ocr = getPlatform().ocr;
        if (ocr.getStatus) {
          const status = await ocr.getStatus();
          if (!cancelled) {
            setOcrConfigured(status.keyPresent || status.configured);
            setOcrHealth(status.health);
            // Only surface banner when not fully OK
            setOcrStatusMessage(status.health === "ok" ? null : status.message);
          }
        } else {
          const ok = await ocr.isConfigured();
          if (!cancelled) {
            setOcrConfigured(ok);
            setOcrHealth(ok ? "ok" : "missing");
            setOcrStatusMessage(
              ok ? null : "OCR is not configured. Set XAI_API_KEY on the server."
            );
          }
        }
      } catch {
        if (!cancelled) {
          setOcrConfigured(false);
          setOcrHealth("unknown");
          setOcrStatusMessage(
            "Couldn’t verify OCR status from the server. Try a scan or check host secrets."
          );
        }
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
    setExpiryCandidates([]);
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
    setPhotoStates([]);
    setProcessPhase("enhance");
    setOutcomeSummary(null);
    receiptSavedRef.current = false;
    pantryToastShownRef.current = false;
    ocrMetaRef.current = {};
    photosRef.current = [];
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

  const leaveToPantry = () => {
    if (!pantryToastShownRef.current) {
      pantryToastShownRef.current = true;
      toast.success("Pantry Updated", {
        description: ocrMetaRef.current.store
          ? `Saved receipt from ${ocrMetaRef.current.store}`
          : "Receipt saved in Finances",
      });
    }
    stopCamera();
    onNavigateToPantry?.();
    handleClose();
  };

  /** Offer optional expiry label photos after a successful add (skippable). */
  const offerExpiryAssist = (candidates: DetectedItem[], allForReceipt: DetectedItem[]) => {
    saveReceiptSnapshot(allForReceipt, primaryImage);
    if (candidates.length === 0) {
      leaveToPantry();
      return;
    }
    setExpiryCandidates(candidates);
    setStep("expiry-assist");
  };

  const finishExpiryAssist = (signals: ExpiryAssistSignal[]) => {
    if (signals.length > 0) {
      onExpirySignals?.(signals);
      const photoN = signals.filter((s) => s.labelPhotoDataUrl).length;
      const daysN = signals.filter((s) => typeof s.daysLeft === "number").length;
      const parts: string[] = [];
      if (photoN > 0) parts.push(`${photoN} label photo${photoN === 1 ? "" : "s"}`);
      if (daysN > 0) parts.push(`${daysN} date${daysN === 1 ? "" : "s"} set`);
      toast.success("Labels saved", {
        description: parts.join(" · ") || "Expiry notes attached",
      });
      pantryToastShownRef.current = true; // suppress second generic toast
    }
    leaveToPantry();
  };

  const showResultThen = (opts: {
    ok: boolean;
    message: string;
    next: "review" | "error";
    errorText?: string;
    summary?: ScanOutcomeSummary | null;
  }) => {
    setResultOk(opts.ok);
    setResultMessage(opts.message);
    setOutcomeSummary(opts.summary ?? null);
    setStep("result");
    if (opts.ok) hapticSuccess();
    clearResultTimer();
    resultTimerRef.current = setTimeout(() => {
      if (opts.next === "error") {
        setErrorMessage(opts.errorText || opts.message);
        setStep("error");
        return;
      }
      setStep("review");
    }, opts.ok ? 1400 : 1500);
  };

  const startProcessing = async (photoList: CapturedPhoto[]) => {
    if (photoList.length === 0) {
      toast.error("Add at least one photo");
      return;
    }

    photosRef.current = photoList;
    stopCamera();
    setStep("processing");
    setErrorMessage(null);
    receiptSavedRef.current = false;
    setProcessProgress(0);
    setProcessPhase("enhance");
    setPhotoStates(photoList.map(() => "pending"));
    setProcessLabel("Enhancing…");
    setProcessSub(
      photoList.length === 1
        ? "Crop · contrast · sharpen for clearer text"
        : `Pipeline on ${photoList.length} photos — enhance, then read`
    );

    try {
      const platform = getPlatform();
      const total = photoList.length;
      const settled: OcrDetectResult[] = new Array(total);
      const ocrJobs: Promise<void>[] = [];
      let readDone = 0;

      // Progressive pipeline: enhance photo i, start OCR immediately, then enhance i+1
      for (let i = 0; i < total; i++) {
        setProcessPhase("enhance");
        setProcessLabel(total === 1 ? "Enhancing photo…" : "Enhancing…");
        setProcessSub(
          total === 1
            ? "Crop · contrast · sharpen for clearer text"
            : `Photo ${i + 1} of ${total} · enhance then read`
        );
        setPhotoStates((prev) => {
          const next = [...prev];
          next[i] = "enhancing";
          return next;
        });
        // 0–35% for enhance wave
        setProcessProgress(Math.round(((i + 0.35) / total) * 35));

        let enhanced = photoList[i].dataUrl;
        try {
          enhanced = await prepareImageForOcr(photoList[i].dataUrl, {
            enhance: true,
            maxEdge: 1600,
            quality: 0.88,
          });
        } catch {
          enhanced = photoList[i].dataUrl;
        }

        setPhotoStates((prev) => {
          const next = [...prev];
          next[i] = "reading";
          return next;
        });
        setProcessPhase("read");
        setProcessLabel(total === 1 ? "Reading receipt…" : "Reading photos…");
        setProcessSub(
          total === 1
            ? "Vision OCR on your photo"
            : `OCR running · ${readDone} of ${total} finished`
        );

        const idx = i;
        const job = platform.ocr.detectFromImage(enhanced).then((result) => {
          settled[idx] = result;
          readDone += 1;
          setPhotoStates((prev) => {
            const next = [...prev];
            next[idx] = result.ok ? "done" : "error";
            return next;
          });
          setProcessProgress(35 + Math.round((readDone / total) * 50));
          setProcessSub(
            total === 1
              ? "Vision OCR on your photo"
              : `Read ${readDone} of ${total} photos`
          );
        });
        ocrJobs.push(job);
      }

      await Promise.all(ocrJobs);

      setProcessPhase("merge");
      setProcessLabel("Merging & matching…");
      setProcessSub("Overlap merge · fuzzy match · non-pantry filter");
      setProcessProgress(92);
      await new Promise((r) => setTimeout(r, 280));

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

      const autoUpdated = autoItems.filter(
        (i) => i.pantryMatch && (i.disposition === "merge" || i.disposition === "update")
      ).length;
      const autoAdded = autoItems.length - autoUpdated;

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

      const summary: ScanOutcomeSummary = {
        added: autoAdded,
        updated: autoUpdated,
        review: ambiguous.length,
        skipped: skippedNonFood,
      };

      if (ambiguous.length > 0) {
        setReviewItems(ambiguous);
        const parts: string[] = [];
        if (autoAdded > 0) parts.push(`Added ${autoAdded}`);
        if (autoUpdated > 0) parts.push(`Updated ${autoUpdated}`);
        parts.push(`${ambiguous.length} to review`);
        if (skippedNonFood > 0) parts.push(`${skippedNonFood} skipped`);
        showResultThen({
          ok: true,
          message: parts.join(" · "),
          next: "review",
          summary,
        });
      } else {
        setOutcomeSummary(summary);
        setResultOk(true);
        setResultMessage(
          autoItems.length > 0
            ? [
                autoAdded > 0
                  ? `Added ${autoAdded} item${autoAdded === 1 ? "" : "s"}`
                  : null,
                autoUpdated > 0
                  ? `Updated ${autoUpdated}`
                  : null,
                skippedNonFood > 0 ? `${skippedNonFood} non-food skipped` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Pantry updated"
            : skippedNonFood > 0
              ? "No pantry items on this receipt"
              : "Nothing to add"
        );
        hapticSuccess();
        setStep("result");
        clearResultTimer();
        resultTimerRef.current = setTimeout(() => {
          if (autoItems.length > 0) {
            offerExpiryAssist(autoItems, pantryBound);
          } else {
            stopCamera();
            onNavigateToPantry?.();
            handleClose();
          }
        }, 1450);
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
        setPhotos((prev) => {
          const next = [...prev, { id: createPhotoId(), dataUrl: prepared }];
          photosRef.current = next;
          return next;
        });
        hapticPhotoQueued();
      } catch {
        toast.error("Could not capture frame");
      } finally {
        requestAnimationFrame(() => setCapturing(false));
      }
    })();
  };

  const removePhoto = (id: string) => {
    hapticLight();
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      photosRef.current = next;
      return next;
    });
  };

  const retakeLastPhoto = () => {
    hapticLight();
    setPhotos((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice(0, -1);
      photosRef.current = next;
      return next;
    });
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
        setPhotos((prev) => {
          const merged = [...prev, ...next];
          photosRef.current = merged;
          return merged;
        });
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

  const batchKeepNonFood = () => {
    setReviewItems((prev) =>
      prev.map((i) =>
        i.possiblyNonFood
          ? { ...i, possiblyNonFood: false, disposition: "add_new" as const }
          : i
      )
    );
  };
  const batchDiscardNonFood = () => {
    setReviewItems((prev) => prev.filter((i) => !i.possiblyNonFood));
  };
  const batchKeepLowConf = () => {
    // Keep: clear nothing — items stay for confirm. Soft nudge: ensure disposition set.
    setReviewItems((prev) =>
      prev.map((i) =>
        !i.possiblyNonFood && i.confidence < AUTO_ADD_CONFIDENCE
          ? { ...i, disposition: i.disposition ?? (i.pantryMatch ? "merge" : "add_new") }
          : i
      )
    );
    toast.message("Kept low-confidence items", {
      description: "Confirm when ready — edit names if needed.",
    });
  };
  const batchDiscardLowConf = () => {
    setReviewItems((prev) =>
      prev.filter((i) => i.possiblyNonFood || i.confidence >= AUTO_ADD_CONFIDENCE)
    );
  };

  const confirmReview = () => {
    if (reviewItems.length === 0) {
      const autoOnly = detected.filter((i) => !reviewItems.some((r) => r.id === i.id));
      if (autoOnly.length > 0) {
        offerExpiryAssist(autoOnly, autoOnly);
      } else {
        if (detected.length > 0) saveReceiptSnapshot(detected, primaryImage);
        onNavigateToPantry?.();
        handleClose();
      }
      return;
    }

    const toAdd = reviewItems.map(({ id, confidence, ...rest }) => rest);
    if (toAdd.length > 0) {
      onItemsAdded(toAdd, { silent: true });
    }

    const reviewIds = new Set(reviewItems.map((r) => r.id));
    const autoPart = detected.filter((i) => !reviewIds.has(i.id));
    const allForReceipt = [...autoPart, ...reviewItems];

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

    pantryToastShownRef.current = true;
    toast.success("Pantry Updated", {
      description: parts.length
        ? parts.join(" · ") + " · saved in Finances"
        : "Receipt saved in Finances",
    });

    // Optional expiry photos for everything just confirmed + earlier auto-adds
    offerExpiryAssist([...autoPart, ...reviewItems], allForReceipt);
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
              ocrHealth={ocrHealth}
              ocrStatusMessage={ocrStatusMessage}
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
              onRetakeLast={retakeLastPhoto}
            />
          )}

          {step === "processing" && (
            <ReceiptProcessingStage
              processLabel={processLabel}
              processSub={processSub}
              processProgress={processProgress}
              photos={photos}
              photoStates={photoStates}
              phase={processPhase}
            />
          )}

          {step === "result" && (
            <ReceiptResultStage
              resultOk={resultOk}
              resultMessage={resultMessage}
              summary={outcomeSummary}
            />
          )}

          {step === "error" && (
            <ReceiptErrorStage
              errorMessage={errorMessage}
              photoCount={photoCount}
              onRetry={handleRetryFromError}
              onRetryProcess={() => void startProcessing(photosRef.current.length ? photosRef.current : photos)}
              onClearAndRetry={() => {
                setPhotos([]);
                photosRef.current = [];
                handleRetryFromError();
              }}
            />
          )}

          {step === "review" && (
            <ReceiptReviewStage
              reviewItems={reviewItems}
              onUpdateItem={updateReviewItem}
              onRemoveItem={removeReviewItem}
              onBatchKeepNonFood={batchKeepNonFood}
              onBatchDiscardNonFood={batchDiscardNonFood}
              onBatchKeepLowConf={batchKeepLowConf}
              onBatchDiscardLowConf={batchDiscardLowConf}
            />
          )}

          {step === "expiry-assist" && (
            <ReceiptExpiryAssistStage
              items={expiryCandidates}
              onSkip={leaveToPantry}
              onDone={finishExpiryAssist}
            />
          )}
        </div>

        {step === "review" && (
          <ReceiptReviewFooter
            reviewCount={reviewItems.length}
            onConfirm={confirmReview}
            onSkip={() => {
              const reviewIds = new Set(reviewItems.map((r) => r.id));
              const autoPart = detected.filter((i) => !reviewIds.has(i.id));
              if (autoPart.length > 0) {
                // Already added auto items earlier — offer optional labels, skip review lines
                offerExpiryAssist(autoPart, autoPart);
              } else {
                onNavigateToPantry?.();
                handleClose();
              }
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
