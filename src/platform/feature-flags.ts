/**
 * Env-driven feature flags (M-24).
 * Read once per call; safe in browser and SSR.
 */

export type FeatureFlags = {
  /** VITE_AUTH_MODE=demo */
  demoAuth: boolean;
  /** VITE_ENABLE_GLOBAL_ADMIN */
  globalAdmin: boolean;
  /** VITE_FAMILY_SIMULATE */
  familySimulate: boolean;
  /** Prefer durable sync messaging when Upstash not required */
  requireDurableSync: boolean;
  /** Use demo OCR adapter (tests only when set via setPlatform) */
  forceDemoOcr: boolean;
};

function envFlag(name: string): boolean {
  try {
    const v = String((import.meta as { env?: Record<string, string> }).env?.[name] || "")
      .trim()
      .toLowerCase();
    return v === "1" || v === "true" || v === "yes";
  } catch {
    return false;
  }
}

export function getFeatureFlags(): FeatureFlags {
  return {
    demoAuth: envFlag("VITE_AUTH_MODE")
      ? String(import.meta.env.VITE_AUTH_MODE).toLowerCase() === "demo"
      : Boolean(import.meta.env?.DEV),
    globalAdmin: envFlag("VITE_ENABLE_GLOBAL_ADMIN") || Boolean(import.meta.env?.DEV),
    familySimulate: envFlag("VITE_FAMILY_SIMULATE"),
    requireDurableSync: envFlag("VITE_REQUIRE_DURABLE_SYNC"),
    forceDemoOcr: envFlag("VITE_FORCE_DEMO_OCR"),
  };
}
