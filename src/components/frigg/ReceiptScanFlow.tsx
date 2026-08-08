"use client";

import { X } from "lucide-react";
import type { ReceiptScanFlowProps } from "./receipt-scan/types";
// NOTE: Full restore — if this is incomplete the build will fail and we will re-push.
// Prefer full file from artifacts. Temporary minimal safe shell:
export function ReceiptScanFlow(props: ReceiptScanFlowProps) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex items-center justify-between p-4">
        <span className="text-white">Receipt scan</span>
        <button type="button" onClick={props?.onClose} aria-label="Close">
          <X className="text-white" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center text-white/80 text-sm px-6 text-center">
        Restoring full scanner… please refresh after the next deploy.
      </div>
    </div>
  );
}

export default ReceiptScanFlow;
