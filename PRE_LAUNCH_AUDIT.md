# Sfalim Shop — Pre-Launch Triple Audit
_Date: 2026-05-28 · File audited: `App.jsx` (~9000 lines)_

Three parallel audits were run: (A) RTL/Hebrew correctness, (B) phantom-table / hardcoded URLs / stray logs, (C) mobile responsiveness. Below: full findings, then a triaged action list.

---

## Priority Triage

### MUST FIX before launch — visible bugs in Hebrew/mobile UX

| # | Line(s) | Problem | One-line fix |
|---|---------|---------|--------------|
| M1 | 8310 | PetCard "more info" arrow `→` does not flip for Hebrew RTL — wrong on every BLOOM card | `{lang === "he" ? "←" : "→"}` |
| M2 | 4630, 4632 | Manual nudge arrows in OrderPage point the wrong direction in RTL (← moves design right, etc.) | Swap arrows and nudge sign on `isRTL` |
| M3 | 8683 | PetModal eyebrow shows `BLOOM Collection` in English for Russian and Hebrew users | Use `lang === "he" ? "קולקציה" : lang === "ru" ? "Коллекция" : "Collection"` |
| M4 | 5962 | Nav Instagram `aria-label` is hardcoded Hebrew (`"אינסטגרם"`) for all languages — broken screen-reader UX | Branch on `lang` |
| M5 | 2457 | TrackPage admin-order column has `minWidth: 240` inside a `flex` row with no `flexWrap` → horizontal scroll on phones | Add `flexWrap: "wrap"` to parent row |
| M6 | 5109–5134 | Payment-coming-soon modal has **no close button and no Escape handler** — user can be trapped if CTA is below fold | Add Escape listener + small `×` button |

### SHOULD FIX — RTL polish and structural safety

| # | Line(s) | Problem | Fix |
|---|---------|---------|-----|
| S1 | 5955 | Cart-badge uses physical `right: -7` | `insetInlineEnd: -7` |
| S2 | 6132 | AccessibilityMenu `btnBase` uses `textAlign: 'left'` | `textAlign: 'start'` |
| S3 | 6513 | CartDrawer panel uses `[isRTL ? "left" : "right"]: 0` computed key | `insetInlineStart: 0` |
| S4 | 2035, 2037 | AuthPage password input uses physical padding shorthand + computed `right`/`left` key for eye button | `paddingInlineEnd: 80`; `insetInlineEnd: 8` |
| S5 | 2163, 2164 | ResetPasswordPage — same pattern as AuthPage | Same logical-property fix |
| S6 | 4777, 4779 | OrderPage address loading spinner and autocomplete dropdown use `left: 14` / `left: 0, right: 0` | `insetInlineStart` (spinner) and `insetInlineStart: 0; insetInlineEnd: 0` (dropdown) |
| S7 | 4825 | Shipping-method button uses `textAlign: lang === "he" ? "right" : "left"` | `textAlign: "start"` |
| S8 | 2902, 3001 | AdminPage badges/buttons use `marginLeft`/`marginRight` | `marginInlineStart` / `marginInlineEnd` |
| S9 | 8148 | PetBadges container uses computed `[isRTL ? "right" : "left"]: 10` | `insetInlineStart: 10` |
| S10 | 8503, 8531, 8849 | PetModal close/share/zoom-close buttons use computed `[isRTL ? "left" : "right"]: …` keys | `insetInlineEnd: …` |
| S11 | 9080 | Footer policy links use `textAlign: isRTL ? "right" : "left"` | `textAlign: "start"` |
| S12 | 5383–5385, 7384–7386 | `isPhone` in ParticlesBackground and PawPrintsBackground is computed once at render time → not resize-safe on rotation | Move to state + resize listener |
| S13 | 6165 | Accessibility panel has rigid `width: 260` with no `maxWidth: "100%"` safety valve | Add `maxWidth: "calc(100vw - 48px)"` |
| S14 | 4346 | Leave-warning modal has no Escape handler | Add Escape listener for parity with CartDrawer |
| S15 | 5962, 6057, 8926, 9090 | Instagram URL `https://www.instagram.com/sfalimshop/` is hardcoded in **four places** — maintenance risk | Extract to `const SOCIAL = { instagram: "…" }` |

### NICE TO HAVE — cosmetic / minor

| # | Line(s) | Note |
|---|---------|------|
| N1 | 6370 | CartToast "View cart" label uses inline ternary instead of LANGS — functionally correct, just unmanaged |
| N2 | 4606, 4646 | OrderPage `cm` spans use symmetric `marginLeft/Right: 8` — no visual bug, but should be `marginInline` for consistency |
| N3 | 3958 | `console.log("Upload error:", e)` inside catch — change to `console.error` for clearer DevTools output |
| N4 | 8683 region | PetModal name heading at `2.5rem` could crowd on long English names at <360px |
| N5 | 4106 | Nominatim address autocomplete fires per-keystroke; verify the existing `setTimeout` debounce around line 4103 is ≥1s |

---

## Audit A — RTL / Hebrew Correctness

