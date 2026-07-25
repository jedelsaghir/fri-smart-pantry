"use client";

import { Loader2, Check, Aperture } from "lucide-react";
import type { CapturedPhoto } from "./types";

export function ReceiptProcessingStage({
  processLabel,
  processSub,
  processProgress,
  photos,
}: {
  processLabel: string;
  processSub: string;
  processProgress: number;
  photos: CapturedPhoto[];
}) {
  return (
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
            const done = processProgress >= 40 + ((i + 1) / Math.max(1, photos.length)) * 50;
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
  );
}

export function ReceiptResultStage({
  resultOk,
  resultMessage,
}: {
  resultOk: boolean;
  resultMessage: string;
}) {
  return (
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
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-xs">{resultMessage}</p>
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
  );
}

export function ReceiptErrorStage({
  errorMessage,
  photoCount,
  onRetry,
  onClearAndRetry,
}: {
  errorMessage: string | null;
  photoCount: number;
  onRetry: () => void;
  onClearAndRetry: () => void;
}) {
  return (
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
        onClick={onRetry}
        className="mt-6 w-full max-w-xs rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground"
      >
        Retry capture
      </button>
      {photoCount > 0 && (
        <button
          type="button"
          onClick={onClearAndRetry}
          className="mt-2 w-full max-w-xs py-2.5 text-sm font-medium text-muted-foreground"
        >
          Clear photos &amp; start over
        </button>
      )}
    </div>
  );
}
