# Friġġ — Full Line-by-Line App Audit Report

**Date:** 2026-07-25  
**Scope:** Entire `fri-smart-pantry` repository and product behaviour (read-only audit).  
**Method:** Code review of architecture, hooks, platform/server paths, domain libs, UI flows, tests, and known runtime failure modes. No fixes in this pass.

**Codebase snapshot:** ~151 TS/TSX files under `src/`; largest surfaces: `PantryScreen.tsx` (~1003 lines), `ReceiptScanFlow.tsx` (~951), `ManageFamilyPage.tsx` (~962), `ItemDetailsDrawer.tsx` (~700), `family.ts` (~698), `household-sync.functions.ts` (~615), `usePantry.ts` (~609). ~17 unit test files (~1.1k lines of tests). Domain tests strong for OCR/matching; UI/hooks largely untested.

---

## A. Executive summary

### Overall health

Friġġ is a **credible, premium-feeling family pantry PWA** with real product depth: multi-photo receipt OCR, fuzzy pantry matching, non-pantry filtering, review dispositions, shopping list + catalog, recipes with deduct, finances with receipt photos, cross-device household sync, and invite flows. Recent hardening (auth hashing/session, OCR health diagnostics, server-fn OCR helper split, scan UX polish) shows good engineering direction.

It is **not yet production-grade as a multi-user SaaS**. Identity is app-managed SHA-256 shared-secret style auth; cloud sync is last-write-wins snapshots with password-in-sessionStorage; household fan-out still assumes plain passwords in snapshots (broken after hash-only accounts); global “admin” is client-gated to a hardcoded email with only localStorage visibility; many UI-kit components are unused; several “family” surfaces still simulate multi-user behaviour. The product **looks finished** in many places where the backend model is intentionally demo-grade.

### Biggest risks

1. **Multi-device sync correctness** — login always applies remote snapshot; pushes are debounced LWW; fan-out of household to other member emails requires plain `acct.password` which is no longer stored → invitees may not get updates under shared cloud records the same way.
2. **Auth not production identity** — SHA-256 of `email:password:salt`, demo auto-create default, password in `sessionStorage`, no rate limits, no email verification.
3. **`household-sync.functions.ts` server-fn split risk** — same pattern that crashed OCR (`createServerFn` + module-local helpers) remains for sync/invites.
4. **localStorage quota** — receipts + label photos + full household blobs; silent `catch {}` on write failures.
5. **False confidence UX** — simulated family updates, simulated force-logout, global admin local-only directory, “notifications” that are not real push.

### Biggest strengths

- Calm, consistent premium mobile UI (teal brand, elevated cards, glass header, careful empty states).
- Receipt pipeline is serious: quality guidance, progressive multi-photo process, preprocess, merge, non-pantry, fuzzy match, review chips, expiry assist, barcode assist.
- Clear platform adapter seam (`src/platform/*`) for OCR/sync/invite/push.
- Solid pure-domain libs with unit tests (matching, merge, non-pantry, parse, pantry-ops, OCR health).
- Honest docs (`docs/AUTH.md`, platform README) about demo limits after hardening work.

---

## B. Complete issue list

Grouped by severity (Critical → Nit). IDs are stable for tracking.

---

### Critical

