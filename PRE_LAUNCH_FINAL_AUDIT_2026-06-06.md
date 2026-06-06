I have all the audit findings consolidated in the brief. No further investigation needed — my task is to merge, deduplicate, and prioritize into the final report.

# Sfalim Shop — Final Pre-Launch Audit Report

**Prepared for:** Gleb (owner) · **Date:** 2026-06-06 · **Scope:** Lead-auditor synthesis merging the confirmed payments/SEO pass, live production facts, the new 8-dimension code audit, and 3 visual-research lenses. Already-shipped 2026-06-05 fixes were verified present and are NOT re-reported.

---

## 1. Executive Summary & Launch-Readiness Verdict

**VERDICT: GO-WITH-FIXES.**

The shop is structurally sound and far along: server-side price recompute, the payment-status mapping (`succeeded`/`failed`), webhook query-back, correct `verify_jwt` config on all 10 edge functions, current JSON-LD prices, strong security headers, and an active Vercel WAF rate-limit rule are all in place and verified. The trilingual dictionaries, RLS guest-insert model, cookie-consent opt-in gate, and legal disclosures are in good shape.

**However, one confirmed CRITICAL hole blocks launch:** an attacker can force a payment to an arbitrary low amount (₪1) by submitting an order with a deliberately unresolvable cart row, because `create-payment` fails *open* to the browser-supplied total. This must be fixed before flipping the launch gates. A small set of HIGH items (committed webhook secrets, the keyboard-inaccessible upload dropzone, the misleading "14-day returns" checkout badge, two DB hardening grants) should also be cleared. Everything else is should-fix-soon or polish.

Do not flip the **3 launch gates** (App.jsx maintenance gate, `api/og.js` MAINTENANCE flag, remove `noindex`) until the BLOCKERS below are resolved.

---

## 2. 🔴 BLOCKERS — fix before flipping the launch gates

### [CRITICAL] B1 — Payment can be forced to ₪1 (fail-open pricing)
- **File/symbol:** `sfalimshop/supabase/functions/create-payment/index.ts` — `authoritativeAmount` fallback: `const amount = (authoritativeAmount != null && authoritativeAmount > 0) ? authoritativeAmount : clientTotal;`
- **Issue:** `create-payment` re-prices each cart row from CATALOG/`pet_designs`/`sticker_packs`, but if **any** row fails to resolve it sets `allResolved=false`, leaves `authoritativeAmount=null`, and **fails open to `clientTotal` = `SUM(orders.total)`**. `orders.total` is browser-written on INSERT; the `protect_order_payment_fields` trigger only freezes `total` on UPDATE (never INSERT); no CHECK bounds it; guests insert as `anon`. An attacker POSTs an order with `total:1` plus a bogus/unresolvable `extra_prints` row → server charges ₪1. The webhook's amount checks compare against the same manipulated `SUM(total)` and pass, marking the order `succeeded`; setting `requires_design_approval:false` on the same insert also bypasses the approval gate.
- **Fix (primary):** When `authoritativeAmount` is null, **REJECT** with `400 'unresolved_pricing'` — remove the client-total fallback entirely. Every legit item carries `src`+`pid`/`vid`/`slug`, so an unresolvable row is itself the red flag.
- **Fix (defense-in-depth):** In `protect_order_payment_fields`, on INSERT for non-privileged users set `new.total := 0`; have `create-payment` persist the authoritative total before charging; optionally `CHECK (total >= 0)`.
- **Confidence:** high

### [HIGH] B2 — Hardcoded webhook secrets committed in repo (rotate + fail-closed)
- **File/symbol:** `waitlist-welcome/index.ts` `WEBHOOK_SECRET_FALLBACK` (~L56); `waitlist-launch-announce/index.ts` (~L69); `notify-design-decision/index.ts` (~L42)
- **Issue:** Three working shared secrets are hardcoded in tracked source. Each authorizes via `Deno.env.get(...) || WEBHOOK_SECRET_FALLBACK`, so if the corresponding Supabase secret isn't set, the live auth value is the public-repo string. Anyone with repo/history access + the function URL can trigger sends (Resend abuse) and, if `LAUNCH_ANNOUNCE_ENABLED`/`DESIGN_NOTIFY_ENABLED` flip on, a mass send. (Known **MJ-1**, confirmed in current code.) The `notify-design-decision` fallback additionally uses a corrupted literal containing a non-ASCII `د` char + `.replace()`/`||` obfuscation that buys nothing and can silently 401 every legitimate call.
- **Fix:** Set all three as real Supabase Edge Function secrets; change in-code fallbacks to empty string and fail closed (`const SECRET = Deno.env.get('...') ?? ''; if (!SECRET || got !== SECRET) return 401`). Replace the corrupted literal with a clean require-env. After deploy, rotate all three to fresh random strings (the committed values are burned).
- **Confidence:** high

