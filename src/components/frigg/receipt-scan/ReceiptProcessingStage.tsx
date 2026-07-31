"use client";

import { Loader2, Check, Aperture, ScanText, GitMerge, PackageSearch } from "lucide-react";
import type { CapturedPhoto } from "./types";
import { SafeImage } from "@/components/frigg/SafeImage";
import { sectionLabel } from "@/lib/receipt-coverage";

export type PhotoProcessState = "pending" | "enhancing" | "reading" | "done" | "error";

export type ProcessPipelinePhase = "enhance" | "read" | "merge" | "match";

const PHASE_ORDER: ProcessPipelinePhase[] = ["enhance", "read", "merge", "match"];

function phaseIndex(phase: ProcessPipelinePhase): number {
  return Math.max(0, PHASE_ORDER.indexOf(phase));
}

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
  phase?: ProcessPipelinePhase;
}) {
  const activeIdx = phaseIndex(phase);
  const phases = [
    {
      key: "enhance" as const,
      label: "Enhancing photos",
      short: "Enhance",
      done: activeIdx > 0 || processProgress >= 35,
      active: phase === "enhance",
      icon: Aperture,
    },
    {
      key: "read" as const,
      label: "Reading lines",
      short: "Read",
      done: activeIdx > 1 || processProgress >= 85,
      active: phase === "read",
      icon: ScanText,
    },
    {
      key: "merge" as const,
      label: "Merging sections",
      short: "Merge",
      done: activeIdx > 2 || processProgress >= 94,
      active: phase === "merge",
      icon: GitMerge,
    },
    {
      key: "match" as const,
      label: "Matching pantry",
      short: "Match",
      done: processProgress >= 100,
      active: phase === "match",
      icon: PackageSearch,
    },
  ];

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-2 pt-4 text-center">
      <div className="relative mb-6 size-28">
        <div className="absolute inset-0 rounded-full border-2 border-brand/12" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
        <div
          className="absolute inset-3 animate-spin rounded-full border-2 border-transparent border-b-[var(--color-fresh)]"
          style={{ animationDuration: "1.05s", animationDirection: "reverse" }}
        />
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-secondary/85 shadow-inner">
            {phase === "enhance" ? (
              <Aperture className="size-7 animate-pulse text-brand" />
            ) : phase === "merge" ? (
              <GitMerge className="size-7 animate-pulse text-brand" />
            ) : phase === "match" ? (
              <PackageSearch className="size-7 animate-pulse text-brand" />
            ) : (
              <Loader2 className="size-7 animate-spin text-brand" />
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-1.5">
        <p className="text-xl font-semibold tracking-tight">{processLabel}</p>
        <p className="mx-auto max-w-[280px] text-sm leading-relaxed text-muted-foreground">
          {processSub}
        </p>
      </div>

      {/* Stepped pipeline — tied to real enhance → read → merge → match */}
      <div className="mb-5 flex max-w-[340px] flex-wrap justify-center gap-1.5">
        {phases.map((s) => {
          const Icon = s.icon;
          return (
            <span
              key={s.key}
              className={
                "inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition " +
                (s.active
                  ? "bg-brand/15 text-brand ring-1 ring-brand/25"
                  : s.done
                    ? "bg-[color-mix(in_oklab,var(--color-fresh)_14%,var(--color-secondary))] text-[var(--color-fresh)]"
                    : "bg-secondary/60 text-muted-foreground/70")
              }
            >
              {s.done && !s.active ? (
                <Check className="size-3" strokeWidth={2.5} />
              ) : s.active ? (
                <Icon className="size-3 opacity-80" />
              ) : null}
              {s.short}
            </span>
          );
        })}
      </div>

      {/* Coverage strip → calm step dots during process */}
      <div className="mb-6 flex items-center gap-1.5" aria-hidden>
        {phases.map((s) => (
          <div
            key={`dot-${s.key}`}
            className={
              "h-1.5 rounded-full transition-all duration-300 " +
              (s.active
                ? "w-6 bg-brand"
                : s.done
                  ? "w-3 bg-[var(--color-fresh)]"
                  : "w-2 bg-secondary")
            }
          />
        ))}
      </div>

      <div className="mb-2 flex w-full max-w-[260px] items-center justify-between text-[11px] font-medium tabular-nums text-muted-foreground">
        <span>Progress</span>
        <span>{Math.min(100, Math.round(processProgress))}%</span>
      </div>
      <div className="mb-8 h-2 w-full max-w-[260px] overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${Math.min(100, processProgress)}%`,
            background:
              "linear-gradient(90deg, var(--color-brand), color-mix(in oklab, var(--color-fresh) 70%, var(--color-brand)))",
          }}
        />
      </div>

      {photos.length > 0 && (
        <div className="flex max-w-[300px] flex-wrap justify-center gap-2">
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
            const label = sectionLabel(p.sectionIndex ?? i);
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
                      <Loader2 className="size-4 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-medium text-muted-foreground">
                  {label} ·{" "}
                  {state === "pending"
                    ? "Wait"
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
    <div className="flex min-h-[360px] flex-col items-center justify-center px-4 text-center animate-in fade-in duration-500">
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
        {resultOk ? "Receipt complete" : "Couldn’t finish"}
      </p>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{resultMessage}</p>

      {resultOk && summary?.photoErrors && summary.photoErrors > 0 && (
        <p className="mt-3 max-w-xs rounded-2xl bg-amber-500/10 px-3 py-2 text-[11px] leading-snug text-amber-900 dark:text-amber-200">
          {summary.photoErrors} photo{summary.photoErrors === 1 ? "" : "s"} couldn’t be read —
          other photos were still used. You can retake those sections.
        </p>
      )}
      {resultOk && summary?.totalMismatch && (
        <p className="mt-2 max-w-xs rounded-2xl bg-secondary/60 px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          Line items sum ≈ {summary.totalMismatch.lineSum.toFixed(2)} but receipt total is{" "}
          {summary.totalMismatch.receiptTotal.toFixed(2)}. Double-check review if needed.
        </p>
      )}

      {resultOk &&
        summary &&
        (summary.added > 0 ||
          summary.updated > 0 ||
          summary.skipped > 0 ||
          summary.review > 0) && (
          <div className="mt-5 flex max-w-xs flex-wrap justify-center gap-2">
            {summary.added > 0 && (
              <span className="rounded-full bg-brand/12 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-brand">
                {summary.added} added
              </span>
            )}
            {summary.updated > 0 && (
              <span className="rounded-full bg-sky-500/12 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-sky-700 dark:text-sky-300">
                {summary.updated} updated
              </span>
            )}
            {summary.review > 0 && (
              <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-amber-800 dark:text-amber-300">
                {summary.review} to review
              </span>
            )}
            {summary.skipped > 0 && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {summary.skipped} skipped
              </span>
            )}
          </div>
        )}

      <div className="mt-8 flex gap-1.5">
        <span className="size-1.5 animate-pulse rounded-full bg-brand/60" />
        <span className="size-1.5 rounded-full bg-brand/30" />
        <span className="size-1.5 rounded-full bg-brand/20" />
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
    <div className="flex min-h-[360px] flex-col items-center justify-center px-2 text-center">
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-secondary text-3xl">
        📄
      </div>
      <p className="text-lg font-semibold tracking-tight">Couldn’t read that receipt</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {errorMessage ||
          "Blurry, incomplete, or poorly lit shots can't be read. Retake with good light and fill the frame."}
      </p>
      <ul className="mt-4 max-w-xs space-y-1.5 text-left text-[12px] text-muted-foreground">
        <li>· Hold steady — avoid motion blur</li>
        <li>· Fill the frame with the receipt</li>
        <li>· Use even light; avoid heavy glare</li>
        <li>· Long receipts: a few clear sections work best</li>
      </ul>
      {photoCount > 0 && onRetryProcess && (
        <button
          type="button"
          onClick={onRetryProcess}
          className="mt-6 min-h-11 w-full max-w-xs rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985]"
        >
          Retry processing
        </button>
      )}
      <button
        type="button"
        onClick={onRetry}
        className={
          "min-h-11 w-full max-w-xs rounded-3xl py-3.5 text-sm font-semibold " +
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
          className="mt-2 min-h-11 w-full max-w-xs py-2.5 text-sm font-medium text-muted-foreground"
        >
          Clear photos &amp; start over
        </button>
      )}
    </div>
  );
}