| ID | Area | Type | Description | Where | Impact | Suggested fix |
|----|------|------|-------------|-------|--------|---------------|
| **C-01** | Sync / Family | Bug | **Household fan-out skips hash-only accounts.** `fanOutHousehold` only copies snapshot to other emails when `acct.password` is present. After password hashing, snapshots strip plain passwords → multi-member cloud fan-out effectively dead. | `household-sync.functions.ts` ~144–168; `sanitizeAccountsForSync` | Invitees on own emails may not receive owner pushes; “shared household” appears broken across emails | Fan-out by invite-linked account hashes already stored server-side; never require plain password in snapshot |
| **C-02** | Sync | Bug / Edge case | **Login always applies remote snapshot if present** — does not use `shouldApplyRemote` to compare timestamps. A device with newer local work that failed to push can be wiped by older cloud on re-login. | `run-household-sync.ts` `pullAndMergeOnLogin` | Silent data loss | Apply only when remote newer, or merge CRDT-style; surface “cloud restored” conflict UI |
| **C-03** | Sync | Bug | **Last-write-wins with no version vectors.** Concurrent edits on two devices: later debounce push overwrites entire snapshot (items, receipts, members). | `pushHouseholdSync`, `scheduleHouseholdPush` | Lost edits between family members | Per-entity revision / merge fields; at least refuse older `updatedAt` |
| **C-04** | Security / Auth | Shortcoming | **Password scheme is SHA-256 shared secret**, not Argon2/bcrypt; hash computed client-side; plaintext password kept in `sessionStorage` for sync. | `auth.ts`, `household-sync.ts` `hashSyncPassword`, `sync-session.ts` | Credential theft from XSS/sessionStorage/dev tools is high impact | Server session tokens; server-side KDF; short-lived refresh tokens |
| **C-05** | Security | Bug / Shortcoming | **Global App Admin is client-only** (`isGlobalAppAdmin(email)` against hardcoded hotmail address). No server authority; any user who sets profile email could see the panel UI for local data only — and real multi-tenant directory does not exist. | `global-admin.ts` `GLOBAL_APP_ADMIN_EMAIL`; `GlobalAdminPanel.tsx` | False sense of admin security; privacy confusion | Server-gated admin + real user registry, or remove admin from product builds |
| **C-06** | Architecture | Bug risk | **`household-sync.functions.ts` mixes `createServerFn` with large module-scope helpers** (kvGet/Set, fanOut, invite logic). Same TanStack `?tss-serverfn-split` class of failure that broke OCR (`getApiKey is not defined`). | `household-sync.functions.ts` entire file | Intermittent 500s on live worker for sync/invites | Split to `household-sync.server.ts` + thin function wrappers (mirror OCR fix) |
| **C-07** | Storage / Perf | Edge case | **No localStorage quota handling.** Receipt photos + label photos + accounts + catalog can exceed 5MB. Writes use bare `try/catch` ignoring `QuotaExceededError`. | `usePantry`, `useReceipts`, `household-sync` apply/build, expiry assist | Silent data loss; broken sync; empty next load | Quota preflight; compress harder; offload photos; user-visible storage errors |

---

### High

> **Progress (High pass):** All H-01…H-14 addressed in code. Status column: **Done**.

| ID | Status | Fix summary |
|----|--------|-------------|
| **H-01** | **Done** | `getAuthMode()`: PROD defaults to production; explicit `VITE_AUTH_MODE=demo` required for auto-create |
| **H-02** | **Done** | `needsSyncPassword()` + Settings amber banner; Sync now asks for re-sign-in when session password missing |
| **H-03** | **Done** | Deterministic `getDefaultDaysLeft` (no Math.random) |
| **H-04** | **Done** | `addScannedItems` returns pantry ids; expiry signals prefer `pantryItemId` |
| **H-05** | **Done** | Expiry assist skip-primary copy; honest “no auto-read dates” |
| **H-06** | **Done** | Family drawer no longer simulates by default; Manage Family primary; sim only with `VITE_FAMILY_SIMULATE=1` |
| **H-07** | **Done** | Force logout honest “local flag only”; admin panel gated with `VITE_ENABLE_GLOBAL_ADMIN` (+ DEV) |
| **H-08** | **Done** | Memory backend `multiDeviceWarning` (prior must-fix) + Settings surface |
| **H-09** | **Done** | ~20-char invite codes; 7-day expiry; rate limits on resolve/accept |
| **H-10** | **Done** | `ocr-serverfn-split.test.ts` asserts thin functions + server helpers |
| **H-11** | **Done** | Sticky `friggg-camera-denied` session flag; library-only after deny |
| **H-12** | **Done** | Trailing push + `ok:false busy` (prior must-fix) |
| **H-13** | **Done** | Extracted `PantryEmptyState`; PantryScreen reduced (~880 lines) |
| **H-14** | **Done** | In-process rate limits on pull/push/invite/OCR (`rate-limit.server.ts`) |

#### Original High descriptions (reference)

