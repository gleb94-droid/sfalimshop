# Sfalim Shop — Project Guide for Claude Code

## What this is
Sfalim Shop — a Hebrew-first print-on-demand store: custom shirts, mugs and stickers, plus an original collection called BLOOM (pet-portrait designs). Owner: Gleb, who is not a developer. Always reply in plain language and deliver working, ready-to-use code.

## Tech stack
- React + Vite 4.5 (bundler: esbuild 0.18)
- Supabase: Postgres DB, Auth, Storage, Edge Functions
- Hosting: Vercel — pushing to main auto-deploys the site
- Repo: gleb94-droid/sfalimshop
- The entire app lives in ONE file: src/App.jsx (~2800 lines). Keep it that way unless explicitly told to split it.

## Hard rules — do NOT break these
1. Strings: ONLY template literals (backticks). NEVER use + for string concatenation. The esbuild 0.18 setup breaks on it. This is the single most important rule.
2. One file. All code stays in src/App.jsx. Do not create new component files unless explicitly told to.
3. Trilingual. Every user-facing string must exist in Hebrew, English, and Russian via the LANGS object. Hebrew is primary; English is the fallback.
4. RTL + mobile. Hebrew renders right-to-left. Verify layouts do not break in RTL and on mobile (the app checks window.innerWidth < 768).
5. Inline styling only, matching the existing dark + orange look. No CSS framework.
6. Maintenance gate: MAINTENANCE_MODE = true shows a maintenance page to everyone except admin (gleb2009@gmail.com) and ?staff=1. Do not turn it off until payment is live.
7. Before every commit, run npm run build to confirm it compiles. Only then commit and push.

## Workflow
- One task at a time, small commits, then push (Vercel deploys in ~1-2 min).
- Never fabricate content (e.g., reviews). Leave a clear TODO and ask Gleb for real text/images.
- After each change, tell Gleb in plain language what changed and how to see it.

## Brand
Colors (COLORS object): bg #0f0f0f, card #1a1a1a, border #2a2a2a, accent #FF6B35, accentHover #ff8255, white #ffffff, gray #888888, success #4ade80. Fonts: headings Playfair Display, body Varela Round.

## Code map (inside src/App.jsx)
- COLORS, LANGS (he/en/ru), PRODUCTS(t) (mug, tshirt, oversized, dryfit, sticker, sticker_sq with variants/colors/printArea), MOCKUP_URLS (Supabase image per product — reuse for cards), BLOOM_SHIRT_COLORS (6 colors, used only in the BLOOM modal).
- Components: Hero, Nav, OrderPage (5-step wizard), PetsPage + PetCard + PetModal + ProductOption (the BLOOM collection), AboutPage, PoliciesPage, Footer, AuthPage, TrackPage, AdminPage, MaintenancePage, App (hash-based routing).

## Supabase
Tables: orders, order_status_history, admins, pet_designs (BLOOM: name_he/en/ru, animal_*, tagline_*, price_sticker/mug/shirt, mockup_url, design_url, mockup_bg, is_active, sort_order). Edge Functions: send-order-confirmation, send-admin-order-alert, send-status-update. The anon key in the file is public by design — never add private keys to client code.

## Payments
Tranzila — NOT yet connected (waiting on a supplier number). Do not wire real payments until Gleb provides credentials. The current "Pay" button intentionally opens a "coming soon" modal.
