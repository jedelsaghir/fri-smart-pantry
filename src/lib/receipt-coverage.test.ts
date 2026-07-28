import { describe, expect, it } from "vitest";
import {
  coverageCoachMessage,
  coverageSegmentCount,
  coverageSegmentState,
  nextSectionIndex,
  sectionLabel,
  shutterCaptureLabel,
} from "./receipt-coverage";

describe("receipt coverage helpers", () => {
  it("labels Top/Mid/Bottom then #n", () => {
    expect(sectionLabel(0)).toBe("Top");
    expect(sectionLabel(1)).toBe("Mid");
    expect(sectionLabel(2)).toBe("Bottom");
    expect(sectionLabel(3)).toBe("#4");
  });

  it("grows segments with photo count", () => {
    expect(coverageSegmentCount(0)).toBe(3);
    expect(coverageSegmentCount(3)).toBe(4);
    expect(nextSectionIndex(2)).toBe(2);
  });

  it("segment states filled / next / empty", () => {
    expect(coverageSegmentState(0, 2)).toBe("filled");
    expect(coverageSegmentState(2, 2)).toBe("next");
    expect(coverageSegmentState(3, 2)).toBe("empty");
  });

  it("coaching and shutter labels", () => {
    expect(coverageCoachMessage(0)).toMatch(/top/i);
    expect(coverageCoachMessage(1)).toMatch(/slide down|overlap/i);
    expect(shutterCaptureLabel(0, false)).toBe("Capture top");
    expect(shutterCaptureLabel(1, false)).toBe("Capture middle");
    expect(shutterCaptureLabel(0, true)).toBe("Capturing…");
  });
});
