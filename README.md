# Friġġ

> Your calm family pantry.

A premium, minimalist app to track what's in your fridge, freezer, and pantry. Know exactly what you have, what's expiring soon, and what to restock — without the stress.

Built for families who value clarity, calm, and beautiful everyday tools.

## Description

Friġġ (pronounced "frig") is a thoughtfully designed pantry management experience. It combines elegant glassmorphism, calm typography, and smart defaults so you always have a peaceful overview of your kitchen inventory.

Track quantities, set minimum stock levels, edit expiration dates, and move items between storage locations (with automatic freezer life extension). Scan receipts to quickly add items, generate intelligent shopping lists, browse recipe ideas that use what you have, and share with your household.

Everything stays private on your device. Works beautifully as a Progressive Web App — install it for a native app-like experience, even offline.

## Security & demo limits (read this)

Friġġ is a **local-first demo**. There is **no cloud backend**.

| Area | Reality |
|------|---------|
| Accounts / passwords | Stored **in plain text** in `localStorage` for simulation only — **not** production-grade auth |
| Household “sharing” | Same-device simulation (invite links / WhatsApp open real apps; join does not sync across phones via a server) |
| Receipt scan | **Demo detection** — sample line items; library photos are stored but not OCR’d |
| Push notifications | Not implemented — in-app Alerts panel only |
| Data | Export/import JSON backup from Settings; no automatic multi-device sync |

Do not use this build for real sensitive credentials or true multi-household production.

## Key Features

- **Smart Inventory Tracking** — Premium single-column cards for fridge, freezer, and pantry. Calm list shows emoji, name, status, days left, and quantity; tap for quantity/min stock controls and move actions.
- **Expiration Management** — Edit days remaining directly. Freezer moves automatically extend shelf life using realistic guidelines.
- **Premium Details Drawer** — Tap or long-press any card for rich item details: quantity, expiration, min stock, and **Quick Actions** (Move to Fridge / Freezer / Pantry).
- **Receipt Scanner** — Simulated high-fidelity scan flow with review for ambiguous items and optional (non-intrusive) expiration photo prompt.
- **Shopping List** — One-tap intelligent generation of items you're low on or below minimums. Mark purchased to add back to pantry.
- **Recipes** — Context-aware suggestions. Filter by "can make now" or "use expiring". Deduct ingredients when you cook.
- **Household Sharing** — Activity log and family simulation. Multiple members can "update" the shared pantry.
- **PWA + Offline** — Full installable app support (manifest, icons, service worker). Pantry data, settings, and auth state persist locally and work offline.
- **Calm Dark Mode** — Beautiful, consistent dark theme that preserves glassmorphism and premium details.
- **Beautiful Onboarding** — Premium signup flow with welcome, household setup, and quick profile/avatar steps.

## Screenshots

**Welcome & Onboarding Flow**  
Clean centered hero with the Friġġ wordmark and milk emoji. Segmented auth tabs. After creating an account you flow through three elegant steps: a welcoming intro, household name picker with suggestions, and a profile screen with avatar emoji choices. Smooth transitions and delightful micro-details.

**Main Pantry View**  
Glassmorphic sticky header with household name, subtle shared badge, family avatars, and stats (total items + attention count). Full-width storage tabs (Fridge / Freezer / Pantry). Single-column elevated cards (one item per row) showing emoji, name, status pill + days left, and current quantity only — min stock and steppers open in the details drawer. Add-to-home-screen install banner when appropriate.

**Item Details Drawer**  
Rich bottom sheet opened by tapping the emoji/name or long-pressing the card. Large emoji header with status pill, live editable Quantity, Expiration (big +/-), and Minimum stock. Prominent **Quick Actions** three-column grid: Fridge, Freezer (shows extension days), Pantry. Current location is visually de-emphasized. Polished Done footer.

**Settings**  
Premium card-based layout: Profile with avatar, Household management link, Notifications toggle, Dark mode switch (with calm night description), Install App action, Logout. Fully respects light/dark.

**Receipt Scan & Post-Scan**  
Full-screen elegant capture simulation. Processing state. Review step with editable name/qty/storage segmented controls. After adding items, a compact non-intrusive bottom banner offers optional expiration photos (easy to dismiss).

**Other Views**  
Recipes with filter pills and "use what I have" actions. Shopping list with check-off and quantity editing. Finances view (placeholder charts).

## How to Run Locally

```bash
# Clone the repo
git clone https://github.com/jedelsaghir/fri-smart-pantry.git
cd fri-smart-pantry

# Install dependencies (bun or npm)
bun install
# or
npm install

# Start the dev server
bun dev
# or
npm run dev
```

Open http://localhost:5173 (or the port shown). The app works fully in the browser.

For production build:

```bash
bun run build
bun run preview
```

## Tech Stack

- **Framework**: TanStack Start (React + TanStack Router + SSR)
- **Build**: Vite  + @tailwindcss/vite
- **Styling**: Tailwind CSS 4 + custom design system (glassmorphism, elevated cards, Fraunces display + Inter)
- **UI Primitives**: Radix UI components (Drawer, Switch, etc.)
- **State & Data**: React useState + localStorage persistence (offline-first)
- **PWA**: Custom manifest.json, service worker (cache-first shell + offline pantry), beforeinstallprompt integration
- **Icons & Assets**: Lucide React + custom premium generated icons
- **Other**: Sonner toasts, date-fns (in some views), fully typed TypeScript

Designed with love for calm, clarity, and craft.

---

Made as a Lovable-connected project. All data lives in your browser.

*Friġġ — know your kitchen, peacefully.*