### [HIGH] B3 — Custom-design upload dropzone is not keyboard-operable (WCAG 2.1.1 A, legal)
- **File/symbol:** `App.jsx` — `OrderPage` step-2 upload `<div onClick={() => fileRef.current.click()}>` (~L6717); same pattern on the preview area (~L6572)
- **Issue:** The only trigger for the hidden `<input type="file">` is a plain `<div>` with `onClick` — no `role`, `tabIndex`, or `onKeyDown`. Keyboard-only/switch users **cannot upload a design**, blocking a core conversion path. Level-A failure on a purchase flow (legally relevant under IS 5568). Admin upload controls correctly use real `<button>`s.
- **Fix:** Add `role="button"`, `tabIndex={0}`, trilingual `aria-label` ("העלה עיצוב / Upload design / Загрузить дизайн"), and `onKeyDown` handling Enter/Space → `fileRef.current.click()`. Or wrap the visuals in a `<label htmlFor>` tied to a visually-hidden file input (keyboard + SR for free). Apply to both ~L6717 and ~L6572.
- **Confidence:** high

### [HIGH] B4 — Checkout "14-day returns *" badge contradicts the refund policy (consumer-law risk)
- **File/symbol:** `App.jsx` — `LANGS.{he,en,ru}.payment.trustReturn` ("החזרים תוך 14 יום *" / "14-day returns *" / "Возврат в течение 14 дней *"), rendered in the OrderPage trust row (~L7206)
- **Issue:** At the point of sale the shop advertises unconditional "14-day returns," directly contradicting the refund policy: printed/personalized (POD) items — essentially the entire catalog — are made-to-order and **non-cancellable** after design approval (refund §1/§2, all 3 langs). The trailing `*` promises a footnote that does not exist on the page. A point-of-sale claim materially broader than policy undercuts the non-cancellation clause.
- **Fix:** Either qualify the badge to match policy in all 3 langs (e.g. en "14-day returns on ready-made items") and remove the orphan `*`, or add the explained footnote linking to the refund policy. Owner/lawyer sets exact wording.
- **Confidence:** high

### [HIGH] B5 — Two SECURITY DEFINER functions are RPC-executable by anon/authenticated (DB hardening)
- **File/symbol:** `public.notify_design_decision_webhook()`, `public.waitlist_welcome_notify()` (verified via Supabase advisors)
- **Issue:** Both are `SECURITY DEFINER` yet lack a revoked EXECUTE grant, so they are callable directly via PostgREST RPC by `anon`/`authenticated`, bypassing their intended trigger-only context.
- **Fix:** `REVOKE EXECUTE ON FUNCTION public.notify_design_decision_webhook() FROM anon, authenticated;` and the same for `public.waitlist_welcome_notify();`. Triggers still fire as table owner.
- **Confidence:** high

**Launch-gate checklist items (verify, not code):**
- **Sitemap single source (S-SEO1):** `sfalimshop/public/robots.txt` lists two `Sitemap:` lines; static `public/sitemap.xml` is missing `/faq` and will go stale vs `generate-sitemap`. Point robots.txt at ONE source (prefer dynamic `generate-sitemap`, or Vercel-rewrite `/sitemap.xml` to it) **before submitting the sitemap at launch.**
- **WAF confirmed live:** A Vercel Firewall "Basic rate limit" (path `/`, 300 req/60s per-IP → 429) was added last session — confirm it is still active on `/api/*` and the order/waitlist submit flow before launch.

---

## 3. 🟠 SHOULD-FIX-SOON

### [MEDIUM] S1 — Webhook query-back currency/terminal checks pass on empty values
- **File/symbol:** `tranzila-webhook/index.ts` — `currencyOk = txCurrency === "" || ...`; `terminalOk = txTerminal === "" || ...`
- **Issue:** Empty/missing currency or terminal silently passes the Layer-2 verification, weakening the defense that pairs with B1.
- **Fix:** REQUIRE a present matching ILS currency AND configured terminal; treat empty/missing as failure (hold for manual review).
- **Confidence:** high

