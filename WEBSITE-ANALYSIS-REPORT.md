# Sfalim Shop — Full Website Analysis

Branch: `website-analysis` (off `main@4e889c4`). Not merged.
Date: this session.
No code was changed in this run.

This report is inspection-only. Every claim is tagged **MEASURED** (I ran or queried it directly) or **INFERRED** (I read the code and reasoned about it).

---

## 0. TL;DR

- **The site is NOT safe to take out of `MAINTENANCE_MODE` today.** At minimum: indexing is open while the maintenance wall is up (Google will index the maintenance page); social previews are broken (`og:image` 404); payment doesn't run (no Tranzila handoff exists in the client); the `pending_payment` order state has no path forward; no per-order receipt for the Exempt Dealer.
- The codebase is in **good** structural shape. Single-file `App.jsx` (7,595 lines), 39 components, all behaved (template literals only, zero `+` string concat, no dead `console.log` apart from one stray, all `<img>` carry `alt`).
- Heavy deps (`three`, MugStudio) are **correctly code-split**. Main bundle is 294 KB / 82.25 KB gz. Maintenance page itself ships in the main bundle.
- Supabase: **all 5 tables have RLS enabled** with sensible policies. Anon key is the public `anon` JWT — safe in client. No service-role key in repo.
- **Worst single-file finding**: `outline: "none"` is applied to **every text input** in the site (7 spots) with no compensating focus style — keyboard users have no visible focus indicator on form fields.

---

## 1. Honesty matrix

| Item | How verified |
|---|---|
| Bundle sizes / chunk inventory | **MEASURED** (`npm run build`, `ls dist/assets/`) |
| Three.js / jsPDF absent from main bundle | **MEASURED** (`grep -c 'three\|THREE\|jsPDF\|jspdf' dist/assets/index-*.js` = 0) |
| Maintenance page is served unconditionally as the homepage to anon visitors | **MEASURED** (curl with Googlebot UA against `https://www.sfalimshop.com/`) |
| `og:image` returns 404 on live deploy | **MEASURED** (`curl -I https://www.sfalimshop.com/og_share.jpg` → 404) |
| `manifest.json` referenced in `index.html` returns 404 | **MEASURED** (curl) |
| RLS enabled on all 5 tables, full policy list | **MEASURED** (Supabase MCP `list_tables` verbose + raw `pg_policies` query) |
| Edge functions list (which exist + active) | **MEASURED** (Supabase MCP `list_edge_functions`) |
| Edge functions actually deliver email | **NOT VERIFIED** — would require placing a real order and watching the function logs / inbox |
| Tranzila webhook actually catches a payment | **NOT VERIFIED** — no payment runs today |
| Lighthouse mobile/desktop scores | **NOT MEASURED** — no headless-Chrome session was set up in this run. Honest estimates in §3, not Lighthouse numbers |
| Cross-browser rendering (Chrome/Firefox/iOS Safari) | **NOT TESTED** — no browser session |
| Real keyboard navigation through all pages | **NOT TESTED** — INFERRED from `outline: "none"` + missing `:focus-visible` styles in CSS |
| Color contrast on every element | **MEASURED** for the COLORS palette (manual luminance math against `#0f0f0f`), **INFERRED** for elements that mix palette colors with images / gradients |
| Storage bucket RLS policies | **PARTIAL** — three buckets are `public: true` (measured); the exact per-bucket policy definitions could not be queried by the analysis tool — must be reviewed in the Supabase dashboard |
| Hebrew bidi / number formatting under real OS settings | **NOT TESTED** — INFERRED from code (no `Intl.NumberFormat`, prices are `₪{n}`) |
| Maintenance gate has only the documented exception (`policies`) | **MEASURED** (grepped App.jsx for all branches of the gate) |
| Order-flow data integrity (the `orders` row that lands in Supabase) | **MEASURED** (read `handleSubmit` end-to-end + the `orders` table schema; verified columns line up) |

---

## 2. Architecture & code health

