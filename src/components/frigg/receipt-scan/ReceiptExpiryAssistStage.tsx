"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, SkipForward, Check } from "lucide-react";
import type { DetectedItem } from "@/types/pantry";
import { compressLabelPhoto, EXPIRY_ASSIST_COPY } from "@/lib/label-photo";
import { formatStorageLabel, type ExpiryAssistSignal } from "./types";

type DraftRow = {
  scanItemId: string;
  name: string;
  unit: string;
  storage: DetectedItem["storage"];
  emoji: string;
  labelPhotoDataUrl?: string;
  daysLeftText: string;
};

function toDrafts(items: DetectedItem[]): DraftRow[] {
  return items.map((i) => ({
    scanItemId: i.id,
    name: i.name,
    unit: i.unit,
    storage: i.storage,
    emoji: i.emoji,
    daysLeftText: "",
  }));
}

/**
 * Calm, optional post-scan step: attach label photos and/or days-left.
 * Dismissible — never blocks the pantry update that already happened.
 */
export function ReceiptExpiryAssistStage({
  items,
  onSkip,
  onDone,
}: {
  items: DetectedItem[];
  onSkip: () => void;
  onDone: (signals: ExpiryAssistSignal[]) => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>(() => toDrafts(items));
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const targetIdRef = useRef<string | null>(null);

  const attachPhoto = async (scanItemId: string, dataUrl: string) => {
    setBusyId(scanItemId);
    try {
      const compressed = await compressLabelPhoto(dataUrl);
      setRows((prev) =>
        prev.map((r) =>
          r.scanItemId === scanItemId ? { ...r, labelPhotoDataUrl: compressed } : r
        )
      );
    } finally {
      setBusyId(null);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = targetIdRef.current;
    e.target.value = "";
    if (!file || !id || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") void attachPhoto(id, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const openPicker = (scanItemId: string) => {
    targetIdRef.current = scanItemId;
    fileRef.current?.click();
  };

  const finish = (skip: boolean) => {
    if (skip) {
      onSkip();
      return;
    }
    const signals: ExpiryAssistSignal[] = [];
    for (const r of rows) {
      const parsed =
        r.daysLeftText.trim() === ""
          ? undefined
          : Math.max(0, Math.floor(Number(r.daysLeftText)));
      const daysLeft = typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined;
      if (!r.labelPhotoDataUrl && daysLeft === undefined) continue;
      const signal: ExpiryAssistSignal = {
        scanItemId: r.scanItemId,
        name: r.name,
        unit: r.unit,
        storage: r.storage,
        emoji: r.emoji,
      };
      if (r.labelPhotoDataUrl) signal.labelPhotoDataUrl = r.labelPhotoDataUrl;
      if (daysLeft !== undefined) signal.daysLeft = daysLeft;
      signals.push(signal);
    }
    onDone(signals);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-10 px-2">
        <p className="text-sm text-muted-foreground">{EXPIRY_ASSIST_COPY.empty}</p>
        <button
          type="button"
          onClick={onSkip}
          className="mt-6 w-full rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mb-4">
        <div className="text-lg font-semibold tracking-tight">{EXPIRY_ASSIST_COPY.title}</div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {EXPIRY_ASSIST_COPY.subtitle}
        </p>
        <p className="mt-2.5 rounded-2xl border border-border/50 bg-secondary/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {EXPIRY_ASSIST_COPY.honesty}
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFile(e)}
      />

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.scanItemId}
            className="elevated-card rounded-3xl p-3.5 flex gap-3 items-start"
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-xl">
              {row.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold truncate">{row.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {formatStorageLabel(row.storage)} · {row.unit}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === row.scanItemId}
                  onClick={() => openPicker(row.scanItemId)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-border/60 bg-background px-3 py-1.5 text-[12px] font-semibold active:bg-secondary/70 disabled:opacity-50"
                >
                  {row.labelPhotoDataUrl ? (
                    <>
                      <ImagePlus className="size-3.5" />
                      Replace photo
                    </>
                  ) : (
                    <>
                      <Camera className="size-3.5" />
                      Label photo
                    </>
                  )}
                </button>
                <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="shrink-0">Days left</span>
                  <input
                    inputMode="numeric"
                    value={row.daysLeftText}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) =>
                          r.scanItemId === row.scanItemId
                            ? { ...r, daysLeftText: e.target.value.replace(/[^\d]/g, "") }
                            : r
                        )
                      )
                    }
                    placeholder="—"
                    className="w-14 rounded-xl border border-border/50 bg-secondary/50 px-2 py-1 text-center text-[13px] font-semibold tabular-nums outline-none focus:border-brand/40"
                    aria-label={`Days left for ${row.name}`}
                  />
                </label>
              </div>

              {row.labelPhotoDataUrl && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-border/40">
                  <img
                    src={row.labelPhotoDataUrl}
                    alt={`Label for ${row.name}`}
                    className="h-20 w-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2 pb-2">
        {/* H-05: Skip is the primary, calm action — notes are optional */}
        <button
          type="button"
          onClick={() => finish(true)}
          className="w-full rounded-3xl bg-brand py-3.5 text-sm font-semibold text-brand-foreground active:scale-[0.985] transition flex items-center justify-center gap-2"
        >
          <SkipForward className="size-4" />
          {EXPIRY_ASSIST_COPY.skipPrimary}
        </button>
        <button
          type="button"
          onClick={() => finish(false)}
          className="w-full py-2.5 text-sm font-medium text-muted-foreground active:text-foreground inline-flex items-center justify-center gap-1.5"
        >
          <Check className="size-3.5" />
          {EXPIRY_ASSIST_COPY.saveSecondary}
        </button>
      </div>
    </div>
  );
}
