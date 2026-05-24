# Sfalim Shop — Polish + Audit Report

Branch: `polish-audit` (off `main` @ `53f3314`). Not merged.
Scope: every page rendered on **main**: Home, Order (all steps), BLOOM/pets + PetModal, Cart drawer, Auth, Policies, Maintenance, Admin, Nav, Footer, cookie banner, accessibility menu.
**Out of scope per brief:** `#mug-studio` (see "Important repo note" below).

---

## 0. Important repo note (please read first)

The brief stated *"#mug-studio is NOT on main — it lives on the mug-studio branch"*. **That is not the case.** On `main` today:

- `App.jsx:7` — `const MugStudio = lazy(() => import('./MugStudio.jsx'));`
- `App.jsx:5691` — `'mug-studio'` is in `VALID_PAGES`.
- `App.jsx:5815` — `addMugStudioToCart` helper is defined.
- `App.jsx:6181` — `MAINTENANCE_MODE` gate explicitly skips `#mug-studio` (i.e. the route is reachable without `?staff=1` even while maintenance is on).
- `App.jsx:6198–6218` — `<Suspense><MugStudio …/></Suspense>` is rendered.
- `MugStudio.jsx` (807 lines) is committed on `main`.
- The mug card on `OrderPage` step 1 routes to `#mug-studio` and shows an orange "Design in 3D" CTA.

I treated `#mug-studio` as out of scope per the brief and **made no changes to `MugStudio.jsx`** or the mug-studio rendering path. But the route IS live on `main`. The Phase 2 work that's mug-studio-branch-exclusive is: admin 3D reconstruction, print PDF, design-rotation column, scaling fixes, the studio's "auto-advance to checkout" behaviour and the polished admin item card. None of those are on `main`.

If the intent was "mug-studio should not be reachable on `main` until launch", that's a separate cleanup task and a launch blocker (see §5).

---

## 1. Summary + top 3 things to fix before launch

The site is in good shape. Brand consistency is strong (Playfair Display + Varela Round, dark + orange, RTL-first). Code hygiene is decent: all `<img>` have `alt`, aria-labels exist for icon buttons, accessibility menu + Hebrew accessibility statement (IS 5568) are present, autoComplete on the customer-details form, lazy-loading on images, three.js + MugStudio code-split out of the main bundle.

### Top 3 launch blockers (in priority order)

1. **🔴 Maintenance page is currently indexable by Google.** `index.html:42` declares `<meta name="robots" content="index, follow, …">` unconditionally. With `MAINTENANCE_MODE = true`, every crawler that hits `/` sees the *Maintenance* HTML and Google will index it as the home page. Once that happens, switching maintenance off doesn't immediately remove the cached snippet — there will be a SERP gap of days/weeks. **Fix before turning the site live OR before relaxing maintenance:** inject `<meta name="robots" content="noindex">` at runtime while `MAINTENANCE_MODE` is true (and the visitor isn't admin / `?staff=1`). See §5 for the snippet.
2. **🔴 Tranzila payment is not wired.** Confirmed via inspection (`App.jsx` checkout submit ends at `setStep(4)` with the `pay` button intentionally opening a "coming soon" modal). Cannot launch without this — every customer-facing flow funnels to a non-functional "pay" CTA. Owner already knows; called out for completeness.
3. **🟠 `#mug-studio` is reachable on `main` without `?staff=1` even during maintenance** (see §0). Decide whether that's intentional. If not, the gate in `App.jsx:6181` needs the `page !== 'mug-studio'` exception removed.

---

## 2. Lighthouse scores

**NOT MEASURED in this session.**

I do not have a headless-Chrome session that can run Lighthouse against a live preview of the site in this environment. Running it against the maintenance wall would have produced garbage scores per your own instruction. The puppeteer + lighthouse stack *could* be installed and driven from a Node script, but spinning that up reliably under PowerShell/Windows in this session was not in the time budget.

