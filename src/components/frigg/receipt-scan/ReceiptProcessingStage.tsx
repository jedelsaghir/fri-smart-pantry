"use client";

import { Loader2, Check, Aperture, ScanText, GitMerge } from "lucide-react";
import type { CapturedPhoto } from "./types";
import { SafeImage } from "@/components/frigg/SafeImage";

export type PhotoProcessState = "pending" | "enhancing" | "reading" | "done" | "error";

export function ReceiptProcessingStage({
  processLabel,
  processSub,
  processProgress,
  photos,
  photoStates = [],
  phase = "enhance",
}: {
  processLabel: string;
  processSub: string;
  processProgress: number;
  photos: CapturedPhoto[];
  /** Per-photo pipeline state for multi-photo progressive UI */
  photoStates?: PhotoProcessState[];
  phase?: "enhance" | "read" | "merge";
}) {
  const phases = [
    {
      key: "enhance" as const,
      label: "Enhance",
      done: phase === "read" || phase === "merge" || processProgress >= 40,
      active: phase === "enhance" || processProgress < 40,
      icon: Aperture,
    },
    {
      key: "read" as const,
      label: "Read",
      done: phase === "merge" || processProgress >= 90,
      active: phase === "read" || (processProgress >= 40 && processProgress < 90),
      icon: ScanText,
    },
    {
      key: "merge" as const,
      label: "Merge",
      done: processProgress >= 100,
      active: phase === "merge" || (processProgress >= 90 && processProgress < 100),
      icon: GitMerge,
    },
  ];

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
            {phase === "enhance" || processProgress < 40 ? (
              <Aperture className="size-7 text-brand animate-pulse" />
            ) : phase === "merge" || processProgress >= 90 ? (
              <GitMerge className="size-7 text-brand animate-pulse" />
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

      <div className="flex flex-wrap justify-center gap-1.5 mb-5 max-w-[320px]">
        {phases.map((s) => {
          const Icon = s.icon;
          return (
            <span
              key={s.label}
              className={
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition " +
                (s.active
                  ? "bg-brand/15 text-brand ring-1 ring-brand/20"
                  : s.done
                    ? "bg-[color-mix(in_oklab,var(--color-fresh)_14%,var(--color-secondary))] text-[var(--color-fresh)]"
                    : "bg-secondary/60 text-muted-foreground/70")
              }
            >
              {s.done && !s.active ? (
                "✓ "
              ) : s.active ? (
                <Icon className="size-3 opacity-80" />
              ) : null}
              {s.label}
            </span>
          );
        })}
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
        <div className="flex justify-center gap-2 flex-wrap max-w-[300px]">
          {photos.map((p, i) => {
            const state: PhotoProcessState =
              photoStates[i] ||
              (processProgress >= 40 + ((i + 1) / Math.max(1, photos.length)) * 50
                ? "done"
                : processProgress >= 40
                  ? "reading"
                  : "pending");
            const done = state === "done";
            const active = state === "enhancing" || state === "reading";
            return (
              <div key={p.id} className="flex flex-col items-center gap-1">
                <div
                  className={
                    "relative size-12 overflow-hidden rounded-lg ring-1 transition " +
                    (done
                      ? "ring-brand/40 opacity-100"
                      : active
                        ? "ring-brand/60 opacity-100"
                        : "ring-border/40 opacity-75")
                  }
                >
                  <SafeImage src={p.dataUrl} alt="" className="size-full object-cover" />
                  {done && (
                    <div className="absolute inset-0 grid place-items-center bg-black/30">
                      <Check className="size-4 text-white" strokeWidth={2.5} />
                    </div>
                  )}
                  {active && (
                    <div className="absolute inset-0 grid place-items-center bg-black/25">
                      <Loader2 className="size-4 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-medium text-muted-foreground capitalize">
                  {state === "pending"
                    ? "Waiting"
                    : state === "enhancing"
                      ? "Enhance"
                      : state === "reading"
                        ? "Read"
                        : state === "error"
                          ? "Retry"
                          : "Done"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type ScanOutcomeSummary = {
  added: number;
  updated: number;
  review: number;
  skipped: number;
  /** M-05: photos that failed OCR while others succeeded */
  photoErrors?: number;
  /** M-06 */
  totalMismatch?: { lineSum: number; receiptTotal: number };
};

export function ReceiptResultStage({
  resultOk,
  resultMessage,
  summary,
}: {
  resultOk: boolean;
  resultMessage: string;
  summary?: ScanOutcomeSummary | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] text-center px-4 animate-in fade-in duration-500">
      <div
        className={
          "mx-auto mb-5 grid size-[4.75rem] place-items-center rounded-[1.75rem] text-3xl shadow-[0_1px_0_0_oklch(1_0_0/0.5)_inset,0_12px_28px_-12px_oklch(0.2_0.02_150/0.18)] transition-transform duration-500 " +
          (resultOk
            ? "bg-[color-mix(in_oklab,var(--color-fresh)_14%,var(--color-card))] text-[var(--color-fresh)] scale-100"
            : "bg-destructive/10 text-destructive")
        }
      >
        {resultOk ? <Check className="size-9" strokeWidth={2.25} /> : "!"}
      </div>
      <p className="font-display text-[1.35rem] font-medium tracking-[-0.02em]">
        {resultOk ? "All set" : "Couldn’t finish"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-xs">{resultMessage}</p>

      {resultOk && summary?.photoErrors && summary.photoErrors > 0 && (
        <p className="mt-3 max-w-xs rounded-2xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
          {summary.photoErrors} photo{summary.photoErrors === 1 ? "" : "s"} couldn’t be read —
          other photos were still used. You can retake those sections.
        </p>
      )}
      {resultOk && summary?.totalMismatch && (
        <p className="mt-2 max-w-xs rounded-2xl bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground leading-snug">
          Line items sum ≈ {summary.totalMismatch.lineSum.toFixed(2)} but receipt total is{" "}
          {summary.totalMismatch.receiptTotal.toFixed(2)}. Double-check review if needed.
        </p>
      )}

      {resultOk && summary && (summary.added > 0 || summary.updated > 0 || summary.skipped > 0 || summary.review > 0) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-xs">
          {summary.added > 0 && (
            <span className="rounded-full bg-brand/12 px-2.5 py-1 text-[11px] font-semibold text-brand tabular-nums">
              {summary.added} added
            </span>
          )}
          {summary.updated > 0 && (
            <span className="rounded-full bg-sky-500/12 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
              {summary.updated} updated
            </span>
          )}
          {summary.review > 0 && (
            <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
              {summary.review} to review
            </span>
          )}
          {summary.skipped > 0 && (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground tabular-nums">
              {summary.skipped} skipped
            </span>
          )}
        </div>
      )}

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
  onRetryProcess,
  onClearAndRetry,
}: {
  errorMessage: string | null;
  photoCount: number;
  onRetry: () => void;
  /** Re-run OCR on the same photos (one-tap recovery) */
  onRetryProcess?: () => void;
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
      {photoCount > 0 && onRetryProcess && (
        <button
          type="button"
          onClick={onRetryProcess}
          className="mt-6 w-full max-w-xs rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985]"
        >
          Retry processing
        </button>
      )}
      <button
        type="button"
        onClick={onRetry}
        className={
          "w-full max-w-xs rounded-3xl py-3.5 text-sm font-semibold " +
          (photoCount > 0 && onRetryProcess
            ? "mt-2 border border-border bg-card text-foreground active:bg-secondary/60"
            : "mt-6 bg-brand text-brand-foreground")
        }
      >
        {photoCount > 0 ? "Back to capture" : "Retry capture"}
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