### [MEDIUM] S2 — Webhook sets `status="paid"`, which is not a valid stage → paid orders show "Order Received"
- **File/symbol:** `tranzila-webhook/index.ts` (`newOrderStatus = isSuccess ? "paid" : "received"`, ~L343) vs `App.jsx` `ORDER_STAGES`/`getStageIndex` (~L1792, L3401)
- **Issue:** `ORDER_STAGES` has no `"paid"` key; `getStageIndex("paid")` → `-1` → falls back to `ORDER_STAGES[0]`. A paid order looks identical to an unpaid one on the customer Track page, with no paid cue (`PaymentBadge` is admin-only) until an admin advances it manually.
- **Fix:** Set `status="received"` on success and rely on `payment_status='succeeded'` for the paid signal (and/or surface `payment_status` on the track card). Aligning `status` to a real `ORDER_STAGES` key is the minimal fix.
- **Confidence:** high

### [MEDIUM] S3 — Persisted cart can silently drop artwork (nested extra-print data URLs not stripped/uploaded)
- **File/symbol:** `App.jsx` — cart-persist `lightCart` map (~L9350) + `commitCurrentItem` upload (~L5648)
- **Issue:** The "light" copy nulls only top-level `uploadedImage`/`mockupUrl` data URLs, NOT nested `secondFront.image`/`backDesign.image`/`sleeveLeft.image`/`sleeveRight.image`. Those extra-print images are never uploaded up-front (unlike the main design), so they stay as multi-MB data URLs in the persisted mirror. A cart with back + 2 sleeves + 2nd front can exceed the ~5MB localStorage quota; the `catch` swallows `QuotaExceeded` and **drops the entire cart mirror** → on reload all artwork is lost, and `handleSubmit` reads the now-missing images.
- **Fix:** In `lightCart`, also null nested `*.image` that `startsWith('data:')`; ideally upload extra-print images to the `designs` bucket at add-to-cart time (store durable URLs), mirroring the main design.
- **Confidence:** high

### [MEDIUM] S4 — Eight order/customize strings leak English to Russian users
- **File/symbol:** `App.jsx` — Step-1 customize panel, two-way `lang==="he" ? … : …` ternaries with no `ru` branch (L6603, 6605, 6611, 6614, 6852–6855)
- **Issue:** Drag/pinch hint, "Tap to upload design", "Main Design", "2nd Design", and add-on rows "Back" / "2nd Front" / "Left Sleeve" / "Right Sleeve" show English to RU users — an obvious gap on one screen in an otherwise trilingual app.
- **Fix:** Add the Russian branch (or move into `LANGS`): Главный дизайн, 2-й дизайн, Спина, 2-й спереди, Левый рукав, Правый рукав + translated hints.
- **Confidence:** high

### [MEDIUM] S5 — Hebrew "Continue" button uses wrong-direction arrow and bypasses the existing translation key
- **File/symbol:** `App.jsx` L6863 — `{lang==="he" ? "המשך →" : lang==="ru" ? "Продолжить →" : "Continue →"}`
- **Issue:** In Hebrew RTL, forward should point **left** (`←`); every other forward button uses `המשך ←`. This hardcodes `→` (visually backward) and re-implements a string that already exists as `t.customize.continue`. (This is also the mobile step-2 CTA noted in the mobile lens — same fix.)
- **Fix:** Replace with `{t.customize.continue}` (resolves to `המשך ←` / `Продолжить →` / `Continue →`).
- **Confidence:** high

### [MEDIUM] S6 — Two order-related email functions are absent from the repo (drift / un-versioned)
- **File/symbol:** missing `supabase/functions/send-status-update/` and `supabase/functions/notify-design-submission/`
- **Issue:** Both are referenced as ACTIVE/deployed in CLAUDE.md but are not in the tree, so they're un-reviewable and a redeploy-from-repo would not recreate them. Their recipient routing, error handling, env guards, and trilingual correctness are **unverified**.
- **Fix:** `supabase functions download send-status-update notify-design-submission`, commit, then audit before launch.
- **Confidence:** high