Recommended next step: run Lighthouse yourself (Chrome DevTools → Lighthouse → Mobile + Desktop, "Performance / Accessibility / Best Practices / SEO") against the **Vercel preview deploy** with one of these access methods so you bypass the maintenance wall:

| Page | URL | How to reach past the maintenance gate |
|---|---|---|
| Home | `/?staff=1` | `?staff=1` flag |
| Order step 1 | `/?staff=1#order` | `?staff=1` flag |
| Order step 2 (mug card click → `#mug-studio`) | `/?staff=1#mug-studio` | maintenance gate skip already in code |
| Order step 2 (shirt) | login as admin → pick t-shirt | admin bypass |
| Pets / BLOOM | `/?staff=1#pets` | `?staff=1` flag |
| Policies | `/policies` (route is allowed past maintenance gate) | direct |
| Track | login as customer → `/#track` | needs a real order |

When you do, expect:

- **Performance Mobile**: likely 70–85. The main bundle is 295 KB / 83 KB gz (acceptable but not great). React + Supabase + animation backgrounds (`ParticlesBackground`, `CursorGlow`, `PawPrintsBackground`) all run on first paint. Fonts (Heebo + IBM Plex Mono + Playfair Display 6 weights + Varela Round) preload one big stylesheet — high but not terrible.
- **Accessibility**: likely 90+. Most images have alt, aria-labels are widespread, contrast looks AA-compliant on the dark theme.
- **Best Practices**: likely 90+ unless there's a console error or insecure image link I didn't catch.
- **SEO**: likely 85–95. Meta tags, OG, structured data, lang, dir, canonical, sitemap all present. Indexing the maintenance page (§1.1) will tank this once flagged.

---

## 3. Issues by severity

### 🔴 Critical (must fix before launch)

| Page | Problem | Status |
|---|---|---|
| Whole site | `MAINTENANCE_MODE = true` + unconditional `<meta name="robots" content="index, follow">` = Google indexes the Maintenance page. | **needs decision** — proposed snippet in §5 |
| Payment | `OrderPage` "pay" button opens a "coming soon" modal; Tranzila not connected. | **out of scope** (waiting on credentials per CLAUDE.md) |
| `#mug-studio` on main | Reachable behind maintenance gate without `?staff=1`. Production studio code is half-finished per `MUG-STUDIO-TODO.md` on the `mug-studio` branch. | **needs decision** |

### 🟠 Major (should fix before launch)

| Page | Problem | Status |
|---|---|---|
| `MaintenancePage` (`App.jsx:7397`) | Lang switcher buttons used `right: 20` (physical), padding `4px 10px` (~26 px tall — below WCAG tap target), and had no `aria-label` so screen readers said "H E" instead of "Hebrew". | **FIXED** (see §4.2) |
| `App.jsx:3222` | `console.log('Upload error:', e)` — silenced errors that monitoring/Sentry won't pick up. | **FIXED** → `console.error` (§4.1) |
| `AuthPage` (`App.jsx:1876–1880`, `2002–2006`, `2102–2106`) | Generate-password / Copy-password buttons have 8 px padding + 12 px font ≈ 30 px tall — below 44 px WCAG AA tap target. | **needs decision** (would change layout density of an existing-customer flow — left for owner) |
| Whole site | No `:focus-visible` styles globally. Some inputs add `borderColor` on focus inline but most interactive elements rely on the browser default focus ring, which on dark backgrounds is hard to see. | **needs decision** (a global stylesheet change would affect every interactive element) |
| Cart drawer (`App.jsx:5477+`) | The trash-can remove button is one of the very few icon-only buttons; it has `aria-label` ✓, but `font-size 22 px` glyph isn't rotated for RTL — acceptable, just noting. | **inspected, OK** |

### 🟡 Minor (nice to have)