| ID | Area | Type | Description | Where | Impact | Suggested fix |
|----|------|------|-------------|-------|--------|---------------|
| **H-01** | Auth | Shortcoming | **Default `VITE_AUTH_MODE=demo`** auto-creates accounts on unknown email sign-in. Easy to ship “prod” without flipping the flag. | `auth.ts` `getAuthMode`; `family.ts` `signInWithAccount` | Account squatting / unexpected auto-owners | Default production on Lovable prod; require explicit demo flag |
| **H-02** | Auth | Edge case | **Background sync dies after tab close** — creds only in sessionStorage; no recovery once plain passwords removed from accounts. | `sync-session.ts` | User thinks “logged in” (local session) but cloud stop updating | Re-prompt password for sync, or server session cookie |
| **H-03** | Pantry | Bug / Edge case | **`getDefaultDaysLeft` uses `Math.random()`** — same item can get different expiry each add/scan; non-reproducible, confuses users. | `usePantry.ts` ~72–116 | Unpredictable alerts/expiry | Deterministic table by category; optional override only |
| **H-04** | Scan | Edge case | **`applyExpirySignals` matches by name+unit only** after async React updates — may attach photo/daysLeft to wrong/merged row or miss newly created id. | `usePantry.applyExpirySignals`; scan flow timing | Wrong item gets label photo / wrong expiry | Return created/updated ids from `addScannedItems`; key signals by id |
| **H-05** | Scan | Shortcoming | **Expiry label OCR not implemented** — honest copy, but step may feel empty vs expectation after multi-photo investment. | `ReceiptExpiryAssistStage`, `label-photo.ts` | Wasted user effort; low conversion | Optional light date parse from photo later; or tighter UX copy + skip bias |
| **H-06** | Family | Shortcoming | **“Simulate member update” invents pantry items** — not real multi-user sync. Labeled demo but still in primary Family drawer. | `PantryScreen.simulateFamilyUpdate`; `FamilyDrawer` | False confidence that family is live | Gate behind debug; replace with “open invite” only |
| **H-07** | Family / Admin | Shortcoming | **Force logout is simulated** — local flag list, not server session revoke. | `global-admin.ts` `forceLogoutUser`; toast “simulated” | Admin thinks users are signed out remotely | Server session invalidation or remove feature |
| **H-08** | Sync | Edge case | **Memory backend default without Upstash** — invites/sync evaporate on cold start / multi-instance. Status may still say configured. | `household-sync.functions.ts` backends | Broken cross-phone invites on serverless | Require Upstash for prod; hard-fail status if memory |
| **H-09** | Security | Shortcoming | **Invite codes are the secret** — short random codes in URL; stored server-side but no rate limit / brute-force protection on resolve/accept. | `member-invite`, invite RPCs | Invite guessing | Longer codes, rate limit, one-time + expiry |
| **H-10** | OCR | Debt | OCR path fixed for split, but **no integration test** that imports functions file the way production split does. | `ocr-receipt.functions.ts` / `.server.ts` | Regression risk | Smoke test or CI build assert for split bundle |
| **H-11** | UX / PWA | Edge case | **Camera permission denied** path is soft, but reopening scan re-requests; installed PWA iOS may loop poorly. | `ReceiptScanFlow` camera effects | Frustration; abandoned scans | Cache denied state; library-only mode sticky |
| **H-12** | Sync | Bug | **Push while `pushInFlight` returns `{ ok: true, reason: "busy" }`** — caller may treat as success and drop retry. | `flushHouseholdPush` | Missed uploads | Queue trailing push; return ok:false busy |
| **H-13** | Architecture | Debt | **PantryScreen god-object** (~1000 lines) wires every domain + drawers; hard to reason about re-renders and tests. | `PantryScreen.tsx` | Slow iteration; easy regressions | Split route-level containers per tab |
| **H-14** | Security | Shortcoming | **No server rate limiting** on pull/push/OCR/invite. | server functions | Abuse, cost explosion on xAI | Rate limit by IP/email |

---

### Medium

