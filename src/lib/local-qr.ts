/**
 * Offline invite visual (L-08) — no third-party host (no api.qrserver.com).
 *
 * Produces a data-URI SVG “invite card” with the URL text so Manage Family
 * works offline. For machine-scannable QR, the share link / copy button is
 * the reliable path; this image is a calm offline visual only.
 */

export function buildLocalQrDataUrl(text: string, size = 200): string {
  const safe = escapeXml(text.slice(0, 180));
  const short = escapeXml(truncateMiddle(text, 42));
  const s = Math.max(120, Math.min(320, size));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="100%" height="100%" rx="16" fill="#f7f7f5"/>
  <rect x="12" y="12" width="${s - 24}" height="${s - 24}" rx="12" fill="#fff" stroke="#e5e5e2" stroke-width="1.5"/>
  <rect x="28" y="28" width="18" height="18" fill="#1a1a1a"/>
  <rect x="${s - 46}" y="28" width="18" height="18" fill="#1a1a1a"/>
  <rect x="28" y="${s - 46}" width="18" height="18" fill="#1a1a1a"/>
  <text x="${s / 2}" y="${s / 2 - 8}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" font-weight="600" fill="#1a1a1a">Invite link</text>
  <text x="${s / 2}" y="${s / 2 + 12}" text-anchor="middle" font-family="ui-monospace,monospace" font-size="8" fill="#666">${short}</text>
  <text x="${s / 2}" y="${s - 22}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="8" fill="#999">Copy link to share · offline</text>
  <title>${safe}</title>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