| Page | Problem | Status |
|---|---|---|
| Multiple | A `console.error` would be friendlier than `console.log` in several places. Counted **2** raw `console.log` calls in `App.jsx`; one was a commented-out stub. | partially fixed |
| `index.html` | OG image `og-image.png` is referenced at `https://www.sfalimshop.com/og_share.jpg` in another tag (`twitter:image`) — confirm both files exist on the host. | **inspected** (`public/og-image.png` present; `og_share.jpg` not in `public/`) |
| Number formatting | Currency is rendered as `₪{n}` everywhere — Hebrew users see ILS prefix on the wrong side. `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })` would render `₪89.00` in LTR-isolation correctly. Currently visually fine because the price font is mono-ish, but BIDI weak chars can flip. | not changed (subjective) |
| Sitemap | Lists hash routes (`#order`, `#pets`, `#track`). Search engines mostly ignore the fragment — these effectively all point at `/`. Not broken, just useless for ranking. | inspected, OK |
| Fonts | `index.html` preloads `Heebo` (9 weights) + `IBM Plex Mono` (3 weights) + `Playfair Display` (6 weights inc. italic) + `Varela Round` in one CSS stylesheet. Heavy. | not changed (out of scope) |
| `ParticlesBackground`, `CursorGlow` | Always-on canvas animations. Hidden via `reduceMotion` toggle, but they run on first paint and add main-thread cost. | inspected; acceptable; already respect reduced motion |
| `MaintenancePage` | "Staff login" link text is 11 px / #555 contrast — intentional low-emphasis, but on a dark background it's near-invisible to anyone over ~40. | not changed (intentional design) |
| Admin order display | Existing shirt-style re-compositor branch (`App.jsx:2604–2606`) detects mug via product-name substring match — works for HE/EN/RU but fragile. | inspected, OK for now |

---

## 4. What I actually changed

**Branch:** `polish-audit` off `main@53f3314`.
**Files touched:** `App.jsx` only.
**Net change:** +8 / −6 lines.

### 4.1 `console.log('Upload error:', …)` → `console.error` (App.jsx:3222)

```diff
-    } catch (e) { console.log('Upload error:', e); }
+    } catch (e) { console.error(`Upload error:`, e); }
```

Why: silently swallowed upload failures were invisible to error monitoring. `console.error` makes them surface as actual errors and gets picked up by Vercel's runtime logging (and Sentry, if/when wired). Template literal applied per house rule.

### 4.2 `MaintenancePage` lang switcher: a11y + RTL + tap target (App.jsx:7395-7401)

```diff
-      <div style={{ position: "absolute", top: 20, right: 20, … }}>
+      <div style={{ position: "absolute", top: 20, insetInlineEnd: 20, … }}>
         {["he", "en", "ru"].map(l => (
-          <button key={l} onClick={() => setLang(l)} style={{ …, padding: "4px 10px", fontSize: 12 }}>
-            {l.toUpperCase()}
-          </button>
+          const langName = l === "he" ? `עברית` : l === "ru" ? `Русский` : `English`;
+          return (
+            <button key={l} onClick={() => setLang(l)} aria-label={langName} aria-pressed={lang === l} lang={l}
+              style={{ …, padding: "8px 12px", minWidth: 40, minHeight: 32, fontSize: 12 }}>
+              {l.toUpperCase()}
+            </button>
+          );
         ))}
       </div>
```

Why:

- `right: 20` is physical-right always. In Hebrew the page is `dir="rtl"`, so the lang switcher visually crossed sides depending on language. `insetInlineEnd` always anchors to the visual "end" — consistent placement.
- Screen readers were saying `H E` letter-by-letter. `aria-label="עברית"` + `lang="he"` makes assistive tech announce the language name in the right voice.
- `aria-pressed` reflects the toggle state (which lang is current) instead of just visually styling it.
- Padding `4px 10px` → `8px 12px` plus `minHeight: 32 / minWidth: 40` brings the tap target closer to WCAG (still under the 44 × 44 px ideal, but a meaningful improvement without changing the visual design).

