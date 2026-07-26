/**
 * Display helpers for money amounts (N-09 / M-11).
 * Defaults to EUR; expands when more currencies appear in receipts.
 */

export function moneySymbol(currency?: string): string {
  const c = (currency || "EUR").toUpperCase();
  if (c === "EUR") return "€";
  if (c === "USD" || c === "AUD" || c === "CAD") return "$";
  if (c === "GBP") return "£";
  if (c === "CHF") return "CHF ";
  return `${c} `;
}

export function formatMoney(amount: number, currency?: string): string {
  const sym = moneySymbol(currency);
  const n = Number.isFinite(amount) ? amount : 0;
  return `${sym}${n.toFixed(2)}`;
}

/** Format a unit price without forcing a currency code when unknown. */
export function formatPriceAmount(value: number | undefined, currency?: string): string {
  if (value === undefined || Number.isNaN(value)) return "";
  return formatMoney(value, currency);
}
