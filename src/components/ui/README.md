# UI kit (`src/components/ui`)

shadcn/Radix primitives shipped with the Lovable/TanStack template.

## Used by Friġġ product screens

| Component | Used in |
|-----------|---------|
| `drawer` | Add sheet, settings, family, item details, finances |
| `input` | Forms across app |
| `switch` | Settings |
| `alert-dialog` | Confirms |

Most other files here are **template inventory** (accordion, calendar, chart, sidebar, …) and are **not required** for the pantry product path. They remain for optional future UI work; do not import them lightly (bundle cost).

M-18: Prefer product components under `src/components/frigg/` over adding new ui-kit surface area.
