import { describe, expect, it } from "vitest";
import {
  analyzeCaptureQuality,
  qualityIssueLabel,
  qualityIssueMessage,
} from "./capture-quality";

describe("analyzeCaptureQuality", () => {
  it("returns empty-safe result without a real video in node", () => {
    // In node/jsdom without a real video, helper should not throw
    const fake = {
      videoWidth: 0,
      videoHeight: 0,
    } as HTMLVideoElement;
    const q = analyzeCaptureQuality(fake);
    expect(q.ok).toBe(false);
    expect(q.issues.length).toBeGreaterThan(0);
    expect(q.issueLabel).toBeTruthy();
  });

  // N-06: canvas fixture — solid dark frame should flag dark / low contrast
  it("flags a solid dark canvas as not ok", () => {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, 160, 120);
    const q = analyzeCaptureQuality(canvas);
    expect(q.ok).toBe(false);
    expect(q.issues.length).toBeGreaterThan(0);
    expect(q.brightness).toBeLessThan(40);
  });

  it("scores a high-contrast patterned canvas without throwing", () => {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Checkerboard + white center "receipt" block
    for (let y = 0; y < 120; y += 8) {
      for (let x = 0; x < 160; x += 8) {
        ctx.fillStyle = (x + y) % 16 === 0 ? "#111" : "#eee";
        ctx.fillRect(x, y, 8, 8);
      }
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(30, 20, 100, 80);
    ctx.fillStyle = "#111";
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(40, 28 + i * 7, 80, 2);
    }
    const q = analyzeCaptureQuality(canvas);
    expect(q.fillRatio).toBeGreaterThan(0);
    expect(typeof q.sharpness).toBe("number");
    expect(q.issueLabel === null || typeof q.issueLabel === "string").toBe(true);
  });
});

describe("qualityIssue copy", () => {
  it("covers blurry dark far partial", () => {
    expect(qualityIssueLabel("blurry")).toMatch(/blur/i);
    expect(qualityIssueMessage("dark")).toMatch(/light/i);
    expect(qualityIssueMessage("too_far")).toMatch(/closer|fill/i);
    expect(qualityIssueMessage("partial")).toMatch(/cut|width|full/i);
  });
});