| ID | Area | Type | Description | Where | Impact | Suggested fix |
|----|------|------|-------------|-------|--------|---------------|
| **M-01** | Auth | Inconsistency | `AUTH_SESSION_KEY` not in `STORAGE_KEYS`; forced-logout key hardcoded separately. | `auth.ts`, `global-admin.ts`, `storage-keys.ts` | Fragmented storage inventory | Centralize all keys |
| **M-02** | Auth | Edge case | Legacy session soft-upgrade with `email: ""` / `legacy@local` is fragile. | `readAuthSession` | Weird session state after upgrades | One-time migration write full session |
| **M-03** | Pantry | Edge case | Qty floor: cannot represent “used last unit” as 0; remove is separate. Comment says never auto-delete via qty. | `usePantry` patchItem | Users expect qty 0 = gone | Explicit “mark empty” or allow 0 → prompt delete |
| **M-04** | Pantry | Edge case | **Duplicate names** across storages allowed; matching/shopping de-dupe by name case-insensitive only — can collapse distinct products. | `useShoppingList`, `sameProduct` | Wrong merge suggestions | Stronger identity (brand + size) |
| **M-05** | Scan | Edge case | Progressive OCR starts next enhance before previous OCR finishes — good, but **partial success** (1 of 3 photos fails) still merges; user may not know which photo failed. | `ReceiptScanFlow` startProcessing | Silent incomplete reads | Per-photo error chips on result |
| **M-06** | Scan | Shortcoming | Total vs lines sanity only **nudges confidence** — never explains mismatch to user. | `applyTotalLineSanity` | Harder review of bad totals | Soft banner “line totals don’t match receipt total” |
| **M-07** | Scan | Edge case | Multipack parse can set qty=6 pcs while price is multipack total — unit economics wrong. | `applyMultipackQtyUnit` | Odd prices in finances | Keep size metadata; price per pack |
| **M-08** | Recipes | Shortcoming | **Static ~handful of recipes** hardcoded; ingredient names must fuzzy-match pantry names. | `data/recipes.ts`, `recipe-helpers` | Feature feels shallow vs UI polish | Expand catalog; looser matching |
| **M-09** | Recipes | Edge case | Cook deduct uses name match; Undo restores full pantry snapshot only if toast action used. | `useRecipes.cookRecipe` | Partial deduct confusion | Show which lines missed |
| **M-10** | Shopping | Edge case | Generate uses `daysLeft <= 2` heuristic + min stock; no “already on list” merge quality beyond name. | `useShoppingList` | Duplicate-ish lines | Merge by sameProduct |
| **M-11** | Finances | Shortcoming | Receipt store/total from OCR may be null; UI still EUR-centric. | `FinancialsScreen`, receipts | International users | Currency from OCR throughout |
| **M-12** | Family | Edge case | Same-device invite vs cloud invite race; dual paths in LoginScreen. | `LoginScreen`, invite providers | Confusing errors | Single invite resolver with ordered sources |
| **M-13** | Family | Edge case | Invite “cancel/revoke” cloud + local can desync if offline. | `member-invite`, ManageFamily | Ghost invites | Idempotent revoke + pull |
| **M-14** | UX | Inconsistency | Notifications toggle in settings requests browser Notification via push provider, but **alerts are in-app only** when push is none. | `usePreferences`, `push-none`, AlertsDrawer | Users expect OS push | Clarify copy; wire web-push or rename |
| **M-15** | UX | Inconsistency | PWA install banner Android-centric (`beforeinstallprompt`); iOS needs manual Share sheet — no iOS-specific instructions. | `usePwaInstall`, PantryScreen banner | iOS users never install | iOS install help sheet |
| **M-16** | Perf | Debt | Full pantry re-render lists without virtualization; fine for small, bad for 200+ items + photos. | `PantryScreen` ItemCard map | Jank | Virtualize lists |
| **M-17** | Perf | Debt | Debounced push on **any** items/members/receipts/catalog change serializes **entire** snapshot including receipt images. | `scheduleHouseholdPush`, `buildSnapshotFromLocalStorage` | Battery, network, Upstash size | Separate photo store; delta sync |
| **M-18** | Architecture | Debt | **~47 shadcn UI components**; frigg screens use drawer/input/switch/alert-dialog mainly. Huge unused surface. | `src/components/ui/*` | Bundle noise / maintenance | Tree-shake audit; delete unused |
| **M-19** | Tests | Debt | **No component/E2E tests** for Login, Scan, Manage Family, sync. Domain unit tests only. | `src/**/*.test.ts` | Regressions ship easily | Playwright smoke + hook tests |
| **M-20** | Docs | Debt | FIXLIST.md / AUTH.md partially outdated relative to latest scan/OCR work. | `docs/*` | Wrong operator mental model | Refresh after each major push |
| **M-21** | Scan | Edge case | Closing mid-process: `handleClose`/`resetFlow` stops camera but in-flight OCR promises may still call setState. | `ReceiptScanFlow` | React warnings; rare bad state | AbortController + cancelled flag on process |
| **M-22** | Auth | Edge case | Demo auto-create uses fixed id `acct-demo-owner` — second demo email can collide. | `signInWithAccount` demo path | Account overwrite weirdness | Unique ids always |
| **M-23** | Security | Shortcoming | Client can call any createServerFn with email/password — **no CAPTCHA / lockout**. | sync + OCR | Credential stuffing | Rate limit + backoff |
| **M-24** | Platform | Debt | `setPlatform` for tests exists; no DI for production feature flags. | `platform/index.ts` | Harder staging modes | Env-driven platform factory |

