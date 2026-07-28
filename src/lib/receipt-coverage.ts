/**
 * Pure helpers for multi-photo receipt capture coverage (UX only).
 * Photos are ordered vertical sections — not real CV stitching.
 */

/** Default planned silhouette segments (Top / Middle / Bottom). */
export const DEFAULT_SECTION_COUNT = 3;

/** Short label for a 0-based section index. */
export function sectionLabel(sectionIndex: number): string {
  if (sectionIndex <= 0) return "Top";
  if (sectionIndex === 1) return "Mid";
  if (sectionIndex === 2) return "Bottom";
  return `#${sectionIndex + 1}`;
}

/** Longer label for shutter button / coaching. */
export function sectionTargetLabel(sectionIndex: number): string {
  if (sectionIndex <= 0) return "top";
  if (sectionIndex === 1) return "middle";
  if (sectionIndex === 2) return "bottom";
  return `section ${sectionIndex + 1}`;
}

/**
 * How many silhouette segments to draw.
 * At least 3; grows with photos so extras become Section 4+ and a next empty target remains.
 */
export function coverageSegmentCount(photoCount: number): number {
  return Math.max(DEFAULT_SECTION_COUNT, photoCount + 1);
}

/** Index of the next empty segment to capture (usually === photoCount). */
export function nextSectionIndex(photoCount: number): number {
  return Math.max(0, photoCount);
}

/** Shutter button label from current photo count. */
export function shutterCaptureLabel(photoCount: number, capturing: boolean): string {
  if (capturing) return "Capturing…";
  if (photoCount === 0) return "Capture top";
  const target = sectionTargetLabel(photoCount);
  if (photoCount === 1) return "Capture middle";
  if (photoCount === 2) return "Capture bottom";
  return `Capture ${target}`;
}

/**
 * State-aware coaching line for long receipts.
 * photoCount = number already taken (before next shutter).
 */
export function coverageCoachMessage(photoCount: number): string {
  if (photoCount <= 0) {
    return "Start at the top of the receipt";
  }
  if (photoCount === 1) {
    return "Got the top — slide down; keep a slight overlap with the last lines";
  }
  if (photoCount === 2) {
    return "Middle captured — continue down for the total / bottom";
  }
  return "Looking complete — Process, or capture another section if needed";
}

/** Always useful secondary tip after the first shot. */
export function coverageOverlapTip(photoCount: number): string | null {
  if (photoCount < 1) return null;
  return "Overlap the previous bottom edge slightly";
}

export type CoverageSegmentState = "empty" | "filled" | "next";

export function coverageSegmentState(
  segmentIndex: number,
  photoCount: number
): CoverageSegmentState {
  if (segmentIndex < photoCount) return "filled";
  if (segmentIndex === photoCount) return "next";
  return "empty";
}
