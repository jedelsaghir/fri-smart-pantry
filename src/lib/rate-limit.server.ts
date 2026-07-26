/**
 * Simple in-process rate limiter for server functions (H-14).
 * Best-effort on multi-instance hosts — still reduces abuse on a single warm worker.
 * Never logs secrets.
 */

type Bucket = { count: number; resetAt: number };

const buckets =
  (globalThis as unknown as { __friggRateLimit?: Map<string, Bucket> }).__friggRateLimit ||
  new Map<string, Bucket>();
(globalThis as unknown as { __friggRateLimit: Map<string, Bucket> }).__friggRateLimit = buckets;

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number; message: string };

/**
 * Sliding fixed window: `limit` actions per `windowMs` for a given key.
 */
export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number; label?: string }
): RateLimitResult {
  const now = Date.now();
  const k = key.trim().toLowerCase() || "anon";
  let b = buckets.get(k);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(k, b);
  }
  b.count += 1;
  if (b.count > opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return {
      ok: false,
      retryAfterSec,
      message: `${opts.label || "Too many requests"}. Try again in ${retryAfterSec}s.`,
    };
  }
  return { ok: true, remaining: Math.max(0, opts.limit - b.count) };
}

/** Normalize client-ish identity for rate keys (email or invite code). */
export function rateKey(scope: string, id: string): string {
  return `${scope}:${(id || "anon").trim().toLowerCase().slice(0, 120)}`;
}
