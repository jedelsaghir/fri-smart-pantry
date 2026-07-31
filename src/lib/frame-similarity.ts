/**
 * Lightweight frame similarity for receipt capture overlap warning.
 * Pure helpers — no CV deps. Average-hash + luminance histogram distance.
 */

/** Default threshold: distances below this → frames too similar. Tunable. */
export const SIMILARITY_TOO_CLOSE = 0.18;

const HASH_SIZE = 8; // 8×8 = 64-bit average hash

/**
 * Average hash from grayscale float samples (row-major, HASH_SIZE²).
 * Returns 64-bit as array of 0|1 for testability.
 */
export function averageHashFromGray(gray: Float64Array | number[], size = HASH_SIZE): number[] {
  const n = size * size;
  if (gray.length < n) {
    return new Array(n).fill(0);
  }
  let sum = 0;
  for (let i = 0; i < n; i++) sum += gray[i];
  const mean = sum / n;
  const bits: number[] = new Array(n);
  for (let i = 0; i < n; i++) bits[i] = gray[i] >= mean ? 1 : 0;
  return bits;
}

/** Hamming distance normalized 0–1 between two bit arrays. */
export function hammingDistanceNorm(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 1;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) diff += 1;
  }
  // Count remaining length as mismatch if unequal
  diff += Math.abs(a.length - b.length);
  const denom = Math.max(a.length, b.length) || 1;
  return diff / denom;
}

/**
 * 16-bin luminance histogram from gray samples (values 0–255).
 * Returns normalized bin frequencies summing ~1.
 */
export function lumaHistogram(gray: Float64Array | number[], bins = 16): number[] {
  const hist = new Array(bins).fill(0);
  if (!gray.length) return hist;
  for (let i = 0; i < gray.length; i++) {
    const v = Math.max(0, Math.min(255, gray[i]));
    const b = Math.min(bins - 1, Math.floor((v / 256) * bins));
    hist[b] += 1;
  }
  const inv = 1 / gray.length;
  for (let i = 0; i < bins; i++) hist[i] *= inv;
  return hist;
}

/** L1 distance between two normalized histograms (0–2 range → map to 0–1). */
export function histogramDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return Math.min(1, sum / 2);
}

/**
 * Combined distance 0–1 (0 = identical). Weighted average of aHash + histogram.
 */
export function frameDistanceFromGray(
  grayA: Float64Array | number[],
  grayB: Float64Array | number[],
  size = HASH_SIZE
): number {
  const ha = averageHashFromGray(grayA, size);
  const hb = averageHashFromGray(grayB, size);
  const dHash = hammingDistanceNorm(ha, hb);
  // Full-res gray for histogram if longer; else reuse
  const histA = lumaHistogram(grayA.length >= 64 ? grayA : grayA);
  const histB = lumaHistogram(grayB.length >= 64 ? grayB : grayB);
  const dHist = histogramDistance(histA, histB);
  return dHash * 0.55 + dHist * 0.45;
}

export function framesTooSimilar(
  grayA: Float64Array | number[],
  grayB: Float64Array | number[],
  threshold = SIMILARITY_TOO_CLOSE
): boolean {
  return frameDistanceFromGray(grayA, grayB) < threshold;
}

/** Downsample RGBA ImageData-like buffer to HASH_SIZE² grayscale means. */
export function downsampleRgbaToGray(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  size = HASH_SIZE
): Float64Array {
  const out = new Float64Array(size * size);
  if (!width || !height || data.length < width * height * 4) return out;
  const cellW = width / size;
  const cellH = height / size;
  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const x0 = Math.floor(gx * cellW);
      const y0 = Math.floor(gy * cellH);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * cellW));
      const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * cellH));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < height; y++) {
        for (let x = x0; x < x1 && x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          n += 1;
        }
      }
      out[gy * size + gx] = n ? sum / n : 0;
    }
  }
  return out;
}

/** Larger gray sample grid for histogram (32×32). */
export function downsampleRgbaToGrayGrid(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  size = 32
): Float64Array {
  return downsampleRgbaToGray(data, width, height, size);
}

/**
 * Browser: load a data URL into gray samples for comparison.
 * Returns null outside browser or on failure.
 */
export async function grayFromDataUrl(
  dataUrl: string,
  sampleSize = 32
): Promise<Float64Array | null> {
  if (typeof document === "undefined" || typeof Image === "undefined") return null;
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = dataUrl;
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    const canvas = document.createElement("canvas");
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
    return downsampleRgbaToGray(imageData.data, sampleSize, sampleSize, sampleSize);
  } catch {
    return null;
  }
}

/** Compare two data URLs; returns true if too similar (or null if comparison skipped). */
export async function dataUrlsTooSimilar(
  a: string,
  b: string,
  threshold = SIMILARITY_TOO_CLOSE
): Promise<boolean | null> {
  const [ga, gb] = await Promise.all([grayFromDataUrl(a), grayFromDataUrl(b)]);
  if (!ga || !gb) return null;
  return framesTooSimilar(ga, gb, threshold);
}