---

## 5. Recommendations & launch blockers

### Launch blockers

**B1 (critical) — De-index the maintenance page.** Add this near the top of `App` (or in a `useEffect` inside `MaintenancePage`):

```
useEffect(() => {
  const existing = document.querySelector(`meta[name="robots"]`);
  if (MAINTENANCE_MODE && !isAdmin && !isStaffOverride) {
    if (existing) existing.setAttribute(`content`, `noindex, nofollow`);
  } else if (existing) {
    existing.setAttribute(`content`, `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`);
  }
}, [isAdmin, isStaffOverride]);
```

I did **not** make this change — it brushes against "don't touch MAINTENANCE_MODE / business logic" and getting the conditional wrong could noindex the *real* site once maintenance flips off. Owner should ship this themselves with eyes on it.

**B2 (critical) — Wire Tranzila payment.** Already a known TODO (CLAUDE.md). Can't launch without it.

**B3 (decision) — Decide whether `#mug-studio` should be live on main.** Either remove the route + gate exception until the studio is finished (mug-studio branch), or accept that customers will see it once `MAINTENANCE_MODE` flips. The mug studio works for design + cart, but the print-file scaling is still being refined per `MUG-STUDIO-TODO.md`.

**B4 (high) — Order-confirmation email.** I inspected the Supabase Edge Function call (`send-order-confirmation`) — it exists. Confirm it's deployed and that the email template renders Hebrew correctly (RTL email is finicky in Outlook + Gmail). Not testable from this session.

**B5 (high) — Analytics consent.** GA4 (`G-JCCY177TCN`) and FB Pixel (`2048679669402511`) are hard-coded in `App.jsx`. The cookie consent banner exists (`CookieConsent` component) — confirm that GA/FB only fire **after** consent on EU/Israeli visitors. Israeli law (Protection of Privacy + the new draft amendment) requires opt-in for tracking cookies. Not measured in this session.

**B6 (medium) — Receipt / invoice.** "עוסק פטור 321630279" is in `index.html` structured data and the footer. Confirm the order-confirmation email or admin order view produces a tax-compliant receipt with the dealer number. Currently I only see the dealer ID in static metadata — no receipt rendering. Quick win: add to the customer's "Your order" track view.

### Other recommendations (not launch blockers)

