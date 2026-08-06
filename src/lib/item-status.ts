/**
 * Shared item urgency thresholds (L-05) — ItemCard + AlertsDrawer.
 * daysLeft null = no expiry tracked (never alert / never "Expired").
 */

export type ItemStatus = {
  label: string;
  color: string;
};

/** Days remaining thresholds used across cards and alerts */
export const EXPIRING_SOON_DAYS = 3;
export const WARNING_DAYS = 7;
export const USE_TODAY_DAYS = 1;

export function getItemStatus(daysLeft: number | null | undefined): ItemStatus {
  if (daysLeft == null || !Number.isFinite(daysLeft)) {
    return { label: "No expiry", color: "var(--color-muted-foreground)" };
  }
  if (daysLeft <= 0) return { label: "Expired", color: "var(--color-expiring)" };
  if (daysLeft <= USE_TODAY_DAYS) return { label: "Use today", color: "var(--color-expiring)" };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { label: "Expiring soon", color: "var(--color-soon)" };
  if (daysLeft <= WARNING_DAYS) return { label: "Warning", color: "var(--color-soon)" };
  return { label: "Fresh", color: "var(--color-fresh)" };
}

export function isExpiringSoon(daysLeft: number | null | undefined): boolean {
  return typeof daysLeft === "number" && Number.isFinite(daysLeft) && daysLeft <= EXPIRING_SOON_DAYS;
}

export function alertReasonForDaysLeft(daysLeft: number | null | undefined): string {
  if (daysLeft == null || !Number.isFinite(daysLeft)) return "No expiry";
  if (daysLeft <= 0) return "Expired";
  if (daysLeft === 1) return "Use today";
  return `${daysLeft}d left`;
}

/** True when item has a tracked expiry date */
export function hasExpiry(daysLeft: number | null | undefined): boolean {
  return typeof daysLeft === "number" && Number.isFinite(daysLeft);
}
