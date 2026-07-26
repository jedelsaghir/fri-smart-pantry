"use client";

import type { RefObject } from "react";
import { Image as ImageIcon, X, Sparkles, RotateCcw, ChevronDown } from "lucide-react";
import type { CaptureQuality } from "@/lib/capture-quality";
import type { CapturedPhoto } from "./types";

export function ReceiptCaptureStage({
  ocrConfigured,
  ocrHealth = null,
  ocrStatusMessage = null,
  cameraOn,
  cameraError,
  videoRef,
  fileInputRef,
  photos,
  captureQuality,
  shutterFlash,
  shutterPulse,
  capturing,
  onStartCamera,
  onShutter,
  onProcess,
  onUpload,
  onRemovePhoto,
  onRetakeLast,
}: {
  ocrConfigured: boolean | null;
  /** missing | ok | auth_failed | network | model | error | unknown */
  ocrHealth?:
    | "missing"
    | "ok"
    | "auth_failed"
    | "network"
    | "model"
    | "error"
    | "unknown"
    | null;
  /** Safe short message from server health check (never includes the key). */
  ocrStatusMessage?: string | null;
  cameraOn: boolean;
  cameraError: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  photos: CapturedPhoto[];
  captureQuality: CaptureQuality | null;
  shutterFlash: boolean;
  shutterPulse: boolean;
  capturing: boolean;
  onStartCamera: () => void;
  onShutter: () => void;
  onProcess: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (id: string) => void;
  onRetakeLast: () => void;
}) {
  const photoCount = photos.length;
  const qualityOk = captureQuality?.ok;
  const qualityWarn = captureQuality && !captureQuality.ok;

  const showOcrBanner =
    ocrHealth != null &&
    ocrHealth !== "ok" &&
    (ocrConfigured === false ||
      ocrHealth === "missing" ||
      ocrHealth === "auth_failed" ||
      ocrHealth === "network" ||
      ocrHealth === "model" ||
      ocrHealth === "error" ||
      ocrHealth === "unknown");

  const bannerTitle =
    ocrHealth === "missing"
      ? "OCR not configured"
      : ocrHealth === "auth_failed"
        ? "OCR key rejected"
        : ocrHealth === "network"
          ? "OCR network issue"
          : ocrHealth === "model"
            ? "OCR model issue"
            : ocrHealth === "unknown"
              ? "OCR status unknown"
              : ocrHealth === "error"
                ? "OCR health check failed"
                : "OCR notice";

  const bannerTone =
    ocrHealth === "missing" || ocrHealth === "auth_failed"
      ? "border-amber-500/30 bg-amber-500/10"
      : "border-sky-500/25 bg-sky-500/10";

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {showOcrBanner && (
        <div
          className={
            "mx-5 mt-3 mb-2 rounded-2xl border px-3.5 py-2.5 text-[12px] leading-snug text-foreground/90 " +
            bannerTone
          }
        >
          <span className="font-semibold">{bannerTitle}.</span>{" "}
          {ocrStatusMessage ||
            (ocrConfigured === false
              ? "Set XAI_API_KEY on the server (not VITE_*) to read real receipts."
              : "Check server OCR settings.")}
        </div>
      )}

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
            <p className="text-base font-medium text-foreground">Point at the receipt</p>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-[260px]">
              Take multiple photos for long receipts — no pause between shots
            </p>
            <button
              type="button"
              onClick={() => void onStartCamera()}
              className="mt-5 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground active:scale-[0.98]"
            >
              Open camera
            </button>
          </div>
        )}

        {shutterFlash && (
          <>
            <div className="pointer-events-none absolute inset-0 z-20 bg-white animate-[fadeOut_0.22s_ease-out_forwards]" />
            <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
              <div className="size-28 rounded-full border-[3px] border-white/95 shadow-[0_0_40px_rgba(255,255,255,0.45)] animate-[shutterRing_0.4s_ease-out_forwards]" />
              <div className="absolute size-16 rounded-full border border-white/50 animate-[shutterRing_0.45s_ease-out_0.05s_forwards]" />
            </div>
          </>
        )}

        {cameraOn && (
          <div
            className={
              "pointer-events-none absolute inset-5 rounded-2xl border-2 transition-all duration-300 " +
              (qualityWarn
                ? "border-amber-300/85 shadow-[0_0_0_1px_rgba(251,191,36,0.2),inset_0_0_48px_rgba(0,0,0,0.14)]"
                : qualityOk
                  ? "border-emerald-300/50 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
                  : "border-white/35 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]")
            }
          />
        )}

        {/* Live quality guidance */}
        {cameraOn && captureQuality?.message && (
          <div className="absolute left-3 right-3 top-3 z-10 flex flex-col items-center gap-1.5 px-1">
            {captureQuality.issueLabel && (
              <span className="rounded-full border border-amber-300/35 bg-amber-500/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-50 backdrop-blur-md">
                {captureQuality.issueLabel}
              </span>
            )}
            <div className="max-w-[min(100%,320px)] rounded-full border border-white/10 bg-black/65 px-3.5 py-1.5 text-center text-[12px] font-medium leading-snug text-white/95 shadow-lg backdrop-blur-md">
              {captureQuality.message}
            </div>
          </div>
        )}
        {cameraOn && captureQuality?.ok && !captureQuality.message && (
          <div className="absolute left-3 right-3 top-3 z-10 flex justify-center">
            <div className="rounded-full border border-emerald-400/30 bg-black/50 px-3 py-1 text-[11px] font-medium text-emerald-100/95 backdrop-blur-md">
              Looking good — snap when ready
            </div>
          </div>
        )}

        {/* Long-receipt gentle hint after first capture */}
        {cameraOn && photoCount >= 1 && (
          <div className="absolute bottom-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
            <div className="flex items-center gap-1.5 rounded-full border border-white/12 bg-black/55 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-md">
              <ChevronDown className="size-3.5 opacity-80 animate-bounce" />
              Move down for the next section
            </div>
          </div>
        )}

        {cameraError && (
          <p className="absolute bottom-2 left-3 right-3 text-center text-[11px] text-amber-200 drop-shadow">
            {cameraError}
          </p>
        )}
      </div>

      {photoCount > 0 && (
        <div className="border-t border-border/50 bg-background/95 px-3 py-2.5">
          <div className="mb-1.5 flex items-center justify-between px-0.5 gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {photoCount} photo{photoCount === 1 ? "" : "s"} ready
            </span>
            <button
              type="button"
              onClick={onRetakeLast}
              className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-[11px] font-semibold text-foreground active:bg-secondary"
            >
              <RotateCcw className="size-3" />
              Retake last
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className={
                  "relative shrink-0 size-16 overflow-hidden rounded-xl ring-1 bg-secondary animate-[thumbPop_0.28s_ease-out] " +
                  (index === photoCount - 1 ? "ring-brand/50" : "ring-border/50")
                }
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
                  onClick={() => onRemovePhoto(photo.id)}
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

      <div className="space-y-2.5 px-5 pt-3 pb-2 bg-background">
        {cameraOn && (
          <button
            type="button"
            onClick={onShutter}
            disabled={capturing}
            className={
              "relative w-full flex items-center justify-center gap-3 rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground shadow-[0_10px_28px_-12px_color-mix(in_oklab,var(--color-brand)_55%,transparent)] active:scale-[0.96] active:brightness-110 transition touch-manipulation disabled:opacity-80 " +
              (shutterPulse ? "scale-[0.96] brightness-110" : "")
            }
          >
            <span className="relative grid size-9 place-items-center">
              {shutterPulse && (
                <span className="absolute inset-[-4px] rounded-full border-2 border-brand-foreground/40 animate-[shutterRing_0.4s_ease-out_forwards]" />
              )}
              <span
                className={
                  "grid size-9 place-items-center rounded-full border-2 border-brand-foreground/90 transition-transform " +
                  (shutterPulse ? "scale-90" : "")
                }
              >
                <span
                  className={
                    "size-5 rounded-full bg-brand-foreground/95 transition-transform " +
                    (shutterPulse ? "scale-75" : "")
                  }
                />
              </span>
            </span>
            {capturing ? "Capturing…" : photoCount === 0 ? "Capture" : "Capture next"}
          </button>
        )}

        <button
          type="button"
          disabled={photoCount === 0}
          onClick={onProcess}
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
            onChange={onUpload}
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
  );
}