---

### Low

| ID | Area | Type | Description | Where | Impact | Suggested fix |
|----|------|------|-------------|-------|--------|---------------|
| **L-01** | UX | Nit / Inconsistency | Header greeting vs profile name paths multiple sources of truth. | `greeting.ts`, `usePreferences` | Occasional “there” | Single profile selector |
| **L-02** | UX | Inconsistency | “Add item” button hidden when list empty (empty state has own CTA) — good, but scan FAB + empty can still confuse. | Pantry empty vs FAB | Mild clutter | Already improved; keep one primary |
| **L-03** | Scan | Nit | Confidence bands high≥0.85 / med≥0.65 vs auto-add 0.8 — two systems to learn. | `confidenceBand`, `AUTO_ADD` | Review chip vs auto mismatch | Align thresholds docs in UI |
| **L-04** | Scan | Nit | Batch “Keep all low confidence” only toasts; doesn’t change disposition much. | ReceiptReviewStage handlers | Weak action | Prefer discard batch only or promote to confirm |
| **L-05** | Pantry | Nit | ItemCard status colors vs AlertsDrawer may use slightly different thresholds. | ItemCard, pantry-alerts | Inconsistent urgency | Share helpers |
| **L-06** | Pantry | Edge case | Freezer move extends days with heuristics; moving back doesn’t reverse. | `moveItem` | Expected | Document; optional reverse |
| **L-07** | Finances | Nit | Manual add receipt vs scan receipt UX quality gap. | FinancialsScreen | Feels secondary | Align design tokens |
| **L-08** | Family | Nit | QR invite via third-party `api.qrserver.com` — privacy/network dependency. | `family.ts` buildQrImageUrl | Offline QR fails | Local QR lib |
| **L-09** | A11y | Shortcoming | Many icon-only controls; some good aria-labels, incomplete coverage (~89 aria/role hits but large UI). | frigg components | Screen reader gaps | Pass with axe |
| **L-10** | A11y | Shortcoming | Focus trap in full-screen scan / barcode overlay not verified. | ReceiptScanFlow, BarcodeAssistButton | Keyboard users stuck | Focus management |
| **L-11** | A11y | Shortcoming | Contrast on muted chips over photos (camera overlays) may fail WCAG. | capture stage overlays | Readability | Stronger scrim |
| **L-12** | iOS | Edge case | `navigator.vibrate` no-ops — fine; shutter relies on visual only. | capture-quality haptics | Less feedback on iOS | Stronger visual pulse (done partially) |
| **L-13** | Android | Edge case | BarcodeDetector support varies; graceful fail OK. | barcode-lookup | Feature missing | Manual barcode entry field |
| **L-14** | Code | Debt | `SEED` deprecated alias for EMPTY_PANTRY still exported. | usePantry | Confusion | Remove export |
| **L-15** | Code | Debt | package name still `tanstack_start_ts`. | package.json | DX | Rename to frigg |
| **L-16** | Code | Debt | Double toast paths on scan confirm carefully mitigated but complex `pantryToastShownRef`. | ReceiptScanFlow | Fragile | Single outcome event |
| **L-17** | Sync | Nit | `shouldApplyRemote` tested but **unused** in login pull path. | household-sync.ts vs run-household-sync | Dead API | Wire it or delete |
| **L-18** | Catalog | Edge case | Merge groups in database don’t update pantry item names. | useItemCatalog | Split identities remain | Optional cascade rename |
| **L-19** | Settings | Shortcoming | Backup export/import exists (`backup.ts`) but discoverability in Settings may be buried. | SettingsDrawer | Users don’t find it | Promote export |
| **L-20** | Offline | Edge case | SW caches shell assets only (`friggg-v4-...`); app shell for SPA depends on network for JS. | `public/sw.js` | Offline claim overstated | Precache build assets or soft copy |
| **L-21** | Offline | Edge case | OCR/sync require network; offline scan queues not implemented. | ReceiptScanFlow | Fail mid-store | Queue photos offline |
| **L-22** | Security | Nit | Admin email hardcoded in client bundle — scrapeable. | global-admin.ts | Info leak of owner email | Env-only server check |
| **L-23** | UX | Nit | Dark mode class on `documentElement`; flash possible before effect. | usePreferences | FOUC | Inline script in root |
| **L-24** | Recipes | Nit | Filter “use expiring” depends on daysLeft quality (random). | recipe-helpers | Odd suggestions | Fix H-03 first |
| **L-25** | Types | Nit | `PantryItem.labelPhotoDataUrl` can bloat sync types without size budget. | types/pantry.ts | See C-07 | Cap size or externalize |

