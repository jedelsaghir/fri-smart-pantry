import { describe, expect, it } from "vitest";
import { analyzeCaptureQuality } from "./capture-quality";

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
  });
});