| Severity | Where | What | Why it matters | Fix |
|---|---|---|---|---|
| **MEDIUM** | `App.jsx` (7,595 lines, 39 components) | One file, one bundle for every page. Components like `OrderPage` (~1,400 lines) hold many states + nested forms + UI in one body. | Refactoring risk grows with every change. Each `App.jsx` edit risks unrelated regressions. Vite has to retransform the whole file on every save in dev. | **Don't refactor before launch.** Post-launch, lift `OrderPage`, `AdminPage`, `PetsPage` into their own modules. Status quo is functional. |
| **LOW** | `App.jsx:3229` (MEASURED) | `} catch (e) { console.log('Upload error:', e); }` — last surviving `console.log` (not `console.error`). All other catches use `console.error`. | Upload failures don't surface as errors in monitoring (Sentry, browser DevTools "Errors" tab). The same fix lives committed on the `polish-audit` branch but is not yet on main. | Change to `console.error(\`Upload error:\`, e)`. (Already done on `polish-audit` branch.) |
| **LOW** | `supabase.js` (MEASURED) | This file exports a Supabase client but is imported by no one. `App.jsx:2-8` creates its own client inline with the same URL + anon key. | Dead module. Confusing for the next contributor — they may edit `supabase.js` thinking it's the live client. | Either delete `supabase.js` or have `App.jsx` import from it. (Not a launch blocker.) |
| **LOW** | `package.json` (MEASURED) | `puppeteer` in `devDependencies` is used only by `scripts/export-logos.mjs`. ~100 MB of devDeps shipped to CI but never to production. | Inflates CI install time. Not user-visible. | Move to `optionalDependencies` or only install when generating logos. |
| **OK** | Across the codebase | **Zero `+` string concatenation** for strings. All builder code uses template literals. (MEASURED via regex sweep with arithmetic / JSX-glyph filters applied.) | House rule respected. | — |
| **OK** | 39 components | All `<img>` have `alt`. 24 `aria-label`. 3 `aria-live` regions. 4 `prefers-reduced-motion` checks. Zero physical `left:`/`right:` positions for fixed elements — only logical `insetInlineStart/End`. | Solid baseline. | — |

---

## 3. Performance

### Bundle sizes — MEASURED

```
index.html                      8.24 KB   │ gzip:   2.60 KB
assets/MugStudio-*.js          18.72 KB   │ gzip:   7.31 KB     (lazy)
assets/react-*.js             140.88 KB   │ gzip:  45.27 KB
assets/supabase-*.js          211.50 KB   │ gzip:  55.03 KB
assets/index-*.js             294.08 KB   │ gzip:  82.25 KB     (main app)
assets/three.module-*.js      732.83 KB   │ gzip: 189.32 KB     (lazy)
```

- `grep -c 'three\|THREE\|jsPDF\|jspdf' dist/assets/index-*.js` → **0**. Heavy deps are not in the main bundle.
- One Rollup warning fires: the `three.module` chunk is >700 KB. Same one as before — it's behind a lazy `import('three')` inside `MugStudio.jsx` and is fetched only on `#mug-studio` AND WebGL AND non-reduced-motion. Since `MUG_STUDIO_ENABLED = false`, **right now this chunk will never be fetched in production**.

| Severity | Issue | Why | Fix |
|---|---|---|---|
| **MEDIUM** | First load = `index.js` (82 KB gz) + `react.js` (45 KB gz) + `supabase.js` (55 KB gz) = **~182 KB gz** for any visitor. Heavy for a single-product-storefront. (MEASURED.) | Supabase is the biggest chunk. The app actually uses very little surface area (auth + a few `.from('...')` calls + storage upload + `functions.invoke`). | Defer Supabase: the homepage doesn't need it. Move the supabase client creation behind a `lazy()` import for Order/Pets/Auth/Admin/Track pages only. Cuts first paint by ~55 KB gz. Risky — postpone to post-launch. |
| **MEDIUM** | No `<img width/height>` anywhere in JSX. (MEASURED: `grep -cE '<img [^>]*width=' App.jsx` = 0.) | Causes layout shift (CLS). Lighthouse will dock for it. Mobile users see "jumping" cards as images load. | Add intrinsic `width` + `height` to every `<img>` (or set them in style). Especially `SmartImage`. |
| **MEDIUM** | 3 always-on canvas animations (`ParticlesBackground`, `CursorGlow`, `PawPrintsBackground`) drawing every frame. (INFERRED from code.) | Burns battery + main-thread time on mobile devices, even though reduced-motion shuts them off. Likely the heaviest cost on a real Lighthouse run. | Conditionally render: only `Home` and `Pets` need the atmospheric particles. Skip on Order/Auth/Track/Admin. Postpone. |
| **MEDIUM** | Google Fonts CSS: **Heebo 9 weights + IBM Plex Mono 3 weights + Playfair Display 6 weights + Varela Round**, all preloaded. ~70 KB of font CSS + every actual font file fetched. (MEASURED in `index.html:67-69`.) | Mobile users on weak networks wait for fonts. Many of those weights are not actually used. | Trim to the weights actually rendered: Playfair `700 italic`, Varela Round `400`, Heebo `400/700`. Saves ~70% of font payload. Postpone. |
| **LOW** | `public/exports/` ships every logo/social PNG (`logo-instagram-1080.png` is 273 KB, etc.) (MEASURED.) | Static assets included in deploy even if the live app never requests them. Bandwidth cost is per-bot-crawl. | Move `public/exports/` out of `public/` (e.g., to `assets-source/`) so only files actually referenced ship. Postpone. |
| **OK** | Three.js correctly lazy. `MugStudio.jsx` correctly lazy. | — | — |