**PASS items:**
- LANGS object provides he/en/ru for the vast majority of strings.
- CartDrawer correctly uses `borderInlineStart` (line 6517) — good.
- Most flex rows do not force `flex-direction: row-reverse` — the browser handles RTL automatically via `dir="rtl"`.
- Hero, Footer, About body use logical text alignment.

**ISSUES:** see triage M1–M4 and S1–S11 above for full list. Pattern summary:

- Physical `right`/`left` → should be `insetInlineEnd`/`insetInlineStart`: lines 5955, 6513, 4777, 4779, 8148, 8503, 8531, 8849
- `marginLeft`/`marginRight` → should be `marginInlineStart`/`marginInlineEnd`: lines 4606, 4646, 2902, 3001
- `textAlign: "left"/"right"` → should be `"start"`: lines 6132, 4825, 9080
- Physical padding shorthand encoding LTR side order: lines 2035, 2163
- Directional icons not flipping: lines 4630, 4632, 8310
- Hardcoded untranslated strings: lines 8683 ("BLOOM Collection"), 5962 (Instagram aria-label)

---

## Audit B — Phantom Tables, URLs, Logs

### B1 — `testimonials` table (does NOT exist in Supabase)

Three references in `App.jsx`, all inside the `Reviews` component:

- **Line 5712** — developer comment, no runtime effect.
- **Lines 5727–5744** — live `supabase.from("testimonials").select(...)`. When the table is absent, Supabase returns "relation does not exist". The `catch` block at 5738 calls `setReviews([])` and the component renders nothing (guarded by `reviews.length === 0`). **No visible breakage** — section is silently hidden.
- **Line 5739** — explicit comment: _"Table may not exist yet (Gleb hasn't run testimonials.sql). Silently hide."_

→ **Not a launch blocker.** When you want reviews to appear, paste `testimonials.sql` into Supabase Studio → SQL Editor and add rows in the Table Editor. Until then the section is graceful-degraded.

### B2 — Hardcoded URLs / domains

- **Supabase**: `supabase.js:8` + 6 mockup image URLs at lines 1673–1678 (already grouped in `MOCKUP_URLS`).
- **sfalimshop.com**: JSON-LD at 5757, WhatsApp share at 8350, schema.org vocabulary refs at 7551/7576/5755.
- **Instagram**: `https://www.instagram.com/sfalimshop/` appears **four times** (5962, 6057, 8926, 9090). See **S15** — extract to a single constant.
- **Third-party services**: Unsplash fallback (480, harmless), Nominatim (4106 — live API, public 1 req/s limit), GA4 (7083), Facebook Pixel (7099), Google Fonts (7153).
- **Comment-only**: lines 20, 1098, 1099 — no runtime effect.

### B3 — Stray `console.log`

- **Line 26** — inside a JSDoc comment block, dead code.
- **Line 3958** — inside a `catch` block. (Suggest changing to `console.error` for DevTools clarity — N3.)

→ **Zero stray debug logs outside catch blocks.** Clean.

---

## Audit C — Mobile Responsiveness

### C1 — `window.innerWidth` reads
Most are resize-safe (BloomCarousel 727, OrderPage 3686/3690, HeroSection 5872, Nav 5927, OrderSummary 6087, AboutPage 6206, Toast/CartDrawer 6359/6429, PetsPage 7490).
**Not resize-safe**: ParticlesBackground `isPhone` (5383–5385) and PawPrintsBackground `isPhone` (7384–7386) — computed once at render. Low visual impact (canvas only). See **S12**.

### C2 — Numeric breakpoints
Used: 768 (primary), 480 (hero 2→1 col), 1024 (Nav hamburger), 360 (OrderPage stepper label hide). All consistent and explainable.

### C3 — Modals at narrow widths
- **PetModal** (8318): safe at 360px; heading at 2.5rem could crowd long English names → **N4**.
- **CartDrawer** (6427): full-width on mobile, safe.
- **Payment-coming-soon modal** (5109): no close, no Escape → **M6**.
- **Leave Warning modal** (4346): no Escape → **S14**.
- **Added-to-cart choice** (4368): safe.
- **Accessibility Panel** (6162): `width: 260` with no `maxWidth` safety → **S13**.
- **Zoom lightbox** (8823): safe.

### C4 — Hardcoded widths
Highest risk: **`minWidth: 240` at line 2457** inside a `display: flex` row with no `flexWrap` set → can force horizontal scroll on phones. See **M5**. Other large widths (CursorGlow 5591, radial glows 7837/7838) are `position: fixed, pointer-events: none` and do not affect layout.

### C5 — Horizontal scrolling risks
No `overflowX: auto/scroll` anywhere — good. `whiteSpace: nowrap` usages are all either inside `flexWrap: wrap` parents or absolute overlays — safe.

---

## Recommended order of work

1. Apply **M1–M6** as one commit ("pre-launch: visible RTL/mobile bugs").
2. Apply **S1–S11** as one logical-properties refactor commit.
3. Apply **S12–S15** as one commit ("hardening: resize safety, escape handlers, social constant").
4. Run `npm run build`, push to main, smoke-test on a real phone (Hebrew + Russian) before announcing launch.
5. When ready for reviews, run `testimonials.sql` in Supabase Studio.

_All findings sourced from full-file reads; line numbers verified by the audit agents at the time of the run._
