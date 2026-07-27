"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { hapticLight } from "@/lib/haptics";

const STEPS = [
  {
    title: "Capture top → middle → bottom",
    body: "Long receipts work best as a few overlapping photos. Keep text sharp and well lit.",
  },
  {
    title: "Process once",
    body: "When photos look good, tap Process. We’ll enhance and read every shot together.",
  },
  {
    title: "Review low-confidence",
    body: "Anything uncertain lands in Review — discard noise, keep what you want in the pantry.",
  },
] as const;

function tipsSeen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.SCAN_TIPS_SEEN) === "1";
  } catch {
    return true;
  }
}

function markTipsSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SCAN_TIPS_SEEN, "1");
  } catch {
    /* ignore */
  }
}

/**
 * One-time coach for first open of the receipt scanner.
 * Dismissible bottom sheet — never blocks the camera permanently.
 */
export function ScanOnboarding({ open }: { open: boolean }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setStep(0);
      return;
    }
    if (tipsSeen()) return;
    // Soft delay so camera UI can settle first
    const t = window.setTimeout(() => setVisible(true), 450);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open || !visible) return null;

  const last = step >= STEPS.length - 1;
  const current = STEPS[step];

  const dismiss = () => {
    markTipsSeen();
    setVisible(false);
    hapticLight();
  };

  const next = () => {
    hapticLight();
    if (last) dismiss();
    else setStep((s) => s + 1);
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-label="Scan tips"
    >
      <div
        className={
          "pointer-events-auto elevated-card rounded-3xl border border-border/50 p-4 shadow-[0_16px_48px_-16px_oklch(0.2_0.02_150/0.35)] " +
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-reduce:animate-none"
        }
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Quick tip {step + 1}/{STEPS.length}
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-9 rounded-full px-2 text-xs font-semibold text-muted-foreground active:bg-secondary"
          >
            Skip
          </button>
        </div>
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">
          {current.title}
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{current.body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={next}
            className="min-h-11 flex-1 rounded-2xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground active:scale-[0.985]"
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
