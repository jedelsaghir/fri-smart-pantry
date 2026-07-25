/**
 * Live camera quality heuristics for receipt capture.
 * Runs on downscaled frames (~160px edge) so it stays cheap on mobile.
 */

export type CaptureIssue = "blurry" | "dark" | "low_contrast" | "too_far";

export type CaptureQuality = {
  /** Laplacian variance (higher = sharper) */
  sharpness: number;
  /** Mean luma 0–255 */
  brightness: number;
  /** Std-dev of luma */
  contrast: number;
  /** Estimated document fill of frame 0–1 */
  fillRatio: number;
  issues: CaptureIssue[];
  /** Calm one-line guidance, or null when OK */
  message: string | null;
  ok: boolean;
};

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Analyze a video frame (or canvas) for blur / lighting / fill.
 * Uses a small offscreen canvas for speed.
 */
export function analyzeCaptureQuality(
  source: HTMLVideoElement | HTMLCanvasElement,
  opts: { sampleEdge?: number } = {}
): CaptureQuality {
  const sampleEdge = opts.sampleEdge ?? 160;

  const empty: CaptureQuality = {
    sharpness: 0,
    brightness: 0,
    contrast: 0,
    fillRatio: 0,
    issues: ["blurry", "dark"],
    message: "Hold steady and point at the receipt",
    ok: false,
  };

  if (typeof document === "undefined") return empty;

  let sw = 0;
  let sh = 0;
  if (source instanceof HTMLVideoElement) {
    sw = source.videoWidth;
    sh = source.videoHeight;
  } else {
    sw = source.width;
    sh = source.height;
  }
  if (!sw || !sh) return empty;

  const scale = sampleEdge / Math.max(sw, sh);
  const w = Math.max(8, Math.round(sw * scale));
  const h = Math.max(8, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return empty;

  try {
    ctx.drawImage(source, 0, 0, w, h);
  } catch {
    return empty;
  }

  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const L = luma(data[i], data[i + 1], data[i + 2]);
    gray[p] = L;
    sum += L;
  }
  const brightness = sum / gray.length;

  let varSum = 0;
  for (let p = 0; p < gray.length; p++) {
    const d = gray[p] - brightness;
    varSum += d * d;
  }
  const contrast = Math.sqrt(varSum / gray.length);

  // Laplacian variance (blur metric)
  let lapSum = 0;
  let lapSq = 0;
  let lapN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lapSum += lap;
      lapSq += lap * lap;
      lapN += 1;
    }
  }
  const lapMean = lapN ? lapSum / lapN : 0;
  const sharpness = lapN ? lapSq / lapN - lapMean * lapMean : 0;

  // Fill: fraction of pixels that differ from border background
  let bgSum = 0;
  let bgN = 0;
  const border = Math.max(1, Math.floor(Math.min(w, h) * 0.08));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > border && x < w - border && y > border && y < h - border) continue;
      bgSum += gray[y * w + x];
      bgN += 1;
    }
  }
  const bg = bgN ? bgSum / bgN : brightness;
  let content = 0;
  for (let p = 0; p < gray.length; p++) {
    if (Math.abs(gray[p] - bg) > 18) content += 1;
  }
  const fillRatio = content / gray.length;

  const issues: CaptureIssue[] = [];

  // Thresholds tuned for downscaled frames (empirically calm, not noisy)
  if (sharpness < 45) issues.push("blurry");
  if (brightness < 48) issues.push("dark");
  else if (contrast < 22) issues.push("low_contrast");
  if (fillRatio < 0.22) issues.push("too_far");

  let message: string | null = null;
  if (issues.includes("blurry")) {
    message = "Hold steady — looking a little soft";
  } else if (issues.includes("dark")) {
    message = "A bit more light helps the text";
  } else if (issues.includes("low_contrast")) {
    message = "Boost the light so print stands out";
  } else if (issues.includes("too_far")) {
    message = "Move closer — fill the frame with the receipt";
  }

  return {
    sharpness,
    brightness,
    contrast,
    fillRatio,
    issues,
    message,
    ok: issues.length === 0,
  };
}

/** Prefer navigator.vibrate when available (Android); no-op on iOS Safari */
export function hapticShutter(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      // Short double-tap feel — more “camera shutter” than a single buzz
      navigator.vibrate([10, 24, 14]);
    }
  } catch {
    /* ignore */
  }
}

/** Soft success tick after a photo is queued */
export function hapticPhotoQueued(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
  } catch {
    /* ignore */
  }
}
