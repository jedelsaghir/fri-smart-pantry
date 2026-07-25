"use client";

import type { RefObject } from "react";
import { Image as ImageIcon, X, Sparkles } from "lucide-react";
import type { CaptureQuality } from "@/lib/capture-quality";
import type { CapturedPhoto } from "./types";

export function ReceiptCaptureStage({
  ocrConfigured,
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
}: {
  ocrConfigured: boolean | null;
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
}) {
  const photoCount = photos.length;

  return (
      <div className="flex flex-col flex-1 min-h-0">
        {ocrConfigured === false && (
          <div className="mx-5 mt-3 mb-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] leading-snug text-foreground/90">
            <span className="font-semibold">OCR not configured.</span> Set{" "}
            <code className="text-[11px]">XAI_API_KEY</code> on the server to read real receipts.
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
              <div className="pointer-events-none absolute inset-0 z-20 bg-white/80 animate-[fadeOut_0.2s_ease-out_forwards]" />
              <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
                <div className="size-24 rounded-full border-2 border-white/90 animate-[shutterRing_0.35s_ease-out_forwards]" />
              </div>
            </>
          )}

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
