# Feature Flags in App.jsx

Scope: top-level `UPPERCASE_CONSTANT` booleans that gate UI behavior or feature visibility.
Excludes data/config constants (COLORS, LANGS, PRODUCTS, MOCKUP_URLS, etc.).
Generated: 2026-05-28.

**Total feature flags found: 4** — all currently boolean; **3 are off, 1 is on.**

| Flag | Value | Line |
|---|---|---|
| `MAINTENANCE_MODE` | `true` | 1108 |
| `MUG_STUDIO_ENABLED` | `false` | 1115 |
| `CUSTOM_STICKERS_ENABLED` | `false` | 1126 |
| `PAYMENTS_ENABLED` | `false` | 1136 |

---

## `MAINTENANCE_MODE`

- **Current value:** `true`
- **Defined at:** L1108
- **Controls:** Master site gate. When true, every visitor sees the `MaintenancePage` instead of the normal app. Exemptions: the admin email (`gleb2009@gmail.com`) and the `?staff=1` URL override; the policies page is still reachable for SEO.
- **Usage sites:**
  - **L7305** — App root routing: if `MAINTENANCE_MODE && !isAdmin && !staffOverride` and the page is not `policies`, render `MaintenancePage` instead of the normal route tree.

---

## `MUG_STUDIO_ENABLED`

- **Current value:** `false`
- **Defined at:** L1115
- **Controls:** Visibility of the mug-studio designer (lazy-loaded from `./MugStudio.jsx`). When false, the route is removed from the router, the cart helper is a no-op, and the component is not mounted.
- **Usage sites:**
  - **L6641** — `VALID_PAGES` router whitelist: `'mug-studio'` is included only when the flag is on.
  - **L6857** — `addMugStudioToCart` helper: early-returns when disabled.
  - **L7322** — Render block: the `<Suspense>` + `<MugStudio />` mount is conditional on the flag.

---

## `CUSTOM_STICKERS_ENABLED`

- **Current value:** `false`
- **Defined at:** L1126
- **Controls:** Visibility of the "design-your-own" sticker products (`sticker`, `sticker_sq`) in the user-facing customizer and home showcase. The full `PRODUCTS` catalog is kept intact so existing/historical BLOOM-sticker orders still render correctly — only the customizer entry points are hidden.
- **Usage sites:**
  - **L1590** — `getCustomProducts(t)` helper: when off, filters `sticker` and `sticker_sq` out of the returned list.
  - **L3633** — OrderPage customizer: consumes `getCustomProducts` to populate the product picker.
  - **L5864** — Hero showcase: consumes `getCustomProducts` to populate the home-page product grid.

---

## `PAYMENTS_ENABLED`

- **Current value:** `false`
- **Defined at:** L1136
- **Controls:** Real Tranzila payment flow. When false, the "Pay" button opens a "coming soon" modal. When true, the button calls the `create-payment` Edge Function and starts the real Tranzila redirect.
- **Usage sites:**
  - **L4965** — OrderPage Pay-button handler: branches on this flag — off → show the payment-soon modal; on → call the `create-payment` Edge Function and proceed with real payment.

---

## Notes

- Per `CLAUDE.md`, `MAINTENANCE_MODE` must stay `true` until Tranzila payments are wired up — i.e. `MAINTENANCE_MODE` should flip to `false` only **after** `PAYMENTS_ENABLED` flips to `true`.
- No string-valued or env-driven flags were found; all four are plain in-source booleans.
