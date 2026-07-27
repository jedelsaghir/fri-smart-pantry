/**
 * Live camera quality heuristics for receipt capture.
 * Runs on downscaled frames (~160px edge) so it stays cheap on mobile.
 */

export type CaptureIssue = "blurry" | "dark" | "low_contrast" | "too_far" | "partial";

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
  /** Short issue label for chips, e.g. "Blurry" */
  issueLabel: string | null;
  ok: boolean;
};

function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Priority order for guidance (first match wins) */
const ISSUE_PRIORITY: CaptureIssue[] = [
  "blurry",
  "dark",
  "low_contrast",
  "partial",
  "too_far",
];

export function qualityIssueLabel(issue: CaptureIssue): string {
  switch (issue) {
    case "blurry":
      return "Blurry";
    case "dark":
      return "Too dark";
    case "low_contrast":
      return "Low contrast";
    case "too_far":
      return "Too far";
    case "partial":
      return "Partial";
    default:
      return "Check framing";
  }
}

export function qualityIssueMessage(issue: CaptureIssue): string {
  switch (issue) {
    case "blurry":
      return "Hold steady — text looks soft";
    case "dark":
      return "Need more light for clear text";
    case "low_contrast":
      return "Boost light so print stands out";
    case "too_far":
      return "Move closer — fill the frame with the receipt";
    case "partial":
      return "Receipt may be cut off — include full width";
    default:
      return "Adjust framing for a clearer shot";
  }
}

/**
 * Analyze a video frame (or canvas) for blur / lighting / fill / partial crop.
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
    issueLabel: "Getting ready",
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
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
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

  // Edge content: high content on left XOR right (or top) suggests partial crop
  const edgeBand = Math.max(2, Math.floor(w * 0.12));
  let leftEdge = 0;
  let rightEdge = 0;
  let leftN = 0;
  let rightN = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < edgeBand; x++) {
      if (Math.abs(gray[y * w + x] - bg) > 18) leftEdge += 1;
      leftN += 1;
    }
    for (let x = w - edgeBand; x < w; x++) {
      if (Math.abs(gray[y * w + x] - bg) > 18) rightEdge += 1;
      rightN += 1;
    }
  }
  const leftFill = leftN ? leftEdge / leftN : 0;
  const rightFill = rightN ? rightEdge / rightN : 0;
  // One side almost empty while the other is busy + decent overall fill → partial
  const partialSide =
    fillRatio > 0.28 &&
    ((leftFill < 0.12 && rightFill > 0.35) || (rightFill < 0.12 && leftFill > 0.35));

  const issues: CaptureIssue[] = [];

  // Thresholds tuned for downscaled frames (calm, not noisy)
  if (sharpness < 45) issues.push("blurry");
  if (brightness < 48) issues.push("dark");
  else if (contrast < 22) issues.push("low_contrast");
  if (fillRatio < 0.22) issues.push("too_far");
  else if (partialSide) issues.push("partial");

  let primary: CaptureIssue | null = null;
  for (const issue of ISSUE_PRIORITY) {
    if (issues.includes(issue)) {
      primary = issue;
      break;
    }
  }

  return {
    sharpness,
    brightness,
    contrast,
    fillRatio,
    issues,
    message: primary ? qualityIssueMessage(primary) : null,
    issueLabel: primary ? qualityIssueLabel(primary) : null,
    ok: issues.length === 0,
  };
}

/** Re-export central haptics (capture flow keeps existing import paths). */
export {
  hapticLight,
  hapticPhotoQueued,
  hapticShutter,
  hapticSuccess,
} from "@/lib/haptics";
