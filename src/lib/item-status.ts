/**
 * Shared item urgency thresholds (L-05) — ItemCard + AlertsDrawer.
 */

export type ItemStatus = {
  label: string;
  color: string;
};

/** Days remaining thresholds used across cards and alerts */
export const EXPIRING_SOON_DAYS = 3;
export const WARNING_DAYS = 7;
export const USE_TODAY_DAYS = 1;

export function getItemStatus(daysLeft: number): ItemStatus {
  if (daysLeft <= 0) return { label: "Expired", color: "var(--color-expiring)" };
  if (daysLeft <= USE_TODAY_DAYS) return { label: "Use today", color: "var(--color-expiring)" };
  if (daysLeft <= EXPIRING_SOON_DAYS) return { label: "Expiring soon", color: "var(--color-soon)" };
  if (daysLeft <= WARNING_DAYS) return { label: "Warning", color: "var(--color-soon)" };
  return { label: "Fresh", color: "var(--color-fresh)" };
}

export function isExpiringSoon(daysLeft: number): boolean {
  return daysLeft <= EXPIRING_SOON_DAYS;
}

export function alertReasonForDaysLeft(daysLeft: number): string {
  if (daysLeft <= 0) return "Expired";
  if (daysLeft === 1) return "Use today";
  return `${daysLeft}d left`;
}