### [MEDIUM] S7 — Mobile nav dropdown has no max-height/scroll (bottom items unreachable on short viewports)
- **File/symbol:** `App.jsx` — `Nav` `{mobileMenu && (...)}` container (~L8406)
- **Issue:** `position:fixed; top:72` with no `maxHeight`/`overflowY`. A logged-in user gets 9–10 rows (~52px each) + language row; in landscape/short phones the bottom items (language switcher, Instagram) overflow off-screen with no scroll.
- **Fix:** Add `maxHeight:"calc(100vh - 72px)", overflowY:"auto", WebkitOverflowScrolling:"touch"`.
- **Confidence:** high

### [MEDIUM] S8 — Gallery filter bar is sticky but grows tall on mobile, eating the viewport
- **File/symbol:** `App.jsx` — `PetsPage` browse-filters bar (~L10921)
- **Issue:** Sticky `top:72; flexDirection:column` with `flexWrap` pills + search + reset; in Russian the pills wrap to 2 rows, so the bar can pin ~180–220px (a third of a 360×640 screen) while scrolling 70 cards.
- **Fix:** On mobile either drop `sticky` on the bar (keep only search sticky), or shrink pills (`padding:"8px 14px"`, fontSize 13) in a single horizontally-scrollable `overflowX:auto; flexWrap:nowrap` strip.
- **Confidence:** high

### [MEDIUM] S9 — CSP whitelists Google Tag Manager in `script-src` (arbitrary-script injection vector)
- **File/symbol:** `vercel.json` non-quiz CSP (~L39) — `script-src 'self' https://www.googletagmanager.com https://connect.facebook.net`
- **Issue:** Otherwise-strong CSP (no `unsafe-inline`/`unsafe-eval`), but whitelisting GTM lets anyone with container access run arbitrary JS. Deliberate analytics trade-off, not a code bug — the single biggest CSP weakening.
- **Fix:** Accept + document the risk; restrict GTM container write access to the owner; or prefer GA4 via `gtag.js` without the full container if tag-manager flexibility isn't needed.
- **Confidence:** medium

---

## 4. 🟡 NICE-TO-HAVE

**Conversion-data-model & robustness**
- **[LOW] No quantity ceiling** — `updateCartQty` (~L9616) floors at 1 but has no cap; add `if (newQty > 99) return;` + `disabled={qty>=99}` on `+` buttons (CartDrawer ~L9145, OrderSummary ~L5299). *(high)*
- **[LOW] BLOOM/sticker-pack items omit `unitPrice`** — set `unitPrice` at creation in the BLOOM builder (~L5709) and `addStickerPackToCart` (~L9550) to match custom/mug paths and avoid future qty-math drift. *(medium)*
- **[LOW] No `unit_price` persisted on order rows** — row-0 `total` folds in shipping; admin/receipts can't reconstruct per-unit price for multi-qty lines. Persist `unit_price` and a dedicated shipping field, or document the row-0 convention. *(medium)*
- **[LOW] Tranzila description always generic** — Pay button maps `it.title`/`it.characterName` (non-existent fields) so headline is always "Sfalim order"; map `it.productName` instead (~L7111). *(high)*
- **[LOW] `updateStatus` ignores DB errors** — capture `{error}` from the orders update + history insert (~L3990); surface failures, skip history/email on error. *(medium)*
- **[LOW] BLOOM run-once effect reads stale `pendingBloomItem`** from `[]`-deps closure (~L5695) — latent; add to deps (ref guard already prevents double-add). *(medium)*

**Email pipeline**
- **[LOW] Resend non-2xx swallowed** — `tranzila-webhook` doesn't inspect `{error}` from `functions.invoke("send-order-confirmation"|"send-admin-order-alert")` (~L389), so a Resend failure leaves no `email_send_failed` audit row. Capture and audit it. *(high)*
- **[LOW] Confirmation fallback drops the `.select` error** (~L254) and renders "N items" + ₪0 shipping on a transient DB read failure; check the error and pass `shippingFee`/`deliveryMethod` into the fallback. *(medium)*
- **[LOW] `design_review_note` injected unescaped** into `notify-design-decision` (~L147) — wrap in `escapeHtml`. *(high)*