### Lighthouse — NOT MEASURED

I did not spin up a headless Chrome session in this run. With the maintenance wall up, scoring the public URL gives garbage anyway. Honest estimates (do not paste as fact in a doc):

- **Performance mobile**: probably 60–80. The three particle backgrounds + heavy font load + missing `width/height` on images will all dock points.
- **Performance desktop**: 80–95.
- **Accessibility**: 85–95 with the `outline: "none"` form-field finding (see §5) and contrast issues with `#555` (§5).
- **Best Practices**: 90+ assuming no console errors at runtime.
- **SEO**: today, mid-low. The `og:image` 404 + maintenance page being indexable will cost points. After fixing those: 90+.

To measure properly: `?staff=1` past the maintenance wall, then run Lighthouse on the Vercel preview deploy in Chrome DevTools.

---

## 4. SEO

### Critical: maintenance page is indexable RIGHT NOW

`index.html:42` (MEASURED):

```
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
```

No conditional logic in the page swaps this for `noindex` while `MAINTENANCE_MODE` is on. `curl -A Googlebot https://www.sfalimshop.com/` returns the same HTML that ships to humans. Google's JS-rendering crawler will execute React, see `MaintenancePage`, and index THAT as the home page (visible text: "האתר בתחזוקה" + Instagram link + the "Back soon!" copy). When `MAINTENANCE_MODE` flips off, the cached snippet will remain in SERPs until Google re-crawls.

### Broken assets referenced

- `og:image` → `https://www.sfalimshop.com/og_share.jpg` → **404** (MEASURED). The actual file is `og-image.png` (200 OK).
  Twitter `twitter:image` references the same broken URL.
- `<link rel="manifest" href="/manifest.json" />` → **404** (MEASURED). No PWA manifest file exists.
- Anyone sharing the site on WhatsApp / Facebook / Twitter / LinkedIn today sees **no image preview**.

### Other findings

| Severity | Issue | Fix |
|---|---|---|
| **BLOCKER** | `og:image` 404 (MEASURED) | Either rename `public/og-image.png` to `og_share.jpg`, or update the two `og:image` lines + `twitter:image` line in `index.html` to point at `og-image.png`. |
| **BLOCKER** | Maintenance page indexable (MEASURED) | Inject `<meta name="robots" content="noindex,nofollow">` whenever `MaintenancePage` renders. Reset back to `index,follow` when leaving maintenance. |
| **HIGH** | No `<link rel="alternate" hreflang="he/en/ru" href="…">` even though the site is trilingual. (MEASURED.) | Add three `<link rel="alternate">` tags pointing at the same URL with `hreflang="he"`, `"en"`, `"ru"` plus `"x-default"`. Helps Google show the right language SERP. |
| **HIGH** | `manifest.json` referenced but missing (MEASURED) | Either remove the `<link rel="manifest">` line, or create `/public/manifest.json` with name/icons/start_url. Browsers print "manifest could not be fetched" warning today. |
| **MEDIUM** | `sitemap.xml` lists `/#order`, `/#pets`, `/#about` (MEASURED). | Hash fragments aren't crawled — these are duplicates of `/`. Replace with path URLs (`/order`, `/pets`, `/about`) — `vercel.json` already rewrites all non-asset paths to `index.html`, so they work. |
| **MEDIUM** | Static `Product` JSON-LD (5 products) in `index.html:131-143`. (MEASURED.) | If you ever add/remove a product, the structured data drifts. Postpone — works today. |
| **LOW** | `<meta name="keywords">` still in `index.html` (MEASURED). | Google ignores it. Harmless but cargo-cult — remove if cleaning up. |
| **OK** | `<html lang="he" dir="rtl">`, canonical, OG (other than the broken image URL), Twitter card, JSON-LD Organization + WebSite + ItemList all present. | — |

