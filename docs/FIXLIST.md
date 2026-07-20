# Friġġ — Tracked Fix List

Derived from the full repo audit. Work top-down (P0 → P1 → P2).

**Status key:** `todo` · `in_progress` · `done` · `wontfix`

**Last updated:** 2026-07-19

---

## P0 — Correctness & trust

| ID | Status | Area | Fix | Acceptance criteria |
|----|--------|------|-----|---------------------|
| P0-1 | done | Pantry | **Confirm before qty hits 0** (drawer / any qty path). Soft-archive or confirm instead of silent delete via `patchItem` / steppers. | Setting quantity to 0 always shows confirm; cancel leaves qty unchanged; confirm removes item (and still records catalog delete if applicable). |
| P0-2 | done | Settings | **Wire or remove Profile Edit.** Either open editable profile (name, email, emoji) persisted to `friggg-profile`, or remove the Edit button. | No dead control; profile shown matches stored profile (not hardcoded Elena only). |
| P0-3 | done | Settings | **Wire or remove Notifications toggle.** Persist preference; if no notification system yet, hide toggle and show “Coming soon” or implement local expiry reminders later. | Toggle either works + persists, or is not shown as a working control. |
| P0-4 | done | Shopping list | **Persist shopping list** to `localStorage` (e.g. `friggg-shopping-list`). Load on mount. | Refresh keeps list; regenerate/clear still behave correctly. |
| P0-5 | done | Header | **Bell control semantics.** Either open a real notifications panel, or relabel / change icon so it doesn’t claim “Notifications” while opening Family. | Label/action match; no misleading ARIA. |
| P0-6 | done | Receipt scan | **Label demo scan clearly** until camera/OCR are real (“Demo detection” / banner on capture). | User can tell Take Photo doesn’t read the image; Library still stores photo + mock lines. |

---

## P1 — Product completeness

| ID | Status | Area | Fix | Acceptance criteria |
|----|--------|------|-----|---------------------|
| P1-1 | todo | Pantry | **Merge qty on add** when same `name` + `unit` + `storage` (scan, manual add, family sim, mark purchased). | No duplicate rows for identical identity; qty increases. |
| P1-2 | todo | Finances | **Manual “Log purchase”** (store, total, optional lines, optional photo). | Creates `StoredReceipt`; appears in list; updates totals. |
| P1-3 | todo | Recipes | **Header stats from real data** (count of recipes in filter / can-make), not magic `6` / `3`. | Numbers match filtered list. |
| P1-4 | todo | Recipes | **Confirm before cook** deducts ingredients; show what will be deducted; optional undo. | Cancel leaves pantry unchanged. |
| P1-5 | todo | Shopping | **Add to list from Database / pantry** (not only regenerate). | User can pick catalog or pantry item into shopping list. |
| P1-6 | todo | Shopping | **Warn before Regenerate** if list non-empty (confirm dialog). | Cancel keeps current list. |
| P1-7 | todo | Activity | **Persist activity log** (cap length, e.g. 50). | Survives refresh. |
| P1-8 | todo | Receipts | **Write scan line prices → pantry `latestPrice`** when items added (best-effort match). | Matched pantry items show price after scan. |
| P1-9 | todo | Architecture | **Split `PantryScreen`** into view modules (List, Recipes, Settings drawers, etc.). | Behavior unchanged; main file much smaller. |

---

## P2 — Cleanup & polish

| ID | Status | Area | Fix | Acceptance criteria |
|----|--------|------|-----|---------------------|
| P2-1 | todo | UI kit | **Document or trim unused `src/components/ui/*`** (calendar, sidebar, etc.). Prefer document “scaffold only” over mass delete unless desired. | README or comment lists used vs scaffold; no confusion. |
| P2-2 | todo | Hooks | **Remove unused exports / destructures:** `updateItemQty`, `setItemQty`, `updateItemName`, `updateItemPrice`, `moveToFreezer` if unused; `skipMergeGroup` no-op; unused `lowStockCount` / `updateQty` destructures; dead `attentionTone` local. | No unused dead API surface in screen. |
| P2-3 | todo | lib | **Centralize localStorage keys** — use `HOUSEHOLD_KEY` / shared constants everywhere (LoginScreen string literals). | Single source of keys. |
| P2-4 | todo | Catalog merge | **Pick primary** when merging (user selects which name wins). | Not only longest-name heuristic. |
| P2-5 | todo | Finances | **Restore or replace trends / by-store** charts using real receipt data. | Charts reflect saved receipts. |
| P2-6 | todo | a11y | Family avatar strip: use `button`, keyboard focus. | Passes basic keyboard use. |
| P2-7 | todo | Copy | Replace hardcoded **“July 2026”** with current month/year. | Dynamic label. |
| P2-8 | todo | Data | **Export / import backup** (JSON of pantry + catalog + receipts + list). | Round-trip restore works. |
| P2-9 | todo | Security (prod path) | Never ship plain-text passwords; document demo-only auth. | README security note; no false “secure account” claims. |
| P2-10 | todo | Tests | Unit tests for catalog merge, name normalize, receipt build, shopping generate. | CI or `npm test` covers pure helpers. |

---

## Explicitly demo / out of scope (for now)

Track as product decisions, not accidental bugs:

| ID | Status | Item | Notes |
|----|--------|------|-------|
| D-1 | open | Real multi-user cloud sync | Requires backend |
| D-2 | open | Real camera + OCR | Requires API/model |
| D-3 | open | Push notifications | Requires service + permissions |
| D-4 | open | Real WhatsApp join across devices | Requires backend invite validation |

When implementing P0-6, keep demo paths until D-2 is scheduled.

---

## Suggested implementation order

1. **P0-1** qty-0 confirm  
2. **P0-4** shopping list persist  
3. **P0-2, P0-3, P0-5** dead settings/header controls  
4. **P0-6** scan demo labeling  
5. **P1-1** merge pantry qty  
6. **P1-6, P1-5** shopping safety + add-from-DB  
7. **P1-3, P1-4** recipes honesty  
8. **P1-2, P1-7, P1-8** finances/activity/prices  
9. **P1-9** split PantryScreen  
10. **P2-*** cleanup as capacity allows  

---

## Progress log

| Date | IDs | Note |
|------|-----|------|
| 2026-07-19 | — | List created from full repo audit. |
| 2026-07-19 | P0-1…P0-6 | Implemented: qty-0 confirm, profile edit, in-app alerts pref + Alerts drawer, shopping list persist, scan demo label. |

---

## How to use

- Flip `Status` to `in_progress` / `done` when working items.  
- Add a row to **Progress log** when shipping a commit that closes IDs.  
- Prefer one PR/commit per ID or small ID group (e.g. `P0-2 + P0-3`).  