**Accessibility (beyond B3)**
- **[MEDIUM] A11y-widget toggles lack `aria-pressed`** — High Contrast / Reduce Motion / Highlight Links (~L8630–8640) signal state only via `✓`/`○` glyph; add `aria-pressed` (or `role="switch"`+`aria-checked`); optionally `aria-live` on the `{fontSize}%` readout. Ironic for the a11y control itself. *(high)*
- **[LOW] Nudge buttons below 44px tap target** (~L6633) — bump to `minWidth/minHeight:44`, add `touchAction:"manipulation"`. *(medium)*
- **[LOW] BLOOM hero zoom on a `<div>`** (~L11951) — not a WCAG failure (labelled "Enlarge" button exists at ~L11982); optional `role="button"`+keyboard for parity. *(high)*

**i18n / content**
- **[LOW] Track Orders date uses browser locale** (~L3414) — pass explicit `he-IL`/`ru-RU`/`en-US` locale. *(high)*
- **[LOW] PetModal share text hardcoded Hebrew** (~L11438) — branch `shareText`/`shareTitle` + name source on `lang`. *(high)*
- **[LOW] Hebrew CTA arrows point `→`** in a few dictionary strings (`blogRelatedProduct`/`quiz.hero_cta`/`bloom.seeAll`, ~L1859–1898) — switch to `←` for RTL consistency. *(medium)*
- **[LOW] FAQ vs refund-policy cancellation boundary** for standard BLOOM items is stated inconsistently (FAQ `payment` group L13099 vs refund §1/§2) — align after owner/lawyer decides. *(medium)*
- **[LOW] RU refund §1 heading** drops the "general" qualifier (L2186) → `"1. Общее право отмены"`. *(high)*

**Mobile / security misc**
- **[LOW] Cart drawer `width:100%` overflow at 130% a11y zoom** (~L8085) — cap a11y zoom max at 120% (documented fallback) or clamp drawer to `100vw`. *(medium)*
- **[LOW] Cookie banner overlaps bottom-left a11y FAB on first load** (banner z9999 ~L7457 vs FAB z9998 ~L8588) — lift the FAB above the banner while it's visible. *(medium)*
- **[LOW] `create-payment` CORS `*`** — optionally restrict `Access-Control-Allow-Origin` to `https://www.sfalimshop.com` (leave webhook at `*`); rate-limit is the more effective control. *(low)*

**SEO (crawler-only, safe anytime)**
- **[LOW] N-SEO2** — `api/og.js` `buildBreedHtml`/`buildBlogHtml` omit `og:image:width/height/type` + `twitter:image:alt` that `index.html` sets (breed mockups 1414×2000, `image/webp`). Add them.
- **[LOW] N-SEO3** — `api/og.js` MAINTENANCE is a separate hand-flipped gate and warns-only on missing `SUPABASE_ANON_KEY` (hardcoded fallback). Post-launch set the Vercel env and make the key a hard requirement; keep the single 3-gate checklist.

---

## 5. 🎨 Frontend / Visual Roadmap

### ⚡ Quick Wins (high impact / low effort) — do these first
1. **Body-font swap to Heebo [HIGH/CSS-only].** Body/UI font is **Varela Round** everywhere (~316 inline `fontFamily` usages), not the approved **Heebo**. Heebo is already loaded; Footer L12947 already uses it for the Hebrew tagline. Add global `body { font-family:'Heebo',sans-serif; -webkit-font-smoothing:antialiased; }` (currently NO default font-family on `body`/`#root`), then swap `'Varela Round'`→`'Heebo'` for body/UI (keep Playfair for display). **This is the single highest-leverage change** separating "friendly/rounded" from the approved editorial-boutique target.
2. **Fix `accentBtnDim` bug [LOW, real bug].** `Hero` L8191 `onMouseOut` sets `background = COLORS.accentBtnDim`, which is **undefined** (`COLORS` defines `accentDim`, not `accentBtnDim`) — the quiz CTA loses its background after first hover. Change to `COLORS.accentDim`.
3. **PetCard "From ₪59" price fix [HIGH/LOW].** `PetCard` (~L11383) shows "From ₪59" (mug price) but the hero product/modal default is the ₪149 shirt → expectation gap at the moment of interest; the `|| 59` fallback can also print a non-real price. Show a true cheapest-purchasable "from", or drop the number.
4. **Post-add momentum from PetModal [HIGH/MED].** BLOOM "Add to cart" leaves the modal open with no forward nudge. Pass a "View cart →"/"Checkout" action into the confirmation toast (the `CartToast` already supports `onViewCart`/`onAction`) and/or auto-open `CartDrawer`.
5. **Defer 4 picker-only webfonts [MED/S — performance].** Assistant, Secular One, Suez One, Rubik are each used **once** (pet-name picker `PET_NAME_FONTS`) yet load render-blocking site-wide (`index.html` L79–80). Move them to a lazily-injected stylesheet when the picker mounts; trim unused Heebo weights.
6. **Cart drawer "Total" → "Subtotal" [MED/LOW].** `CartDrawer` (~L9182) labels subtotal-only as "Total" in 22px accent type while shipping shows "At checkout" → surprise-cost anchor. Relabel "Subtotal"/"Items total" or add "+ shipping from ₪27 (₪0 personal handoff in Be'er Sheva)".

