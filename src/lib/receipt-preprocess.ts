/**
 * Client-side receipt image pre-processing for better OCR.
 * Lightweight pure Canvas / ImageData — no external deps.
 *
 * Pipeline:
 *  1. Downscale for speed
 *  2. Detect document / content bounds (crop to receipt)
 *  3. Mild deskew (rotation from projection profile)
 *  4. Contrast stretch + unsharp sharpen
 *  5. Light denoise (3×3 box blend)
 *  6. Export JPEG
 */

export type PreprocessOptions = {
  maxEdge?: number;
  quality?: number;
  /** Skip heavy steps when image is already small */
  fast?: boolean;
};

export type PreprocessResult = {
  dataUrl: string;
  /** Whether crop / enhance changed the image meaningfully */
  enhanced: boolean;
  crop: { x: number; y: number; w: number; h: number } | null;
  deskewDeg: number;
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = dataUrl;
  });
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Luma 0–255 */
function luma(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Find content bounding box by scanning for high-variance / non-background rows & cols.
 * Receipts are typically paper (light or mid) against a darker surface.
 */
export function findContentBounds(
  data: ImageData,
  opts: { marginFrac?: number } = {}
): { x: number; y: number; w: number; h: number } {
  const { width: W, height: H, data: px } = data;
  const marginFrac = opts.marginFrac ?? 0.02;

  // Sample every 2px for speed
  const step = 2;
  const rowEnergy = new Float32Array(H);
  const colEnergy = new Float32Array(W);

  // Estimate background as mean of a thin border
  let bgSum = 0;
  let bgN = 0;
  const border = Math.max(2, Math.floor(Math.min(W, H) * 0.04));
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (x > border && x < W - border && y > border && y < H - border) continue;
      const i = (y * W + x) * 4;
      bgSum += luma(px[i], px[i + 1], px[i + 2]);
      bgN += 1;
    }
  }
  const bg = bgN ? bgSum / bgN : 128;

  // Energy = distance from background + local horizontal gradient
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      const L = luma(px[i], px[i + 1], px[i + 2]);
      const diff = Math.abs(L - bg);
      let grad = 0;
      if (x + step < W) {
        const j = (y * W + (x + step)) * 4;
        grad = Math.abs(L - luma(px[j], px[j + 1], px[j + 2]));
      }
      const e = diff * 0.6 + grad * 0.4;
      rowEnergy[y] += e;
      colEnergy[x] += e;
    }
  }

  // Threshold at ~35th percentile of non-zero energy
  const sample: number[] = [];
  for (let y = 0; y < H; y += step) if (rowEnergy[y] > 0) sample.push(rowEnergy[y]);
  sample.sort((a, b) => a - b);
  const thr = sample.length ? sample[Math.floor(sample.length * 0.35)] * 0.55 : 1;

  let top = 0;
  let bottom = H - 1;
  let left = 0;
  let right = W - 1;

  for (let y = 0; y < H; y++) {
    if (rowEnergy[y] >= thr || (y + 1 < H && rowEnergy[y + 1] >= thr)) {
      top = y;
      break;
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    if (rowEnergy[y] >= thr || (y - 1 >= 0 && rowEnergy[y - 1] >= thr)) {
      bottom = y;
      break;
    }
  }
  for (let x = 0; x < W; x++) {
    if (colEnergy[x] >= thr || (x + 1 < W && colEnergy[x + 1] >= thr)) {
      left = x;
      break;
    }
  }
  for (let x = W - 1; x >= 0; x--) {
    if (colEnergy[x] >= thr || (x - 1 >= 0 && colEnergy[x - 1] >= thr)) {
      right = x;
      break;
    }
  }

  // Reject crop if it throws away too much (bad detection)
  const area = (right - left + 1) * (bottom - top + 1);
  if (area < W * H * 0.18 || right - left < W * 0.25 || bottom - top < H * 0.25) {
    return { x: 0, y: 0, w: W, h: H };
  }

  const mx = Math.floor(W * marginFrac);
  const my = Math.floor(H * marginFrac);
  const x = clamp(left - mx, 0, W - 1);
  const y = clamp(top - my, 0, H - 1);
  const w = clamp(right - left + 1 + mx * 2, 1, W - x);
  const h = clamp(bottom - top + 1 + my * 2, 1, H - y);
  return { x, y, w, h };
}