---

### Nit

| ID | Area | Type | Description | Where | Impact | Suggested fix |
|----|------|------|-------------|-------|--------|---------------|
| **N-01** | Docs | Nit | Typo-prone product name Friġġ / friggg key prefix mixture. | storage keys `friggg-*` | Mild | Keep; document prefix |
| **N-02** | UX | Nit | Loading finances Suspense fallback plain text. | PantryScreen | Polish | Skeleton |
| **N-03** | UX | Nit | “Coming soon” banner path still exists for unknown bottom-nav keys. | PantryScreen | Dead branch? | Remove if nav sealed |
| **N-04** | Code | Nit | eslint-disable for img in scan stages. | receipt-scan | Noise | Shared Image component |
| **N-05** | Code | Nit | Some `require` avoided but dynamic patterns historically used. | — | — | Prefer static imports |
| **N-06** | Tests | Nit | capture-quality only tests empty video. | capture-quality.test.ts | Weak | Canvas fixture tests |
| **N-07** | Tests | Nit | No test for fanOut skipping hash-only accounts. | — | C-01 invisible | Add unit test |
| **N-08** | UX | Nit | Emoji pickers are free-text not picker. | Login, profile | Mild | Emoji sheet |
| **N-09** | UX | Nit | Price always € symbol in places. | ItemDetails, review | Localization | Use currency code |
| **N-10** | Architecture | Nit | `use-mobile.tsx` may be unused by frigg shell. | hooks | Dead | Verify and remove |
| **N-11** | DX | Nit | No `typecheck` script in package.json (tsc used ad hoc). | package.json | DX | Add script |
| **N-12** | DX | Nit | No CI config visible in repo for required checks. | — | Drift | GitHub Action |
| **N-13** | Scan | Nit | Long-receipt “move down” hint shows even for short receipts. | Capture stage | Mild noise | Show only if last photo fill high |
| **N-14** | Family | Nit | Activity log unbounded growth in localStorage. | useFamily | Quota | Cap last N |
| **N-15** | Security | Nit | Invite URLs in history after join may linger. | clearInviteFromUrl | Mild | Always clear |
| **N-16** | UX | Nit | Splash 720ms fixed — feels long on repeat visits. | useAuthSession | Perceived lag | Skip if session warm |
| **N-17** | Code | Nit | `LEGACY_SEED_ITEM_IDS` strip forever — good, but undocument in user-facing changelog. | usePantry | — | Changelog note |
| **N-18** | UX | Nit | Global admin panel density differs from Manage Family aesthetic. | GlobalAdminPanel | Visual drift | Align spacing tokens |
| **N-19** | Perf | Nit | Quality interval 400ms while camera open — acceptable; could pause when tab hidden. | ReceiptScanFlow | Battery | visibility pause (partially elsewhere) |
| **N-20** | Docs | Nit | README still partially lagging latest scan polish. | README.md | — | Sync with audit |

---

## C. Full suggestion list