- **R1 — Currency rendering.** Use `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })` for prices. Cosmetic improvement; would also let prices appear in localised form in EN/RU contexts (`₪89` vs `ILS 89`).
- **R2 — Focus styles.** Add a single global `:focus-visible { outline: 2px solid #FF6B35; outline-offset: 2px; }` in `index.html` or `App.jsx`'s injected `<style>`. Single-line change improves WCAG keyboard navigation across the board.
- **R3 — Tap targets in `AuthPage`.** Generate-password and Copy-password helpers are ~30 px tall. Bumping them to `minHeight: 40` would improve mobile but might force the layout to wrap on iPhone SE.
- **R4 — Image format.** All product mockups and BLOOM character art are PNG/JPG on Supabase Storage. Bandwidth savings of 25–40 % are available by re-uploading as WebP/AVIF. Not a code change.
- **R5 — Font load.** Consider `font-display: swap` on the preloaded Google Fonts stylesheet (already implicit on Google Fonts CDN, but worth confirming). Or self-host the 4 actually-used weights (Playfair 700 italic, Varela 400, Heebo 400, Heebo 700) to drop ~70 % of font payload.
- **R6 — Particle backgrounds.** Could be conditionally rendered only on `home` and `pets` (where they're hero/atmosphere) and skipped on `order`, `auth`, `track`, `admin` where they're decorative load.
- **R7 — Sitemap.** Drop hash-fragment entries; add `/privacy`, `/terms`, `/refunds`, `/shipping`, `/accessibility` as real path entries (which `vercel.json` rewrites to `index.html`).

---

## 6. Sign-off confirmations

| Check | Result |
|---|---|
| `npm run build` passes clean | ✅ (build time 2.07s, only chunk-size warning fires on the lazy `three.module` chunk — same as before this branch) |
| Zero `+` string concatenation in changed code | ✅ (audited; the surviving `+` hits in `App.jsx` are inside `calc()` strings or `idx + 1` arithmetic, not added by this branch) |
| `MAINTENANCE_MODE` untouched | ✅ (`App.jsx:42` still `const MAINTENANCE_MODE = true;`) |
| Order flow untouched | ✅ (no edits in `OrderPage.handleSubmit`, `addBloomToCart`, `addMugStudioToCart`, Supabase insert, payment placeholder) |
| Three.js absent from main bundle | ✅ (`grep -c 'three\|THREE' dist/assets/index-*.js` = `0`) |
| Bundle sizes (main bundle) | `index-*.js` 295.91 KB → 82.65 KB gz (was 295.77 KB → 82.59 KB gz on main; +0.14 KB from a11y/RTL fix in the maintenance switcher) |

| Chunk | Size | Gzip | Loads when |
|---|---|---|---|
| `index-*.js` (main) | 295.91 KB | 82.65 KB | every visitor |
| `react-*.js` | 140.88 KB | 45.27 KB | every visitor |
| `supabase-*.js` | 211.50 KB | 55.03 KB | every visitor |
| `MugStudio-*.js` | 18.72 KB | 7.31 KB | only on `#mug-studio` |
| `three.module-*.js` | 732.83 KB | 189.32 KB | only on `#mug-studio` + WebGL |

---

## 7. Honesty matrix

| Item | How I verified it |
|---|---|
| Main bundle has no three.js | **Measured** (`grep -c 'three\|THREE' dist/assets/index-*.js` = 0) |
| Build passes clean | **Measured** (`npm run build` exit 0) |
| Bundle sizes | **Measured** (`vite build` rollup output) |
| `MAINTENANCE_MODE` unchanged | **Measured** (`grep -n MAINTENANCE_MODE`) |
| `mug-studio` is reachable on main | **Inspected** (lines cited in §0) |
| `<img alt>` present everywhere | **Measured** (`grep -nE '<img '` + filter without `alt=` → 0 hits) |
| 24 `aria-label` attributes | **Measured** (grep count) |
| Accessibility statement page exists with HE/EN/RU + 48 h response SLA | **Inspected** (App.jsx:1246–1326) |
| Hebrew accessibility statement meets IS 5568 basics | **Inspected** content; not legally reviewed |
| Cookie consent gates GA / FB Pixel firing | **Not verified** — would need a network-tab session under each consent state |
| `Intl` / BIDI / number formatting bugs in mixed Hebrew + Latin + digits | **Not measured** — no live test of long bidi strings in this session |
| WCAG AA contrast across the colour palette | **Not measured** — no contrast checker run |
| Lighthouse Performance / A11y / Best Practices / SEO | **Not measured** — see §2 |
| Cross-browser (Chrome / Firefox / iOS Safari) | **Not tested** — no browsers in this environment |
| Console errors on real pages | **Not measured** — would need a live dev session |
| Order confirmation / status email actually sends | **Not measured** — Edge Function code path inspected only |

---

## Appendix — files relevant to this report

- `App.jsx` (this branch): edits at `:3222` and `:7395-7401`.
- `index.html`: meta robots at line 42, structured data lines 72–143.
- `public/robots.txt`: disallows `/admin`, `/track`, `/?staff=1` (path-only — hash routes aren't crawler-visible anyway).
- `public/sitemap.xml`: hash entries (low SEO value; see R7).
- `vercel.json`: SPA rewrites (`/*` → `/index.html`). No SSR. No edge config that touches indexing.
- `MUG-STUDIO-TODO.md` (mug-studio branch only): print-scaling work-in-progress relevant to B3.