/**
 * Estimate small deskew angle (−12°…12°) via horizontal projection variance.
 */
export function estimateDeskewAngle(data: ImageData): number {
  const { width: W, height: H, data: px } = data;
  // Work on a thin center strip for speed
  const x0 = Math.floor(W * 0.2);
  const x1 = Math.floor(W * 0.8);
  const step = Math.max(1, Math.floor(H / 120));

  let bestAngle = 0;
  let bestScore = -1;

  for (let deg = -8; deg <= 8; deg += 1) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const proj = new Float32Array(H);
    let n = 0;
    for (let y = 0; y < H; y += step) {
      for (let x = x0; x < x1; x += 3) {
        // Sample source approx under inverse rotation around center
        const cx = x - W / 2;
        const cy = y - H / 2;
        const sx = Math.round(cx * cos + cy * sin + W / 2);
        const sy = Math.round(-cx * sin + cy * cos + H / 2);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const i = (sy * W + sx) * 4;
        // Edge strength proxy: dark text on light paper → low luma
        const L = luma(px[i], px[i + 1], px[i + 2]);
        proj[y] += 255 - L;
        n += 1;
      }
    }
    // Score = variance of projection (text lines align → peakier projection)
    if (n === 0) continue;
    let mean = 0;
    let count = 0;
    for (let y = 0; y < H; y += step) {
      mean += proj[y];
      count += 1;
    }
    mean /= count || 1;
    let varSum = 0;
    for (let y = 0; y < H; y += step) {
      const d = proj[y] - mean;
      varSum += d * d;
    }
    if (varSum > bestScore) {
      bestScore = varSum;
      bestAngle = deg;
    }
  }
  return bestAngle;
}

/** Contrast stretch using percentile clip + mild gamma */
function enhanceContrast(data: ImageData): void {
  const px = data.data;
  const n = px.length / 4;
  // Sample for percentiles
  const samples: number[] = [];
  const stride = Math.max(1, Math.floor(n / 4000));
  for (let p = 0; p < n; p += stride) {
    const i = p * 4;
    samples.push(luma(px[i], px[i + 1], px[i + 2]));
  }
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.02)] ?? 0;
  const hi = samples[Math.floor(samples.length * 0.98)] ?? 255;
  const range = Math.max(1, hi - lo);

  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = ((px[i + c] - lo) / range) * 255;
      // Slight mid-tone lift for faded ink
      v = 255 * Math.pow(clamp(v, 0, 255) / 255, 0.92);
      px[i + c] = clamp(Math.round(v), 0, 255);
    }
  }
}

/** Light denoise: blend with 3×3 box blur (preserves text edges moderately) */
function lightDenoise(data: ImageData): void {
  const { width: W, height: H, data: px } = data;
  const copy = new Uint8ClampedArray(px);
  const blend = 0.35; // how much blur to mix in

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += copy[((y + dy) * W + (x + dx)) * 4 + c];
          }
        }
        const avg = sum / 9;
        px[i + c] = clamp(Math.round(px[i + c] * (1 - blend) + avg * blend), 0, 255);
      }
    }
  }
}

/** Unsharp mask sharpening */
function sharpen(data: ImageData, amount = 0.55): void {
  const { width: W, height: H, data: px } = data;
  const copy = new Uint8ClampedArray(px);

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      for (let c = 0; c < 3; c++) {
        // Laplacian-ish kernel
        const center = copy[i + c] * 5;
        const neigh =
          copy[((y - 1) * W + x) * 4 + c] +
          copy[((y + 1) * W + x) * 4 + c] +
          copy[(y * W + (x - 1)) * 4 + c] +
          copy[(y * W + (x + 1)) * 4 + c];
        const sharp = center - neigh;
        px[i + c] = clamp(Math.round(copy[i + c] + amount * (sharp - copy[i + c])), 0, 255);
      }
    }
  }
}

