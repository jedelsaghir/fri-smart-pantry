"use client";

import { Plus, ScanLine } from "lucide-react";
import type { StorageKey } from "@/types/pantry";

/** Empty fridge / freezer / pantry state — extracted from PantryScreen (H-13). */
export function PantryEmptyState({
  label,
  onAdd,
  onScan,
}: {
  label: StorageKey;
  onAdd?: () => void;
  onScan?: () => void;
}) {
  const copy =
    label === "freezer"
      ? {
          emoji: "🧊",
          kicker: "Freezer",
          title: "Cold storage, calmly empty",
          body: "Park leftovers and bulk buys here. A single add — or a receipt scan — is all it takes.",
          accent: "oklch(0.72 0.08 230)",
          floatA: "❄️",
          floatB: "🥩",
        }
      : label === "pantry"
        ? {
            emoji: "🫙",
            kicker: "Pantry",
            title: "Room for the staples",
            body: "Oils, grains, and dry goods live here. Start light — one jar, or a whole receipt.",
            accent: "oklch(0.78 0.08 85)",
            floatA: "🍝",
            floatB: "🫒",
          }
        : {
            emoji: "🥛",
            kicker: "Fridge",
            title: "Fresh space, ready for you",
            body: "Your calm inventory starts here. Add a few favorites, or scan dinner’s ingredients.",
            accent: "oklch(0.72 0.09 183)",
            floatA: "🥚",
            floatB: "🧀",
          };

  return (
    <div className="relative mt-6 flex flex-col items-center px-1 pb-6 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-2 h-56 w-56 -translate-x-1/2 rounded-full opacity-80 blur-3xl dark:opacity-50"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${copy.accent} 42%, transparent), transparent 68%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-[20%] top-20 h-24 w-24 rounded-full opacity-50 blur-2xl dark:opacity-30"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, var(--color-brand) 18%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[18%] top-24 h-20 w-20 rounded-full opacity-40 blur-2xl dark:opacity-25"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${copy.accent} 30%, transparent), transparent 70%)`,
        }}
        aria-hidden
      />

      <div className="relative mt-2 mb-1">
        <div
          className="absolute -inset-5 rounded-full opacity-70 animate-[emptyGlow_5s_ease-in-out_infinite]"
          style={{
            background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${copy.accent} 32%, transparent), transparent 65%)`,
          }}
          aria-hidden
        />
        <div
          className="absolute -left-8 top-2 grid size-11 place-items-center rounded-2xl border border-border/45 bg-card/85 text-lg shadow-[0_8px_20px_-10px_oklch(0.2_0.02_150/0.25)] backdrop-blur-md animate-[emptyFloat_5.8s_ease-in-out_infinite] dark:bg-card/70"
          aria-hidden
        >
          {copy.floatA}
        </div>
        <div
          className="absolute -right-7 bottom-1 grid size-10 place-items-center rounded-2xl border border-border/40 bg-card/80 text-base shadow-[0_8px_20px_-10px_oklch(0.2_0.02_150/0.22)] backdrop-blur-md animate-[emptyFloat_6.4s_ease-in-out_infinite_reverse] dark:bg-card/65"
          aria-hidden
        >
          {copy.floatB}
        </div>
        <div className="relative grid size-[5.75rem] place-items-center rounded-[1.85rem] border border-border/55 bg-card text-[2.75rem] leading-none shadow-[0_1px_0_0_oklch(1_0_0/0.85)_inset,0_14px_36px_-14px_oklch(0.2_0.02_150/0.2),0_32px_56px_-24px_oklch(0.2_0.02_150/0.14)] dark:shadow-[0_1px_0_0_oklch(1_0_0/0.08)_inset,0_14px_36px_-14px_oklch(0_0_0/0.45)]">
          <span className="select-none drop-shadow-sm" role="img" aria-hidden>
            {copy.emoji}
          </span>
          <span
            className="pointer-events-none absolute inset-0 rounded-[1.85rem]"
            style={{
              background:
                "linear-gradient(155deg, oklch(1 0 0 / 0.58) 0%, transparent 45%, transparent 100%)",
            }}
            aria-hidden
          />
        </div>
      </div>

      <div className="relative mt-7 max-w-[300px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/75">
          {copy.kicker}
        </p>
        <p className="mt-2 font-display text-[1.45rem] font-medium leading-[1.12] tracking-[-0.025em] text-foreground/95">
          {copy.title}
        </p>
        <p className="mt-2.5 text-[13.5px] leading-[1.55] text-muted-foreground">{copy.body}</p>
      </div>

      <div className="relative mt-7 flex w-full max-w-[300px] flex-col gap-2.5">
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-[14px] font-semibold text-brand-foreground shadow-[0_10px_28px_-12px_color-mix(in_oklab,var(--color-brand)_55%,transparent)] active:scale-[0.98] transition"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Add item
          </button>
        )}
        {onScan && (
          <button
            type="button"
            onClick={onScan}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border/70 bg-card px-5 py-3 text-[13.5px] font-semibold text-foreground shadow-[0_1px_0_0_oklch(1_0_0/0.5)_inset] active:scale-[0.98] active:bg-secondary/40 transition"
          >
            <ScanLine className="size-4 text-brand" strokeWidth={2.25} />
            Scan a receipt
          </button>
        )}
      </div>
    </div>
  );
}
