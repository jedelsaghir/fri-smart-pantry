import { ScanBarcode, ScanLine } from "lucide-react";

/**
 * Dual FAB cluster: barcode (secondary) + receipt Quick Scan (brand).
 * Fixed above bottom nav; safe-area aware.
 * Accepts either dual handlers or legacy `onClick` (receipt only).
 */
export function ScanFab({
  onClick,
  onReceiptScan,
  onBarcodeScan,
}: {
  /** @deprecated Prefer onReceiptScan — kept so older callers still typecheck */
  onClick?: () => void;
  onReceiptScan?: () => void;
  onBarcodeScan?: () => void;
}) {
  const receipt = onReceiptScan ?? onClick;
  const showBarcode = typeof onBarcodeScan === "function";

  return (
    <div
      className="fixed bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] right-4 z-30 flex items-center gap-2.5"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {showBarcode && (
        <button
          type="button"
          onClick={onBarcodeScan}
          aria-label="Scan barcode"
          className="flex size-12 min-h-12 min-w-12 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-[0_10px_28px_-10px_oklch(0.2_0.02_150/0.22)] active:scale-95 transition touch-manipulation dark:shadow-[0_10px_28px_-10px_oklch(0_0_0/0.45)]"
        >
          <ScanBarcode className="size-5" strokeWidth={2.25} />
        </button>
      )}
      <button
        type="button"
        onClick={receipt}
        aria-label="Quick Scan receipt"
        className="flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 py-3.5 text-brand-foreground shadow-[0_12px_30px_-8px_color-mix(in_oklab,var(--color-brand)_55%,transparent)] active:scale-95 transition touch-manipulation"
      >
        <ScanLine className="size-5 shrink-0" />
        <span className="text-sm font-semibold">Quick Scan</span>
      </button>
    </div>
  );
}
