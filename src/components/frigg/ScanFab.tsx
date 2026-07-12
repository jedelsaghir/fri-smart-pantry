import { ScanLine } from "lucide-react";

export function ScanFab() {
  return (
    <button
      aria-label="Quick Scan"
      className="fixed bottom-24 right-5 z-30 flex items-center gap-2 rounded-full bg-brand px-5 py-3.5 text-brand-foreground shadow-[0_12px_30px_-8px_oklch(0.36_0.06_155_/_0.55)] active:scale-95 transition"
    >
      <ScanLine className="size-5" />
      <span className="text-sm font-semibold">Quick Scan</span>
    </button>
  );
}