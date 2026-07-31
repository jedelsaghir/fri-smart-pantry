import { describe, expect, it } from "vitest";
import {
  averageHashFromGray,
  frameDistanceFromGray,
  framesTooSimilar,
  hammingDistanceNorm,
  histogramDistance,
  lumaHistogram,
  downsampleRgbaToGray,
  SIMILARITY_TOO_CLOSE,
} from "./frame-similarity";

describe("averageHashFromGray", () => {
  it("is all-ones for flat bright field", () => {
    const g = new Float64Array(64).fill(200);
    const h = averageHashFromGray(g);
    expect(h.every((b) => b === 1)).toBe(true);
  });

  it("differs for half-black half-white", () => {
    const g = new Float64Array(64);
    for (let i = 0; i < 32; i++) g[i] = 0;
    for (let i = 32; i < 64; i++) g[i] = 255;
    const h = averageHashFromGray(g);
    expect(h.slice(0, 32).every((b) => b === 0)).toBe(true);
    expect(h.slice(32).every((b) => b === 1)).toBe(true);
  });
});

describe("distances", () => {
  it("hamming is 0 for identical hashes", () => {
    const a = [1, 0, 1, 0];
    expect(hammingDistanceNorm(a, a)).toBe(0);
  });

  it("histogram distance is 0 for identical", () => {
    const h = lumaHistogram([10, 20, 200, 210]);
    expect(histogramDistance(h, h)).toBe(0);
  });

  it("identical frames are too similar", () => {
    const g = new Float64Array(64);
    for (let i = 0; i < 64; i++) g[i] = (i % 8) * 20;
    expect(frameDistanceFromGray(g, g)).toBeLessThan(SIMILARITY_TOO_CLOSE);
    expect(framesTooSimilar(g, g)).toBe(true);
  });

  it("very different patterns are not too similar", () => {
    const a = new Float64Array(64).fill(0);
    const b = new Float64Array(64).fill(255);
    // Average hash of flat fields: all 0 vs all 1 → max hamming, but mean-based
    // both are uniform so hash is all-1 or all-0 relative to own mean (all equal → all 1)
    // Use structured patterns instead
    for (let i = 0; i < 64; i++) {
      a[i] = i < 32 ? 0 : 255;
      b[i] = i % 2 === 0 ? 0 : 255;
    }
    expect(framesTooSimilar(a, b)).toBe(false);
  });
});

describe("downsampleRgbaToGray", () => {
  it("reads solid red as high luma-ish", () => {
    // 2×2 red pixels
    const data = new Uint8ClampedArray([
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
    ]);
    const g = downsampleRgbaToGray(data, 2, 2, 2);
    expect(g.length).toBe(4);
    expect(g[0]).toBeGreaterThan(50);
  });
});