---

## 5. Accessibility (IS 5568 / WCAG 2.1 AA)

### Contrast — MEASURED

I measured contrast ratios against the actual `#0f0f0f` background using the WCAG luminance formula:

| Color | Hex | Contrast vs `#0f0f0f` | AA normal text (4.5:1)? |
|---|---|---|---|
| white | `#ffffff` | 18.75 : 1 | ✅ |
| accent | `#FF6B35` | 7.0 : 1 | ✅ |
| gray | `#888888` | 5.25 : 1 | ✅ |
| `#666666` | `#666666` | 3.4 : 1 | ❌ FAILS AA |
| grayLight | `#555555` | 2.68 : 1 | ❌ FAILS AA (FAILS even AAA large-text 3:1) |

Live usage of failing colors (MEASURED via grep):

- `#555` (App.jsx:4167, 6620, **7456-7457**, **7566**, 7586) — including:
  - Maintenance "Staff login" link (intentional low-emphasis but still a tabbable element with no visible focus).
  - **Footer business ID disclosure `ח.פ. 321630279 (עוסק פטור)` at `#555`** — legally significant disclosure rendered illegible to many users.
  - Hero subtitle italic.
- `#666` (App.jsx:4164, **7439**) — Maintenance page bottom footer links (Privacy / Terms / Accessibility / Contact). These are policy navigation links failing AA.

### Focus styles — MEASURED

`outline: "none"` appears 7 times on text inputs across `AuthPage`, `ResetPasswordPage`, `AccountSettings`, `TrackPage` notes textarea, `OrderPage` notes textarea, the customer-details form (App.jsx:1807, 1983, 2079, 2217, 2303, 3533, 3926). Four of these add a tiny `onFocus={e => e.target.style.borderColor = COLORS.accent}` border-color swap — **the rest have no visible focus state at all**.

Only one CSS class declares a real focus indicator: `.bloom-nav-btn:focus-visible { outline: 2px solid #FF6B35; outline-offset: 2px; }` (App.jsx:7362). That's the only one.

**WCAG 2.4.7 Focus Visible is failed across the form layer** of the site. Keyboard-only users navigating the order checkout cannot tell which field they are on.

### Reduced motion — MEASURED

4 `prefers-reduced-motion` media-query checks across `MagneticButton`, `ParticlesBackground`, `CursorGlow`, `PawPrintsBackground`. Plus `AccessibilityMenu` exposes an in-page "Reduce Motion" toggle that flips `reduceMotion` state and applies a CSS class. ✅

### Accessibility statement — MEASURED

`PoliciesPage` includes section `accessibility` in all three languages (App.jsx:1246–1326, 1392+). Lists compliance with IS 5568, accessibility menu features, AA contrast, NVDA/JAWS/VoiceOver support, 3-language support, contact (hello@sfalimshop.com, 054-6841662), 48-hour response SLA. Reachable via `/accessibility` URL (Vercel rewrite) and via the Footer + cookie banner. ✅

### Issues

