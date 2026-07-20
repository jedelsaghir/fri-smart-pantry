import { ScanLine } from "lucide-react";

export function ScanFab({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Quick Scan"
      className="fixed bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] right-4 z-30 flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 py-3.5 text-brand-foreground shadow-[0_12px_30px_-8px_oklch(0.36_0.06_155_/_0.55)] active:scale-95 transition touch-manipulation"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <ScanLine className="size-5 shrink-0" />
      <span className="text-sm font-semibold">Quick Scan</span>
    </button>
  );
}
