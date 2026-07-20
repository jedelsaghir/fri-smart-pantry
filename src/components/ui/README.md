# UI kit (`src/components/ui`)

This folder is mostly **shadcn/ui scaffold** from the TanStack template.

## Used by Friġġ product code

- `alert-dialog` — confirmations
- `button` — via some primitives
- `drawer` — details, settings, family, alerts, add sheet
- `input` — forms, database, log purchase
- `switch` — dark mode, in-app alerts
- `sonner` — toasts (via root)

## Scaffold only (not wired into Friġġ flows)

Examples: `accordion`, `calendar`, `carousel`, `chart`, `command`, `form`, `sidebar`, `table`, `tabs`, etc.

Safe to ignore for product work unless you adopt them. Prefer not bulk-deleting without a cleanup PR — Lovable templates may reintroduce them.