1. **Server-side sessions** for household sync (replace password-in-sessionStorage).
2. **Argon2id / bcrypt** password hashing with per-user salt on server.
3. **Email verification** before account can push/pull.
4. **CRDT or field-level merge** for pantry items (id-based).
5. **Photo object store** (S3/R2) instead of data URLs in snapshots.
6. **Real web push** for expiry alerts (with quiet hours).
7. **Household roles** (owner / editor / viewer) enforced server-side.
8. **Audit log** of who changed qty (not only local activity feed).
9. **Barcode offline DB** (Open Food Facts cache) for airplane mode.
10. **On-device OCR fallback** when xAI down (even if lower quality).
11. **Receipt line learning** — user corrections train catalog aliases.
12. **Unit conversion** (g↔kg, ml↔L) in matching and recipes.
13. **Multi-currency** and store-level tax stripping options.
14. **Shared shopping list** live cursors (who checked milk).
15. **Widget / shortcut** “use 1 milk” from home screen.
16. **Export CSV** for finances and pantry.
17. **Import from other apps** (AnyList, Bring).
18. **Allergen / diet tags** on items and recipes.
19. **Waste tracker** — items deleted expired vs used.
20. **Smart min-stock** from purchase history.
21. **Family calendar** of expiring items.
22. **iOS install coach mark** (Share → Add to Home Screen).
23. **Accessibility audit** with VoiceOver/TalkBack scripts.
24. **Playwright** critical path: login → scan fixture → pantry.
25. **Storybook** for ItemCard / review row / login.
26. **Feature flags** file for demo simulation surfaces.
27. **Strip unused shadcn** components to reduce cognitive load.
28. **Split ManageFamilyPage** (962 lines) like ReceiptScanFlow.
29. **Observability**: client error reporting already partial — add OCR latency metrics.
30. **Cost controls**: max OCR photos/day per household.
31. **Invite expiry** (7 days) and single-use enforcement server-side.
32. **Password reset** flow (even magic link).
33. **2FA optional** for owner.
34. **Dark mode pure black OLED** option.
35. **Haptics polyfill** patterns more consistently.
36. **Swipe actions** on ItemCard (use / delete).
37. **Bulk select** pantry items for move/delete.
38. **Search pantry** global.
39. **Sort/filter** by expiry, name, storage.
40. **Empty freezer illustration** parity with fridge empty art.
41. **Onboarding tooltips** first scan.
42. **“Trusted device”** remember sync without retyping password.
43. **Admin: real metrics** users, scans, errors (if SaaS).
44. **Legal**: privacy policy for receipt images sent to xAI.
45. **Data residency** controls for EU.
46. **Model picker** in settings for power users (OCR model env only today).
47. **Retry with alternate model** on OCR empty.
48. **Conflict UI**: “Keep mine / Keep cloud / Merge”.
49. **Per-item notes** (not only label photo).
50. **Location storage** (which shelf) optional.
51. **Printer-friendly** shopping list.
52. **WhatsApp share** shopping list (invite already has WA).
53. **Reduce motion** media query respect for scan animations.
54. **Semantic version** badge in settings (build stamp exists partially).
55. **Changelog in-app** after updates.
56. **Kill-switch** remote config if xAI outage.
57. **Contract tests** for server fn response shapes.
58. **Property tests** for multipack parser.
59. **Fuzz** OCR JSON parser with garbage.
60. **Document Upstash key size limits** vs snapshot growth.

---

## D. Priority roadmap

### Must-fix now

1. **C-06** — Split `household-sync.functions.ts` helpers like OCR (prevent live 500s).
2. **C-01** — Fix fan-out without plain passwords (multi-email household sync).
3. **C-02 / C-03** — Safer pull/push conflict rules (at least respect `updatedAt`).
4. **H-12** — Trailing push when busy (don’t drop updates).
5. **H-08** — Fail clearly when sync backend is memory on multi-device deploys.
6. **C-07** — Quota-aware storage for photos (or stop syncing full data URLs).

### Should-fix next

1. **H-01** — Production auth mode default on real hosts.
2. **H-03** — Deterministic shelf-life defaults.
3. **H-04** — Expiry signals by item id.
4. **H-06 / H-07** — Demote or remove simulated family/admin actions from primary UI.
5. **C-04 / C-05** — Auth/session and admin honesty (or real server admin).
6. **H-11** — Sticky camera-denied / library-only mode.
7. **M-17** — Snapshot size: exclude or externalize images.
8. **M-19** — Minimal E2E smoke tests.
9. **M-15** — iOS PWA install guidance.
10. **L-17** — Wire or remove `shouldApplyRemote`.