### Performance (medium effort, high payoff)
- **[HIGH] PetsPage re-renders all 70 cards on scroll (desktop).** `PetCard` (~L11267) isn't memoized; `useParallax`×4 (~L10446) each `setOffset` per scroll frame; `filtered.map` passes a fresh `onClick` closure (~L11108). Fix: `React.memo(PetCard)`, `useCallback(openPet)` + stable `onOpen(design)`, and collapse the 4 parallax subscriptions into one shared scroll value. Kills `/pets` scroll jank.
- **[MEDIUM] Admin surface (~1,500 lines) ships in the public bundle.** `AdminPage`→`DesignEditor` (L3597–5071) is a static import (main bundle 631KB raw / ~172KB gzip). Extract to its own file and `lazy()` + `<Suspense>`, exactly like `MugStudio`. Largest code-split win left.
- **[MEDIUM] LCP hero image not preloaded / lazy on the active card.** Add `fetchpriority="high"` and remove `loading="lazy"` from the first/active above-the-fold carousel card (keep lazy on off-screen cards); optionally a tiny static poster preloaded in `index.html`.
- **[LOW] SmartImage retry cache-buster** can re-download at full size and miss the CDN cache across 70 grid images on flaky networks — cap `MAX_RETRIES` lower for grid/lazy images, or retry only `src` not the full `srcSet`.

### Conversion / UX (content + placement)
- **[HIGH/MED] No social proof anywhere** — `Reviews` returns null until rows exist; the `testimonials` table is empty. Plumbing (CRUD admin + AggregateRating JSON-LD) is built; **seed 3–6 real testimonials** (owner action) — the biggest missed lever for a new POD shop.
- **[HIGH/MED] Home leads with the BLOOM carousel**, burying the H1 value prop + primary CTAs (`Hero`) below the fold (L10106 order: carousel → Hero → …). Render `Hero` first or slim the carousel to a strip.
- **[MED] Pre-select the shirt in PetModal** (`previewProduct='shirt'` on open, L11770) so the primary CTA is immediately actionable (size/color already default).
- **[MED] Trust signals inconsistent across funnel** — `TrustRow` (home) vs `TrustStrip` (cart, ships+secure only) vs payment-step block; pull a compact secure/PCI/no-stored-cards strip up into `PetModal` and `CartDrawer`. (Ties into B4 — fix the "14-day returns *" copy here too.)
- **[MED/LOW] Checkout step labels hidden on narrow phones** (`!isVeryNarrow`, ~L6384) remove the progress map — keep at least the active step's label.
- **[MED/LOW] Tasteful, truthful urgency/scarcity** — reframe made-to-order as "printed fresh by hand in Be'er Sheva"; surface the existing `is_bestseller` signal in the modal. No fake countdowns.
- **[LOW] Hero stacks 3 co-equal CTAs** (L8183) — rank one primary (BLOOM) + two secondary links.
- **[LOW] Gallery empty/no-results states are dead-ends** (~L11031) — add a "Clear filters / Show all" button inside the empty state.

### Brand polish (typography & depth)
- **[MEDIUM] Hero sub-text** `#888`/18px/weight-300 Varela over dark (~L8182) reads thin (~4.0:1) — Heebo 400, brighter color, `lineHeight:1.7`, `maxWidth:520`.
- **[MEDIUM] Ad-hoc type scale** — section H2s hardcoded 24/26/28/36; define a small `TYPE` scale with `clamp()` for fluid headings.
- **[MEDIUM] Body base 12–13px** in nav/footer/cards reads "appy" — raise nav/footer links to 14px, card desc 13–14px, leading ~1.6–1.7.
- **[LOW] Flat card elevation** (Hero cards `box-shadow:none` at rest → abrupt orange glow on hover) — add a faint resting shadow + 2–3 named elevation tokens.
- **[LOW] Reveal animation slow** (1.0s + up-to-0.6s stagger) — drop to ~0.6–0.7s, cap stagger ~0.4s.
- **[LOW] Hero CTA stack mixes 3 fonts/paddings** (L8184) — unify to Heebo, equalize heights, reserve Playfair italic for the one accent link.
- **Note (not a bug):** Nav still renders legacy `/logo.jpg` with `mixBlendMode:"screen"` (L8309/8332); a Playfair wordmark / no-bg logo aligns better with the approved direction — brand-asset decision.

