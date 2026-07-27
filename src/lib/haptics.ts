/**
 * Central haptic patterns (navigator.vibrate when available).
 * No-op safely on iOS Safari / unsupported environments.
 * Always pair with visual feedback — do not rely on haptics alone.
 */

export type HapticKind = "light" | "medium" | "success" | "warning" | "selection" | "error";

function vibrateSafe(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 8,
  medium: 16,
  selection: 6,
  success: [10, 40, 14],
  warning: [18, 40, 18],
  error: [30, 50, 30, 50, 40],
};

export function haptic(kind: HapticKind = "light"): void {
  vibrateSafe(PATTERNS[kind] ?? PATTERNS.light);
}

export function hapticLight(): void {
  haptic("light");
}

export function hapticMedium(): void {
  haptic("medium");
}

export function hapticSuccess(): void {
  haptic("success");
}

export function hapticWarning(): void {
  haptic("warning");
}

export function hapticSelection(): void {
  haptic("selection");
}

/** Shutter / photo capture */
export function hapticShutter(): void {
  vibrateSafe([12, 30, 18, 28, 10]);
}

/** Soft tick when a photo is queued */
export function hapticPhotoQueued(): void {
  vibrateSafe([6, 40, 12]);
}
