/**
 * Client-side image prep for OCR (resize / compress data URLs).
 */

/** Downscale large captures so vision API stays under size limits and latency is lower. */
export async function prepareImageForOcr(
  dataUrl: string,
  opts: { maxEdge?: number; quality?: number } = {}
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.82;

  if (!dataUrl.startsWith("data:image/")) return dataUrl;

  // Already small enough (rough): skip canvas work for tiny payloads
  if (dataUrl.length < 180_000) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Prefer JPEG for photos (smaller); keep PNG if source was PNG with alpha
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve(out.length < dataUrl.length ? out : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Capture current video frame as a JPEG data URL */
export function captureVideoFrame(
  video: HTMLVideoElement,
  opts: { maxEdge?: number; quality?: number } = {}
): string {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.85;
  let w = video.videoWidth || 720;
  let h = video.videoHeight || 960;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.max(1, Math.round(w * scale));
  h = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
