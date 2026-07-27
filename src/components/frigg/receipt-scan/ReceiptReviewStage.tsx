"use client";

import { Check, Trash2 } from "lucide-react";
import type { DetectedItem, ReviewDisposition, StorageKey } from "@/types/pantry";
import { BarcodeAssistButton } from "@/components/frigg/BarcodeAssistButton";
import { confidenceBand, type ConfidenceBand } from "@/lib/ocr-parse";
import { AUTO_ADD_CONFIDENCE } from "@/lib/ocr-merge";
import { formatMoney } from "@/lib/money";
import { convertQty, mergeQuantities } from "@/lib/units";
import { formatStorageLabel } from "./types";

function ConfidenceChip({ confidence }: { confidence: number }) {
  const band: ConfidenceBand = confidenceBand(confidence);
  const pct = Math.round(confidence * 100);
  const styles =
    band === "high"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
      : band === "medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
        : "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300";
  const label = band === "high" ? "High" : band === "medium" ? "Medium" : "Low";
  return (
    <span className={`rounded-full px-2 py-px text-[10px] font-semibold tabular-nums ${styles}`}>
      {label} · {pct}%
    </span>
  );
}

export function ReceiptReviewStage({
  reviewItems,
  onUpdateItem,
  onRemoveItem,
  onBatchKeepNonFood,
  onBatchDiscardNonFood,
  onBatchKeepLowConf,
  onBatchDiscardLowConf,
}: {
  reviewItems: DetectedItem[];
  onUpdateItem: (id: string, updates: Partial<DetectedItem>) => void;
  onRemoveItem: (id: string) => void;
  onBatchKeepNonFood?: () => void;
  onBatchDiscardNonFood?: () => void;
  onBatchKeepLowConf?: () => void;
  onBatchDiscardLowConf?: () => void;
}) {
  const nonFoodCount = reviewItems.filter((i) => i.possiblyNonFood).length;
  const lowConfCount = reviewItems.filter(
    (i) => !i.possiblyNonFood && i.confidence < AUTO_ADD_CONFIDENCE
  ).length;

  return (
    <div>
      <div className="mb-4">
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

      {(nonFoodCount > 1 || lowConfCount > 1) && (
        <div className="mb-4 space-y-2 rounded-2xl border border-border/50 bg-secondary/30 px-3 py-2.5">
          {nonFoodCount > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                {nonFoodCount} possible non-food
              </span>
              <button
                type="button"
                onClick={onBatchKeepNonFood}
                className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand active:bg-brand/25"
              >
                Keep all
              </button>
              <button
                type="button"
                onClick={onBatchDiscardNonFood}
                className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground border border-border/60 active:bg-secondary"
              >
                Discard all
              </button>
            </div>
          )}
          {lowConfCount > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                {lowConfCount} low confidence
              </span>
              {/* L-04: discard is the primary batch action for weak reads */}
              <button
                type="button"
                onClick={onBatchDiscardLowConf}
                className="rounded-full bg-brand/15 px-2.5 py-1 text-[11px] font-semibold text-brand active:bg-brand/25"
              >
                Discard all low
              </button>
              <button
                type="button"
                onClick={onBatchKeepLowConf}
                className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground border border-border/60 active:bg-secondary"
              >
                Keep all for confirm
              </button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3 pb-4">
        {reviewItems.map((item) => {
          const match = item.pantryMatch;
          const disposition: ReviewDisposition =
            item.disposition ?? (match ? "merge" : "add_new");
          const isNonFoodSuspect = !!item.possiblyNonFood;
          const mergePreview =
            match && disposition === "merge"
              ? mergeQuantities(match.qty, match.unit, item.qty, item.unit)
              : null;
          const resultQtyPreview =
            mergePreview?.qty ??
            (match && disposition === "merge"
              ? match.qty + item.qty
              : disposition === "update"
                ? item.qty
                : item.qty);
          const resultUnitPreview = mergePreview?.unit ?? match?.unit ?? item.unit;
          const addedInMatchUnit =
            match && disposition === "merge"
              ? convertQty(item.qty, item.unit, match.unit) ?? item.qty
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
                    <ConfidenceChip confidence={item.confidence} />
                    {isNonFoodSuspect && (
                      <span className="rounded-full bg-violet-100 dark:bg-violet-500/15 px-2 py-px text-[10px] font-medium text-violet-800 dark:text-violet-300">
                        Possibly non-food
                        {item.nonFoodReason ? ` · ${item.nonFoodReason}` : ""}
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
                    onChange={(e) => onUpdateItem(item.id, { name: e.target.value })}
                    className="w-full bg-transparent text-[15px] font-semibold tracking-[-0.01em] outline-none border-b border-transparent focus:border-border/50 pb-0.5"
                  />

                  <div className="mt-1.5">
                    <BarcodeAssistButton
                      label="Barcode"
                      className="inline-flex items-center gap-1 rounded-xl border border-border/50 bg-secondary/40 px-2 py-1 text-[11px] font-semibold text-muted-foreground active:bg-secondary"
                      onPrefill={(r) => {
                        onUpdateItem(item.id, {
                          ...(r.name ? { name: r.name } : {}),
                          ...(r.unit ? { unit: r.unit } : {}),
                          ...(r.emoji ? { emoji: r.emoji } : {}),
                        });
                      }}
                    />
                  </div>

                  {isNonFoodSuspect && (
                    <div className="mt-2.5 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2.5">
                      <p className="text-[12px] leading-snug text-muted-foreground">
                        This doesn’t look like fridge, freezer, or pantry stock. Keep it only if you
                        want it tracked.
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateItem(item.id, {
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
                          onClick={() => onRemoveItem(item.id)}
                          className="flex-1 rounded-2xl border border-border/60 bg-background/80 py-2 text-[12px] font-semibold text-foreground transition active:scale-[0.98]"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

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
                          Update → {resultQtyPreview} {resultUnitPreview} (+
                          {addedInMatchUnit} {match.unit})
                        </p>
                      )}

                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateItem(item.id, { disposition: "merge" })}
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
                          onClick={() => onUpdateItem(item.id, { disposition: "add_new" })}
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
                        onClick={() => onUpdateItem(item.id, { qty: Math.max(1, item.qty - 1) })}
                        className="touch-target grid size-8 place-items-center rounded-full active:bg-background/70"
                      >
                        –
                      </button>
                      <span className="w-7 text-center text-sm font-semibold tabular-nums">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateItem(item.id, { qty: item.qty + 1 })}
                        className="touch-target grid size-8 place-items-center rounded-full active:bg-background/70"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-xs text-muted-foreground">{item.unit}</div>
                    {typeof item.price === "number" && (
                      <div className="text-xs font-medium tabular-nums">
                        {formatMoney(item.price, "EUR")}
                      </div>
                    )}

                    <div className="flex-1 min-w-[148px]">
                      <div className="inline-flex rounded-2xl bg-secondary/70 p-0.5 text-xs font-semibold">
                        {(["fridge", "freezer", "pantry"] as StorageKey[]).map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => onUpdateItem(item.id, { storage: s })}
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
                      onClick={() => onRemoveItem(item.id)}
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
  );
}

export function ReceiptReviewFooter({
  reviewCount,
  onConfirm,
  onSkip,
}: {
  reviewCount: number;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="border-t border-border/60 bg-background px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onConfirm}
        disabled={reviewCount === 0}
        className="w-full rounded-3xl bg-brand py-4 text-lg font-semibold text-brand-foreground active:scale-[0.985] disabled:opacity-60 transition disabled:active:scale-100 flex items-center justify-center gap-2"
      >
        <Check className="size-5" />
        Confirm {reviewCount} item{reviewCount === 1 ? "" : "s"}
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="mt-2.5 w-full py-2 text-sm font-medium text-muted-foreground active:text-foreground"
      >
        Skip for now
      </button>
    </div>
  );
}

export function ReceiptRemoveConfirmDialog({
  itemName,
  onCancel,
  onConfirm,
}: {
  itemName: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-background p-5 shadow-xl">
        <p className="font-display text-lg font-medium tracking-tight">Remove {itemName}?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This drops it from the review list only. Already-added high-confidence items stay in the
          pantry.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-2xl border py-2.5 text-sm font-semibold"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 rounded-2xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground"
            onClick={onConfirm}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
