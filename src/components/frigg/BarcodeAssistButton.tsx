"use client";

import { useEffect, useRef, useState } from "react";
import { ScanBarcode, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  barcodeErrorMessage,
  detectBarcodeFromSource,
  isBarcodeDetectorSupported,
  lookupBarcodeProduct,
  type BarcodeLookupResult,
} from "@/lib/barcode-lookup";

/**
 * Compact barcode assist control for Add sheet / review lines.
 * Uses BarcodeDetector when available; looks up Open Food Facts.
 * Never blocks the parent form — fail-soft with toasts.
 */
export function BarcodeAssistButton({
  onPrefill,
  className = "",
  label = "Scan barcode",
}: {
  onPrefill: (result: BarcodeLookupResult) => void;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("Point at a barcode");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const foundRef = useRef(false);

  const stop = () => {
    foundRef.current = false;
    if (loopRef.current != null) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setBusy(false);
  };

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    let cancelled = false;
    foundRef.current = false;

    (async () => {
      if (!isBarcodeDetectorSupported()) {
        toast.message("Barcode assist unavailable", {
          description: barcodeErrorMessage("unsupported"),
        });
        setOpen(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setHint("Point at a barcode");

        const tick = async () => {
          if (cancelled || foundRef.current) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2) {
            const code = await detectBarcodeFromSource(v);
            if (code && !foundRef.current) {
              foundRef.current = true;
              setBusy(true);
              setHint("Looking up product…");
              abortRef.current = new AbortController();
              const product = await lookupBarcodeProduct(code, {
                signal: abortRef.current.signal,
              });
              if (cancelled) return;
              if (product) {
                onPrefill(product);
                toast.success("Barcode found", {
                  description: product.name,
                });
                setOpen(false);
                stop();
                return;
              }
              toast.message("Barcode read", {
                description: barcodeErrorMessage("lookup_failed") + ` (${code})`,
              });
              // Still give parent the raw code so they can store it
              onPrefill({
                barcode: code,
                name: "",
                unit: "pcs",
                source: "local",
              });
              setOpen(false);
              stop();
              return;
            }
          }
          loopRef.current = requestAnimationFrame(() => {
            void tick();
          });
        };
        loopRef.current = requestAnimationFrame(() => {
          void tick();
        });
      } catch {
        toast.error("Camera unavailable", {
          description: barcodeErrorMessage("permission"),
        });
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open toggles session
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          "inline-flex items-center gap-1.5 rounded-2xl border border-border/60 bg-secondary/50 px-3 py-2 text-[12px] font-semibold text-foreground active:bg-secondary"
        }
      >
        <ScanBarcode className="size-3.5" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Barcode assist"
          onKeyDown={(e) => {
            // L-10: basic focus cycle inside barcode overlay
            if (e.key !== "Tab") return;
            const root = e.currentTarget;
            const nodes = root.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!nodes.length) return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-background shadow-2xl overflow-hidden border border-border/40">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
              <div>
                <div className="text-sm font-semibold">Barcode assist</div>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setOpen(false);
                  stop();
                }}
                className="grid size-9 place-items-center rounded-full bg-secondary/70"
                aria-label="Close barcode scanner"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="relative bg-black aspect-[4/3]">
              <video
                ref={videoRef}
                playsInline
                muted
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[72%] h-[38%] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
              </div>
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-black/40">
                  <Loader2 className="size-8 animate-spin text-white" />
                </div>
              )}
            </div>
            {/* L-13: manual barcode entry when detector unsupported */}
            <div className="px-4 py-3 space-y-2 border-t border-border/40">
              <label className="block text-[11px] font-medium text-muted-foreground">
                Or type barcode / GTIN
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 4006381333931"
                  className="h-10 flex-1 rounded-2xl border border-border/60 bg-secondary/40 px-3 text-sm outline-none focus:border-brand/40"
                  id="frigg-manual-barcode"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const el = e.target as HTMLInputElement;
                      void (async () => {
                        const code = el.value.trim();
                        if (!code) return;
                        setBusy(true);
                        setHint("Looking up…");
                        const product = await lookupBarcodeProduct(code);
                        setBusy(false);
                        if (product) {
                          onPrefill(product);
                          toast.success("Barcode found", { description: product.name });
                        } else {
                          onPrefill({ barcode: code, name: "", unit: "pcs", source: "local" });
                          toast.message("Code saved", {
                            description: barcodeErrorMessage("lookup_failed"),
                          });
                        }
                        setOpen(false);
                        stop();
                      })();
                    }
                  }}
                />
                <button
                  type="button"
                  className="rounded-2xl bg-brand px-3 text-xs font-semibold text-brand-foreground"
                  onClick={() => {
                    const el = document.getElementById(
                      "frigg-manual-barcode"
                    ) as HTMLInputElement | null;
                    const code = el?.value.trim();
                    if (!code) return;
                    void (async () => {
                      setBusy(true);
                      const product = await lookupBarcodeProduct(code);
                      setBusy(false);
                      if (product) {
                        onPrefill(product);
                        toast.success("Barcode found", { description: product.name });
                      } else {
                        onPrefill({ barcode: code, name: "", unit: "pcs", source: "local" });
                        toast.message("Code noted", {
                          description: "Enter a name on the form if lookup failed.",
                        });
                      }
                      setOpen(false);
                      stop();
                    })();
                  }}
                >
                  Look up
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Camera scan when supported. Names from Open Food Facts when online.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
