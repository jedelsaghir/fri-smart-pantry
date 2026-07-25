import { describe, expect, it } from "vitest";
import { findContentBounds } from "./receipt-preprocess";

/** Build a simple ImageData-like object with a light rectangle on dark bg */
function makeImageData(W: number, H: number, rect: { x: number; y: number; w: number; h: number }) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inside =
        x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
      const v = inside ? 240 : 30;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data, colorSpace: "srgb" } as ImageData;
}

describe("findContentBounds", () => {
  it("finds a bright document region on a dark background", () => {
    const img = makeImageData(100, 160, { x: 20, y: 30, w: 60, h: 100 });
    const box = findContentBounds(img);
    // Should roughly cover the light rectangle
    expect(box.x).toBeLessThan(25);
    expect(box.y).toBeLessThan(35);
    expect(box.w).toBeGreaterThan(50);
    expect(box.h).toBeGreaterThan(80);
    expect(box.w * box.h).toBeLessThan(100 * 160 * 0.95);
  });

  it("falls back to full frame when content is ambiguous", () => {
    // Uniform image — no strong document
    const img = makeImageData(80, 80, { x: 0, y: 0, w: 80, h: 80 });
    const box = findContentBounds(img);
    expect(box.x).toBe(0);
    expect(box.y).toBe(0);
    expect(box.w).toBe(80);
    expect(box.h).toBe(80);
  });
});