/**
 * Pseudo keystone: if content bbox is strongly off-center trapezoid proxy,
 * we already crop tightly. Full 4-point warp is expensive; deskew handles most cases.
 * This re-frames the crop with slight padding so edges aren't clipped.
 */
function padCrop(
  crop: { x: number; y: number; w: number; h: number },
  W: number,
  H: number
) {
  const padX = Math.floor(crop.w * 0.03);
  const padY = Math.floor(crop.h * 0.03);
  const x = clamp(crop.x - padX, 0, W - 1);
  const y = clamp(crop.y - padY, 0, H - 1);
  const w = clamp(crop.w + padX * 2, 1, W - x);
  const h = clamp(crop.h + padY * 2, 1, H - y);
  return { x, y, w, h };
}

/**
 * Full receipt pre-process pipeline.
 * Safe to call on every photo before OCR.
 */
export async function preprocessReceiptImage(
  dataUrl: string,
  opts: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.88;

  if (typeof document === "undefined") {
    return { dataUrl, enhanced: false, crop: null, deskewDeg: 0 };
  }

  if (!dataUrl.startsWith("data:image/")) {
    return { dataUrl, enhanced: false, crop: null, deskewDeg: 0 };
  }

  try {
    const img = await loadImage(dataUrl);
    let { width, height } = img;
    if (!width || !height) {
      return { dataUrl, enhanced: false, crop: null, deskewDeg: 0 };
    }

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { dataUrl, enhanced: false, crop: null, deskewDeg: 0 };
    }

    ctx.drawImage(img, 0, 0, width, height);
    let imageData = ctx.getImageData(0, 0, width, height);

    // 1) Content crop (receipt edges)
    let crop = findContentBounds(imageData);
    crop = padCrop(crop, width, height);
    const cropped = ctx.getImageData(crop.x, crop.y, crop.w, crop.h);

    // Work canvas for crop
    const work = document.createElement("canvas");
    work.width = crop.w;
    work.height = crop.h;
    const wctx = work.getContext("2d", { willReadFrequently: true });
    if (!wctx) {
      return { dataUrl, enhanced: false, crop: null, deskewDeg: 0 };
    }
    wctx.putImageData(cropped, 0, 0);

    // 2) Deskew
    let deskewDeg = 0;
    if (!opts.fast) {
      deskewDeg = estimateDeskewAngle(cropped);
      if (Math.abs(deskewDeg) >= 1) {
        const rad = (-deskewDeg * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const nw = Math.ceil(crop.w * cos + crop.h * sin);
        const nh = Math.ceil(crop.w * sin + crop.h * cos);
        const rot = document.createElement("canvas");
        rot.width = nw;
        rot.height = nh;
        const rctx = rot.getContext("2d");
        if (rctx) {
          rctx.fillStyle = "#ffffff";
          rctx.fillRect(0, 0, nw, nh);
          rctx.translate(nw / 2, nh / 2);
          rctx.rotate(rad);
          rctx.drawImage(work, -crop.w / 2, -crop.h / 2);
          work.width = nw;
          work.height = nh;
          wctx.drawImage(rot, 0, 0);
        }
      }
    }

    imageData = wctx.getImageData(0, 0, work.width, work.height);

    // 3) Contrast
    enhanceContrast(imageData);
    // 4) Denoise (before sharpen)
    if (!opts.fast) lightDenoise(imageData);
    // 5) Sharpen
    sharpen(imageData, 0.5);

    wctx.putImageData(imageData, 0, 0);
    const out = work.toDataURL("image/jpeg", quality);

    return {
      dataUrl: out.length > 32 ? out : dataUrl,
      enhanced: true,
      crop,
      deskewDeg,
    };
  } catch {
    return { dataUrl, enhanced: false, crop: null, deskewDeg: 0 };
  }
}