### Nice-to-have later

- Recipe expansion, web push, CRDTs, virtualization, unused UI purge, barcode offline DB, accessibility deep pass, multi-currency, waste analytics, server KDF + email verify (full identity).

---

## E. Test / verification gaps

| Gap | Risk |
|-----|------|
| No E2E (Playwright/Cypress) for login, scan, invite, sync | Highest regression risk |
| No tests for `family.ts` sign-in/register/invite | Auth breaks silently |
| No tests for `run-household-sync` apply/push orchestration | Data loss paths untested |
| No tests for fan-out / invite accept server logic | Cross-device invites fragile |
| No React Testing Library for LoginScreen / ReceiptScanFlow / ManageFamily | UI regressions |
| `shouldApplyRemote` unit-tested but unused in production path | False confidence |
| Capture quality / preprocess only light node tests | Mobile vision heuristics unproven in CI |
| No load test for large pantry + many receipts | Quota/perf surprises |
| No contract test for createServerFn split (OCR fixed; sync not) | Production-only crashes |
| No security tests (rate limit, invite brute force) | Abuse |
| Recipes/shopping mostly untested beyond small shopping.test | Logic drift |
| Manual-only iOS Safari camera / PWA / safe-area | Platform bugs |

**Existing strengths:** ocr-parse, ocr-merge, item-matching, non-pantry, pantry-ops, catalog, auth (partial), ocr-health, household-sync pure helpers, barcode unit helpers.

---

## F. Out of scope / accepted demo limits

These are **intentional or documented** for the current product stage — not treated as accidental bugs, but must remain visible to operators:

| Limit | Notes |
|-------|--------|
| No OAuth / magic link / passkeys | Password accounts only (`docs/AUTH.md`) |
| No email verification | Anyone can register an unused email |
| SHA-256 household password hash | Not a full password KDF |
| Demo auth auto-create when `VITE_AUTH_MODE=demo` | Convenience for demos |
| SessionStorage sync password | Required for push without server sessions |
| Push notifications | `push-none`; in-app Alerts only |
| Global admin local directory | Not a multi-tenant control plane |
| Simulate family member pantry updates | Explicit demo affordance |
| Simulated force logout | Local only |
| Static recipe pack | Not a content platform |
| Expiry photos not auto-read | Honest limitation |
| Barcode depends on BarcodeDetector + OFF network | Graceful failure |
| Memory sync backend | Dev fallback when Upstash unset |
| Offline = local data only | OCR/sync need network |
| Single hardcoded global admin email | Product owner convenience |

---

## Solid areas (brief)

- Receipt capture → progressive process → merge → filter → match → review → outcome summary is **product-grade UX**.
- Platform boundary and OCR server/helper split (post-fix) are **sound patterns**.
- Pure domain libs with tests enable safe iteration.
- Premium visual system (teal brand, cards, drawers) is consistent when components stay in frigg design language.
- Login/onboarding flow preserves calm sequential UX while auth storage improved.

---

## Appendix: Key files reviewed

| Area | Paths |
|------|--------|
| Shell | `PantryScreen.tsx`, hooks under `src/hooks/*` |
| Scan | `ReceiptScanFlow.tsx`, `receipt-scan/*`, `ocr-*`, `capture-quality.ts`, `barcode-lookup.ts` |
| Auth | `auth.ts`, `family.ts`, `useAuthSession.ts`, `sync-session.ts`, `docs/AUTH.md` |
| Sync | `household-sync.ts`, `household-sync.functions.ts`, `run-household-sync.ts` |
| Family | `ManageFamilyPage.tsx`, `member-invite.ts`, invite platform adapters |
| Admin | `global-admin.ts`, `GlobalAdminPanel.tsx` |
| Platform | `src/platform/*` |
| Storage | `storage-keys.ts`, pantry/receipts/catalog hooks |
| PWA | `usePwaInstall.ts`, `public/sw.js` |
| Tests | `src/lib/*.test.ts` |

---

*End of audit report. No code changes were made in the audit pass itself; this document is the deliverable.*
