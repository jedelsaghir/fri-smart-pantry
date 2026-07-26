# Friġġ fix / status list

Updated after Critical, High, and Medium audit passes. See `docs/FULL-APP-AUDIT.md` for the full backlog.

## Done — Critical (C-01…C-07)

Server-fn split, passwordless fan-out, safer pull/push, trailing push, memory-backend warning, quota-aware photos.

## Done — High (H-01…H-14)

Auth production default, sync re-prompt, deterministic shelf life, expiry by id, honest family/admin, invite codes/rate limits, OCR split tests, camera deny sticky, rate limits, PantryEmptyState extract.

## Done — Medium (M-01…M-24)

| ID | Summary |
|----|---------|
| M-01 | Centralized storage keys (`AUTH_SESSION`, `FORCED_LOGOUT_IDS`, …) |
| M-02 | One-time auth session migration with real email |
| M-03 | Qty 0 → delete confirm (not silent floor at 1) |
| M-04 / M-10 | Shopping generate merges with `sameProduct` |
| M-05 | Partial OCR photo failures surfaced in result summary |
| M-06 | Total vs lines mismatch banner |
| M-07 | Multipack keeps pack-size label in name |
| M-08 | More recipes + looser ingredient matching |
| M-09 | Cook toast lists uncovered ingredients |
| M-11 | Finances currency from receipt / dominant currency |
| M-12 | Single invite resolver (`invite-resolve.ts`) |
| M-13 | Local + cloud revoke; local always cleared |
| M-14 | Settings: “In-app alerts” honest copy |
| M-15 | iOS Share → Add to Home Screen guidance |
| M-16 | Pantry list window (48) + “show more” |
| M-17 | Snapshot already strips large photos when oversized |
| M-18 | `components/ui/README.md` documents template kit |
| M-19 | Unit tests: invite resolve, recipes helpers, split smoke |
| M-20 | This file + AUTH/README refresh |
| M-21 | Scan process generation cancel on close |
| M-22 | Unique demo account ids |
| M-23 | Server rate limits (already H-14; auth/sync/OCR) |
| M-24 | `platform/feature-flags.ts` env-driven factory |

## Still open

Low / Nit items in `FULL-APP-AUDIT.md` (a11y, virtualization full, unused UI purge, E2E Playwright, etc.).