---

## 6. ✅ What's Already Solid (verified — no action)

- **Launch gates consistent** and the 3-gate model is coherent (App.jsx maintenance, `api/og.js` MAINTENANCE, `noindex`).
- **Server pricing has no drift** — `create-payment` CATALOG matches `PRODUCTS` (tshirt/lycra/oversized/look/stonewash/dryfit = 149, mug.standard = 69, sticker 15/25/35/45); the `myid` line was correctly removed; `body.amount` is ignored, amount recomputed server-side. *(The B1 hole is the fail-open fallback only — the recompute itself is correct.)*
- **JSON-LD prices are current**; `og.js` JSON-LD escapes `<`→`\u003c` (no `</script>` breakout); all DB values run through `escapeHtml`.
- **`payment_status` mapping correct** (`succeeded`/`failed`, not `paid`).
- **Webhook query-back** re-verifies the transaction; emails fire only after the order is marked paid, each in its own try/catch + `payment_events` audit, and never block the order.
- **`verify_jwt` correct on all 10 active edge functions** (create-payment + send-status-update `true`; webhook + senders `false`) — the previously-feared 401-on-confirmation is resolved.
- **WAF active** (Vercel Basic rate limit, 300 req/60s per-IP → 429).
- **Security posture strong** — HSTS, `X-Frame-Options:DENY`, `frame-ancestors 'none'`, `nosniff`, `object-src 'none'`, `base-uri 'self'`, scoped `form-action`, `upgrade-insecure-requests`; `/quiz` `unsafe-inline` isolated by path lookahead; no service-role key in the client bundle; `dangerouslySetInnerHTML` guarded by `sanitizeBlogHtml` on admin-authored content; no open redirects in `pay-return.js`/`og.js`.
- **Cookie consent** is genuine opt-in — GA4/Meta Pixel inject only after `cookieConsent==="accepted"`; trackers don't fire pre-consent; privacy text matches.
- **Legal disclosures complete** — exempt-dealer no. `321630279` consistent everywhere; 0% VAT / receipt-not-tax-invoice, cross-border processing, PCI-DSS, data-subject rights all present trilingually; refund §1 vs §2 contradiction already resolved.
- **Prior batches verified present** — a11y focus trap/skip link/`:focus-visible`/swatch `aria-pressed`, delivery radiogroup, checkout labels, PetModal/lightbox dialog semantics, contrast-safe `accentBtn #C0501A`, mobile RTL nav/MaintenancePage/iOS-zoom fixes, `colorName()` Map, analytics events.
- **Template-literals-only convention respected** across `App.jsx` and all edge functions — no `+` string-concatenation build risks found in any audited dimension.

---

## 7. Appendix — Counts & Methodology

**Issue counts (deduplicated):**
- BLOCKERS: **5** (1 CRITICAL B1 + 4 HIGH B2–B5) + 2 launch-checklist verifications (sitemap, WAF).
- Should-fix-soon: **9** (S1–S9).
- Nice-to-have: **~26** across email, cart/data-model, a11y, i18n/content, mobile, SEO.
- Visual roadmap: **6 quick wins** + ~17 performance/conversion/brand items.

**Methodology:** Merged (A) the already-confirmed payments/SEO pass + live Supabase/Vercel production facts with (B) a fresh 8-dimension static audit (email, cart/checkout, i18n-rtl, web-security, accessibility, performance, code-quality, legal-content) and 3 visual lenses (brand-polish, mobile-ux, conversion-ux), all verified by symbol-name against current code (line numbers treated as approximate). Already-shipped 2026-06-05 fixes were confirmed present and excluded. Payment pricing was not re-audited except to confirm B1's fail-open fallback. Two unverifiable items remain: the runtime overflow sweep at 360/390/414 × zoom (browser-only), and the two missing email functions (S6, not in repo).