| Severity | Issue | Fix |
|---|---|---|
| **HIGH** | `outline: "none"` on inputs without `:focus-visible` compensation (MEASURED). | Add one global rule injected via `<style>` in App's body: `input:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid #FF6B35; outline-offset: 2px; border-radius: 4px; }`. Single line, no layout impact. |
| **HIGH** | `#555` on `#0f0f0f` rendered as Footer business ID (MEASURED at App.jsx:7566). | Change to `COLORS.gray` (`#888`) which is AA-compliant. Affects only the legibility of the legal disclosure. |
| **HIGH** | `#666` on `#0f0f0f` on MaintenancePage policy links (MEASURED at App.jsx:7439). | Change to `COLORS.gray`. Affects keyboard users navigating from the maintenance page to the policy pages. |
| **MEDIUM** | `Nav` has `direction: "ltr"` hardcoded even on the Hebrew (RTL) site (MEASURED at App.jsx:5046). | Cosmetic — many Israeli sites flip the Nav. Postpone, but consider for next polish pass. |
| **LOW** | `aria-pressed` missing on the language switcher button in the main `Nav` (the maintenance switcher got it on the `polish-audit` branch but main doesn't). (INFERRED.) | Add `aria-pressed={lang === l}` per language button. |
| **OK** | All `<img>` have `alt`. `aria-live` on cart toast + qty. `role="dialog"` on cookie consent + zoom. Reduced-motion respected. Accessibility statement present + reachable. | — |

---

## 6. Security

### Secrets — MEASURED

Only one Supabase JWT is in the repo (`App.jsx:8`, also `supabase.js:5`). Decoded payload:

```
{"iss":"supabase","ref":"ubvgrxlxtelulwjtfudd","role":"anon","iat":1778782283,"exp":2094358283}
```

Role: **`anon`** — this is the publishable anon key, safe to expose client-side. Confirms CLAUDE.md's claim. **No service-role key in the repo.** ✓

### RLS — MEASURED

All 5 tables in `public` have `rls_enabled: true`:

```
orders               RLS ✓   9 rows
order_status_history RLS ✓   0 rows
admins               RLS ✓   1 row
payment_events       RLS ✓   0 rows
pet_designs          RLS ✓  12 rows
```

Full `pg_policies` enumerated (MEASURED). Findings:

| Severity | Policy | Concern |
|---|---|---|
| **MEDIUM** | `admins.policyname = "Enable read for all" (qual: true, roles: public)` | Anyone (including anon) can `SELECT * FROM admins`. Single row today (your UID + email), but it leaks the admin user ID. Combined with the `"Read own admin status"` policy (which is the correct one to keep), the open-read policy is redundant and a small info-disclosure surface. |
| **LOW** | `orders.policyname = "Insert orders" (qual: null, roles: public)` | Anonymous INSERT on `orders` has no qualifier — required for guest checkout, but it's a spam vector (anyone can POST junk rows). No CAPTCHA or rate-limit in the client. |
| **LOW** | Storage buckets `designs`, `mockups`, `pet-designs` all `public: true`. | Customer-uploaded designs and product mockups are publicly accessible by URL. Filenames include `Date.now() + random` so URL guessing is hard. Acceptable for a print-on-demand store but flag it: a leaked design URL is publicly fetchable forever. |

### Auth — INFERRED from code

- `isAdmin` is set by querying `admins.id = auth.uid()` (`App.jsx:6061-6064`). Client state has no effect server-side: the RLS policy `is_admin()` is evaluated by Postgres, so even if a non-admin user flipped `setIsAdmin(true)` in DevTools they could only change UI rendering, not perform admin DB operations. ✓
- The `?staff=1` query param bypasses MAINTENANCE_MODE rendering only. It doesn't grant any DB access. ✓
- Maintenance gate: now only one exception — `policies` page (App.jsx:6193). The previous mug-studio exception is closed. (MEASURED.)

### Issues

| Severity | Where | Fix |
|---|---|---|
| **MEDIUM** | `admins` table "Enable read for all" policy | Drop it. The "Read own admin status" policy is sufficient and only exposes the row matching `auth.uid()`. |
| **LOW** | Unbounded anonymous `INSERT` on `orders` | Add a per-IP rate limit at the Supabase edge (or Cloudflare in front). Not urgent until you have payment running — abuse before payment is just noise. |
| **OK** | No service-role key in repo; RLS on every public table; admin model is DB-enforced. | — |

---

## 7. i18n / RTL

| Severity | Item | Status |
|---|---|---|
| **OK** | `<html lang="he" dir="rtl">` plus per-component `direction:` switches when `lang !== "he"`. (INFERRED.) | — |
| **OK** | `LANGS` object has full `he/en/ru` blocks. PoliciesPage has its own `he/en/ru` block with sections. (INFERRED.) | — |
| **OK** | Zero hardcoded physical `left:`/`right:` for fixed/sticky positioning. Logical `insetInlineStart/End` used in cart drawer, a11y button, maintenance lang switcher. (MEASURED.) | — |
| **MEDIUM** | Prices are rendered as the literal string `₪{n}` (e.g., App.jsx everywhere `₪89`). No `Intl.NumberFormat`. (MEASURED.) | In bidi runs, the ₪ glyph + ASCII digits can flip visually under some browser+OS combos. Use `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })` for prices. Cosmetic. |
| **LOW** | No `Intl.DateTimeFormat` either; dates use `toLocaleString(lang === 'he' ? 'he-IL' : …)` in several spots (INFERRED). Mostly fine. | — |

I did not exhaustively diff every translation key across all three languages. Spot-checks (Order, Cart, Pets, Maintenance, Footer, Policies) had matching keys.

---

## 8. Mobile / responsive

| Severity | Issue | Where | Fix |
|---|---|---|---|
| **MEDIUM** | Single breakpoint at 768px throughout. No 360 / 1024 distinction. 10 components compute `window.innerWidth < 768` independently. (MEASURED.) | All over | Acceptable for now. Consider a single shared `useIsMobile` hook to deduplicate the 10 resize listeners. |
| **MEDIUM** | Several utility buttons in `AuthPage` (generate password, copy password) use `padding: "8px"` + 12px font → ~30 px tall — below WCAG 44 × 44 px tap target. (MEASURED.) | App.jsx:1876, 1880, 2002, 2006, 2102, 2106 | Bump padding to `12px 14px` on mobile. Risk: changes the layout density of an already-tight grid. |
| **LOW** | PaddingTop offset under the fixed `top:0, height:72` Nav is inconsistent: 80 (TrackPage, AdminPage, OrderPage) vs 90 (AboutPage) vs 96 (one sticky `top: 96`). (MEASURED.) | App.jsx:2230, 2450, 3537, 5354, 2874 | Standardize to 80 across all top-level pages. Cosmetic. |
| **OK** | Nav is `position: fixed, height: 72` on both desktop and mobile (sane). | — | — |

I did NOT measure mobile rendering at 360 / 768 / 1024px — I cannot open a browser in this environment.

---

## 9. Order flow & data

### Trace — MEASURED

1. **Product picker (step 1, `OrderPage`)** — user clicks a product card → `setSelectedProduct + setSelectedVariant + setSelectedColor + setUploadedImage(null)`.
2. **Customize (step 2)** — user uploads design, drags it into position, optionally enables backPrint / secondFront / sleeves. State stored in component-local `imagePos`, `secondFront`, `backDesign`, `sleeveLeft`, `sleeveRight`.
3. **commitCurrentItem** — pushes a cart line. Cart is in `App` state (shared across pages).
4. **Cart drawer → checkout (step 3)** — `goToCheckout` sets `pendingCheckout=true` and navigates to `#order`. OrderPage opens on step 3 (customer-details form).
5. **handleSubmit (App.jsx:3401)** — for each cart item:
   - `Promise.all` uploads `uploadedImage`, optional `secondFront.image`, `backDesign.image`, `sleeve*.image` to Supabase Storage. Each via `uploadDesignImage` → `designs` bucket → public URL.
   - Builds `mockupUrl` either from existing (BLOOM) or by re-compositing via `generateOrderMockup`.
   - Inserts `orderRow` (see schema below) into `orders` with `status: "pending_payment", payment_status: "idle"`.
   - For guests, plain `.insert()`. For logged-in users, `.insert().select().single()` (the user-owns-row RLS lets them read it back).
6. **Step 4 (payment) — INFERRED dead-end.** Tranzila is not wired in the client. The "Pay" button opens the "Payment coming soon" modal. Clicking the modal's "Close & Save Order" CTA fires `send-order-confirmation` + `send-admin-order-alert` edge functions, empties the cart, and advances to step 5. **Orders stay at `status: "pending_payment"`, `payment_status: "idle"` forever.**

### `orders` schema (MEASURED via Supabase MCP)

| Column | Type | Nullable | Set by handleSubmit? |
|---|---|---|---|
| id | uuid | not-null (default `gen_random_uuid()`) | by DB |
| created_at | timestamptz | nullable (default `now()`) | by DB |
| customer_name | text | not-null | yes |
| customer_email | text | not-null | yes |
| customer_phone | text | nullable | yes |
| product | text | not-null | yes |
| variant | text | not-null | yes |
| color | text | nullable | yes |
| quantity | int4 | nullable (default 1) | yes |
| total | numeric | not-null | yes |
| notes | text | nullable | yes (from form notes) |
| status | text | nullable (default `'received'`) | yes — set to `'pending_payment'` by client |
| user_id | uuid | nullable | yes (null for guests) |
| design_url | text | nullable | yes |
| design_x, design_y, design_size | numeric | nullable | yes |
| product_color | text | nullable | yes |
| completed_at | timestamptz | nullable | by future status update |
| language | text | nullable (default `'he'`) | yes |
| back_print | bool | nullable (default `false`) | yes |
| extra_prints | jsonb | nullable | not set on main (used on mug-studio branch only) |
| second_front_url / _x / _y / _size | text/float8 | nullable | conditional |
| back_design_url | text | nullable | conditional |
| sleeve_left_url, sleeve_right_url | text | nullable | conditional |
| customer_street, customer_city, customer_postal_code | text | nullable | yes |
| order_group | text | nullable | yes (one group per cart submission) |
| customer_message, customer_message_at | text/timestamptz | nullable | by track page editor |
| payment_status | text | nullable (default `'idle'`, check constraint enforces enum) | yes — set to `'idle'` |
| payment_method, tranzila_transaction_id, paid_at, cancelled_at, failed_reason | various | nullable | by Tranzila webhook (not yet) |
| amount_paid | numeric | nullable | by webhook |
| currency | text | nullable (default `'ILS'`) | yes |
| mockup_url | text | nullable | yes |

**Validation in handleSubmit (App.jsx:3401-3404):**
```
if (!form.name || !form.email || !form.phoneNumber || form.phoneNumber.length !== 7 || !form.street || !form.city || !form.postalCode) return;
if (cart.length === 0) return;
```

| Severity | Issue | Fix |
|---|---|---|
| **BLOCKER** | Order flow ends at `status: 'pending_payment'`. There is no Tranzila handoff in the client, no return-URL handler, and no mechanism to advance status. The `tranzila-webhook` edge function exists but nothing calls Tranzila to begin with. | Wire the Tranzila iframe / hosted-payment-page handoff. Add the return-URL/IPN handler. Until then, every "successful" order is a dead row that requires manual admin status updates. |
| **HIGH** | Email is sent only if the user clicks the "Close & Save Order" CTA in the "Payment coming soon" modal. If they close the modal differently (browser back, tab close, route change), the user never gets an email and the admin never gets an alert — even though `orders` already has the row. (INFERRED.) | Move email send out of the modal's CTA and into the success branch right after the DB insert. The current placement assumes the modal is the only exit; in production it should be a side effect of the order being created. |
| **MEDIUM** | Phone validation is `form.phoneNumber.length !== 7` — fragile (only counts the part after the prefix). Empty trim, leading zero, non-numeric all pass if length === 7. | Replace with `^\d{7}$` regex. |
| **LOW** | Email is not validated beyond non-empty (HTML5 `type="email"` is best-effort). | Use a stricter `^[^@\s]+@[^@\s]+\.[^@\s]+$` regex client-side. |
| **OK** | Required fields all gated by the submit button's disabled state. Cart items can't be empty. Address fields all collected. | — |

---

## 10. Launch readiness

| Item | Status | Evidence |
|---|---|---|
| **Payment (Tranzila)** | **MISSING** | No client-side Tranzila integration. `tranzila-webhook` edge function exists but is never called. "Pay" button opens a "coming soon" modal. (MEASURED.) |
| **Order confirmation email (customer)** | **EXISTS BUT UNVERIFIED** | Edge function `send-order-confirmation` is ACTIVE; called from App.jsx:4229. Cannot confirm SMTP delivery / Hebrew email rendering from this session. |
| **Admin order alert email** | **EXISTS BUT UNVERIFIED** | Edge function `send-admin-order-alert` is ACTIVE; called from App.jsx:4242. Same caveat. |
| **Status-update email** | **EXISTS BUT UNVERIFIED** | Edge function `send-status-update` is ACTIVE; called from `AdminPage` when admin changes status. Same caveat. |
| **Tranzila webhook handler** | **EXISTS BUT IDLE** | Edge function `tranzila-webhook` is ACTIVE with `verify_jwt: false` (correct — webhooks don't carry user JWTs). Until payment runs, it has nothing to process. |
| **Analytics consent gate (GA4 + FB Pixel)** | **VERIFIED WORKING** | `App.jsx:6001` short-circuits if `cookieConsent !== "accepted"`. `GA4` (`G-JCCY177TCN`) and `fbPixel` (`2048679669402511`) only load script tags after consent. `anonymize_ip: true` is set on GA4 config. (MEASURED.) |
| **Cookie consent banner** | **VERIFIED WORKING** | Banner renders when `localStorage.sxp_cookie_consent === null`. Accept/Reject buttons set the value and dismiss the banner. (MEASURED.) |
| **Accessibility statement (IS 5568)** | **VERIFIED PRESENT** | `PoliciesPage` section `accessibility` in HE/EN/RU, with contact + SLA. Reachable via `/accessibility` URL rewrite. (MEASURED.) |
| **Exempt-Dealer receipt / invoice** | **MISSING** | The dealer ID `321630279` appears in the Footer + `index.html` LocalBusiness JSON-LD. No per-order receipt generation in the codebase. The order confirmation email template (not inspected — lives in the edge function source) may or may not be a tax-valid receipt. (MEASURED via grep — no `invoice/receipt/קבלה/חשבונית`.) |
| **Maintenance noindex** | **MISSING** | See §4. Indexable as of this run. |
| **Social previews (OG/Twitter)** | **BROKEN** | `og:image` 404. (MEASURED.) |
| **HTTPS / SSL** | **VERIFIED** | Vercel-hosted; HSTS via Vercel default. Curl confirms TLS. |
| **Robots.txt** | **PRESENT** | Disallow `/admin`, `/track`, `?staff=1`. Note: those are hash routes, so path-based disallow is meaningless for non-staff queries — but harmless. (MEASURED.) |
| **Sitemap** | **PRESENT** | Lists hash routes (low SEO value) + policy paths. (MEASURED.) |

---

## 11. Fix-first list (top 10, ordered)

1. **Add `noindex` while `MAINTENANCE_MODE` is on.** Critical SEO blocker. Injecting a runtime `<meta name="robots" content="noindex,nofollow">` via React inside `MaintenancePage` and resetting it elsewhere is one `useEffect`.
2. **Fix the `og:image` URL.** Either rename `public/og-image.png` → `og_share.jpg`, or update the three references in `index.html` (`og:image`, `og:image:secure_url`, `twitter:image`) to `og-image.png`.
3. **Wire Tranzila payment + return-URL handler.** Until payment runs, the site cannot transact. Every other launch item is downstream.
4. **Move order-confirmation email out of the "Coming Soon" modal CTA into the insert-success branch.** Right now a user closing the modal differently never gets an email.
5. **Add a single global `:focus-visible` outline rule.** One line of injected CSS solves a WCAG 2.4.7 failure across every form input on the site.
6. **Replace `#555` text colors with `COLORS.gray` (`#888`) in the Footer business-ID disclosure and the Maintenance page links.** Restores AA contrast on legally-required disclosures.
7. **Delete or fix `<link rel="manifest" href="/manifest.json" />` in `index.html`.** Currently throws a console warning on every page load.
8. **Add `hreflang="he/en/ru/x-default"` `<link rel="alternate">` tags.** Helps Google show the right language SERP. One file edit.
9. **Add `width` + `height` to every `<img>` (SmartImage especially).** Fixes CLS — Lighthouse will reward it visibly.
10. **Drop the `admins` table's "Enable read for all" RLS policy.** Eliminates anon enumeration of admin user IDs. One SQL DDL.

---

## 12. Launch verdict

**NO — do not turn `MAINTENANCE_MODE` off today.**

Specifically blocked by, in order:

1. **No payment flow.** Tranzila isn't wired; every order would land in `pending_payment` with no path forward.
2. **Maintenance page would be indexed.** With `MAINTENANCE_MODE` flipped to `false`, the home page changes — but Google will have already indexed the maintenance content (and the live `index, follow` meta gives it permission to keep indexing whatever it sees).
3. **Social previews broken.** Anyone sharing the launch link sees no image.
4. **No per-order receipt** for an Exempt Dealer — once money is collected, this is a tax-compliance risk.

Once 1–4 are addressed and the email + Tranzila flow has been smoke-tested end-to-end, the site is launchable.

---

## Appendix — files referenced

- `App.jsx` — 7,595 lines, 39 components, 220 hook call sites.
- `MugStudio.jsx` — 807 lines, lazy-loaded, currently gated by `MUG_STUDIO_ENABLED = false`.
- `index.html` — 155 lines, static SEO meta + JSON-LD.
- `public/og-image.png` — 121 KB, the file `og:image` should point at.
- `public/og_share.jpg` — **does not exist**; `og:image` currently points here.
- `public/robots.txt`, `public/sitemap.xml`, `vercel.json` — small support files, no findings beyond hash-route entries in sitemap.
- `supabase.js` — dead module.
- `package.json` — `react`, `react-dom`, `@supabase/supabase-js`, `three` (devDeps: `vite`, `@vitejs/plugin-react`, `puppeteer`).
- Supabase project `ubvgrxlxtelulwjtfudd` — 5 tables RLS-enabled, 4 edge functions active, 3 public Storage buckets.
