/**
 * Dashboard greeting — always personal to the signed-in user (never a demo name).
 */

export function firstNameFromDisplayName(name: string | undefined | null): string {
  const n = (name || "").trim();
  if (!n || /^your name$/i.test(n) || n === "You") return "there";
  const first = n.split(/\s+/)[0];
  return first || "there";
}

export function timeOfDayGreeting(date = new Date()): "Good morning" | "Good afternoon" | "Good evening" {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** e.g. "Good afternoon, Sam" */
export function personalGreeting(fullName?: string | null, date = new Date()): string {
  return `${timeOfDayGreeting(date)}, ${firstNameFromDisplayName(fullName)}`;
}
