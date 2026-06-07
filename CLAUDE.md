# CLAUDE.md — Sfalim Shop Project Context

Every project agent should read this file before acting. It is the **shared brain** for all subagents in `.claude/agents/`.

---

## 🏪 Project at a glance

**Sfalim Shop** (sfalimshop.com) — Hebrew-first print-on-demand shop (t-shirts, mugs, stickers + the 70-character BLOOM pet portrait collection).

- Owner: Gleb (admin email: `gleb2009@gmail.com`)
- Israeli exempt dealer (עוסק פטור) #321630279
- HaSportaim 28, Be'er Sheva, Israel
- Customer email: `hello@sfalimshop.com`
- Instagram: `@sfalimshop`
- Status: **PRE-LAUNCH.** Code is **live on production (Vercel) but behind the maintenance gate** — all 3 launch flags ON. Public sees the maintenance page; staff see the full live site.

---

## 📌 CURRENT STATE (as of 2026-06-06) — read this first

> Source of truth. Where older notes (changelog below) conflict, this wins.

### 🚀 Production / branch state
- **Production = `main` (HEAD `b5e15a9`)**, deployed behind the maintenance gate (all 3 launch flags still ON). Now on main (merged + deployed 2026-06-07): the Hebrew heading font (Frank Ruhl Libre), commission cart clarity, BLOOM gallery explainer, product-numbering/cart-wording fixes, the mixed-cart guard, the **wedding/company event-mugs section**, and the `WHATSAPP-TEMPLATES.md` doc — on top of the **custom BLOOM commission flow** (`BLOOM_COMMISSION_ENABLED=true`) and the custom-shirt order-flow overhaul. Public still sees the maintenance page; launch = flip the 3 flags.
- **`main` = `b7d0014`** (deployed behind gate). **`launch-prep` = `c17f901`, 2 commits ahead of `main`** (pushed to origin, **not yet on main**): `56079f8` CLAUDE.md (create-payment v20 deploy note) · `c17f901` **home entrance "wow" effects** — aurora glow + mobile device-tilt card + staggered hero headline. Merge to `main` to deploy them behind the gate. (The create-payment **v20** quantity-clamp fix and the reviews-localization were already merged to `main`/deployed earlier 2026-06-07.)
- **LIVE in prod Supabase (not code):** first real testimonial (Ella, ★5, custom photo-collage shirt) → home `Reviews` block active + per-language name/product (migration `testimonials_localized_name_product` added `author_name_en/ru`, `product_en/ru`).
- **Staff** (`?staff=1` + `VITE_STAFF_PASSWORD`, set in Vercel Prod+Preview; build-time var → redeploy to change; unset = gate stays closed) see the full live site.

### 💳 Payments — LIVE & verified on production
- Verified end-to-end: real **₪36 test orders succeeded** (tx `376598`, `376992`); webhook **query-back enforced**; orders marked paid; thank-you page renders.
- `PAYMENTS_ENABLED=true`. **Live edge-fn versions: `create-payment` v20** (deployed 2026-06-07 from the repo via MCP, byte-verified = repo; adds the **quantity clamp** [floor + 1..100] on top of the v19 server-side commission-by-type×product pricing), **`tranzila-webhook` v18** (`VERIFY_MODE="enforce"`, real query-back to `report.tranzila.com`). Repo `create-payment/index.ts` == live v20. See *Tranzila integration* below. ⚠️ Residual low-risk hole (still open): commission `extra_prints.ctype` is client-supplied → a crafted insert could declare the cheaper "custom" tier (−₪40). Unknown ctype coerces to the more-expensive "pet" (safe direction). A complete fix needs a server-trusted anchor for the commission type (small schema follow-up) — there's no independent server record of pet-vs-custom today.

### ⚠️ REPO SYNC TODO (next code session — important)
`create-payment` v10/v11 were deployed **directly to Supabase**, not from the repo. The repo `supabase/functions/create-payment/index.ts` already has the pay-return URL change but **must also REMOVE the `myid` line** so the repo matches the deployed v11. (Context: `myid` mapped to the ID field on Tranzila's hosted page and left it stuck right; the order group is carried by **`u71`** only, which the webhook reads. Removing `myid` fixed the empty-ID-field + centered page. `api/pay-return.js` — Vercel serverless, GET+POST, 302 to the SPA hash route — fixes the post-payment 405.)

### 🚚 Delivery model — **3 methods chosen at checkout** (replaced flat ₪35; LIVE)
- Stored in **`orders.delivery_method`** (text, default `'ups_home'`, CHECK in `['personal_beersheva','ups_home','ups_point']`). Prices in **`SHIPPING_OPTIONS = {personal_beersheva:0, ups_home:55, ups_point:27}`**.
  1. **`personal_beersheva` → ₪0** ("מסירה אישית · באר שבע"). Address **OPTIONAL** (deliver-or-pickup, coordinated via WhatsApp). Owner address **NEVER shown publicly**. No word "חינם" — uses **"ללא עלות משלוח"**.
  2. **`ups_home` → ₪55** (UPS door-to-door; address required).
  3. **`ups_point` → ₪27** (UPS pickup point; address required).
- **UPS account opened** — real prices ₪27/₪55 confirmed, stay as-is. Tranzila amount recomputed server-side from `SUM(orders.total)` (shipping folded into the first row) — **verified correct for all 3 methods**.
- `SHIPPING_PRICE = 35` kept **ONLY** as an internal numeric fallback in `OrderSummary` (~line 5129) — **no longer customer-facing**. All stale "₪35" text removed (product strip, FAQ, shipping policy → "משלוח מ-₪27 · או מסירה אישית בבאר שבע"); `grep ₪35` → 0 customer-facing.
- **Owner TODO before launch:** test the 3 totals in checkout via `?staff=1` — one test order per method, confirm Tranzila charge = product-only / +₪55 / +₪27.

### 🛠️ Admin additions (LIVE)
- **A1** (`131f809`): **payment status** on order card/detail (7 states via `PaymentBadge`, read-only — `amount_paid`/`paid_at`/`tranzila_transaction_id`); **order search+sort** (name/email/phone/order#); **dashboard summary** (orders today/7d, revenue today/7d/month from `succeeded` `amount_paid` **deduped by `order_group`**, needs-action count).
- **Testimonials manager** (`4ccba8e`): full CRUD over the existing `testimonials` table (no DB change). Public `Reviews` on home already exists (`is_active=true`, hides at 0 rows, injects AggregateRating JSON-LD).
- **A2 deferred (post-launch):** general needs-action queue, per-order manager notes, status timeline.

### ♿ Accessibility (LIVE)
- **High-contrast now reaches body-portaled overlays** (`2026-06-05`, `9e7dc2f`, on `launch-prep`): the contrast `filter` was only on `#root`, so toggling High Contrast with a PetModal / cart / lightbox open left the overlay un-boosted. Fixed by toggling a `sf-hc` class on `<body>` + a global rule `body.sf-hc #root, body.sf-hc [data-sf-zoom] { filter: contrast(1.4) brightness(1.1) }` — same reach as the `--sf-a11y-zoom` var, and covers overlays opened *after* contrast is on. Verified via headless probe: an open card's computed `filter` goes `none` → `contrast(1.4) brightness(1.1)`. (Lesson reaffirmed: CSS inside the `<style>{` … `}</style>` JS template literal must contain **no backticks**.)
- **Font-size control rewritten:** was root-font-size (only scaled `em` text); now **CSS `zoom` via `--sf-a11y-zoom` var on `#root` + `[data-sf-zoom]` overlays** (PetModal/cart/lightbox). Levels **100/110/120/130%**. FABs portaled to `<body>` stay viewport-fixed; removed the FAB overlay-self-hide so it stays visible/tappable over PetModal under zoom (`6499fbe` + `2e6853c`). **Lesson reaffirmed:** `zoom` (like `filter`/`transform`) makes its element a containing block for `position:fixed` descendants — keep fixed FABs OUTSIDE the zoomed subtree.
- **PENDING (agent-memory note):** full overflow sweep 360/390/414 × he/en/ru × every zoom level when browser MCP returns; **cap max to 120%** if any level overflows (esp. cart panel `width:100%` at 130%).

When going public: **flip the 3 launch flags.** (Note: `launch-prep` is 4 unmerged commits ahead of `main` — through `ca75fa1`, see 2026-06-06/07 below — merge them to `main` first to deploy the Hebrew heading font, commission cart clarity, BLOOM explainer, mixed-cart guard, and the wedding/event-mugs section.)

### 🔔 Launch gates (all 3 still ON → flip at launch)
- `MAINTENANCE_MODE` (App.jsx, ~line 1509, find by name) `true` → **`false`**
- `index.html` noindex ×3 (robots/googlebot/bingbot, lines ~49–51) → **`index, follow`**
- `api/og.js` MAINTENANCE (~line 26) `true` → **`false`**
- **Keep unchanged:** `PAYMENTS_ENABLED=true`, `STONEWASH_ENABLED=false`, `MUG_STUDIO_ENABLED=false`. `SHIPPING_PRICE=35` kept (internal fallback only — see Delivery model). `WHATSAPP_NUMBER` live ✓. **Launch = flip the 3 flags.** (`launch-prep` is 1 commit ahead — `9e7dc2f`; merge it to `main` first to include the latest card glow + contrast fix.)

### 🧷 Owner-side / non-blocking (owner's choice before public launch)
- **Receipt (קבלה, exempt-dealer, 0% VAT) auto-emailed via Interspace/Tranzila + logo on receipt.** Owner configured the Tranzila doc settings (auto-send + logo `Invoice_logo_fxpsfalimshop.png` + sender `hello@sfalimshop.com`) and sent Interspace the activation answers (doc type=receipt, numbering starts ~1001 pending accountant, no retro, auto-email on). Interspace said ~1 day to activate. **Receipt auto-issue CONFIRMED WORKING (owner verified 2026-06-05) — issues automatically; was the last pre-launch owner blocker, now cleared.** Accountant wants a monthly receipts report (owner pulls from Tranzila directly).
- **Shipping carrier — DECIDED ✅.** Owner **opened a UPS account**; real prices confirmed: **₪27 pickup-point / ₪55 door-to-door**. Now live as the 3-method checkout (see Delivery model). Personal handoff in Be'er Sheva = ₪0.
- **Inventory = POD (parked, no code).** Owner prints himself + holds blanks → **no inventory table in DB, none planned.** Owner doing a manual blank-stock count (sizes/cuts/colors) to decide reorder.
- **Flock brand signature (researched, parked — not a launch blocker).** SEF VelCut Evo flock + Metalflex outline; cat/dog + paw "lockup" themed to design; recommended on-demand combo (no MOQ); 3D silicone rejected (MOQ 500–1000). Supplier question list ready — owner to call supplier.
- **SEO migration deferred** to post-launch.
- Real **Stone-wash photo** (product stays hidden behind `STONEWASH_ENABLED=false` until shot; re-enable = flip to `true` **and** restore its Product row in the `index.html` ItemList).
- **Accountant:** refund the test charges (`374782`/`374798`/`374836` ₪3 batch, plus the new ₪36 prod tests); confirm turnover + receipt settings.
- **Lawyer:** policy review when revenue justifies (self-prepared good-faith drafts; cross-border basis + custom-vs-stock cancellation classification).
- **Post-launch security (deferred):** rotate the hardcoded edge-fn fallback secrets (`WAITLIST_WEBHOOK_SECRET`, `DESIGN_NOTIFY_WEBHOOK_SECRET`) → real Edge Function secrets (**MJ-1**); Vercel WAF rate-limiting on payment endpoints (**MJ-2** / H3). Critical security already strong (query-back webhook, RLS, no service-role key client-side, security headers).
- **Post-launch backlog (researched, parked):** n8n/Make automation, WhatsApp auto-notify, GEO, email marketing, personal area / save customer details, on-product 3D customizer (Zakeke best fit / PitchPrint budget — post-revenue only), prerender/SSR for breed-page crawler SEO (moot under `noindex`).

---

## 📜 History / changelog (collapsed — outcomes only)

Past dated "STATE AS OF" snapshots, compressed. Each line = a shipped milestone; current state above wins on any conflict.

- **2026-05-30** — Merged `launch-prep`→`main` (`174f312`) + deployed to prod **behind the maintenance gate** (infra preview, NOT public launch). Shipped: breed pages (`#/breed/<slug>`), pet-name paid add-on (+₪20, `PET_NAME_SURCHARGE`), shared `BloomImageCarousel`/`BloomHeroImage`, testimonials table + `Reviews` (hidden until rows), admin waitlist dashboard, **staff password gate** (`VITE_STAFF_PASSWORD`), bottom character rail. `pet_designs` cleaned to exactly 70 (12 legacy drafts deleted). `waitlist-welcome` email LIVE. In-house printing confirmed (no external provider). Quiz already exists — do NOT rebuild. 70/70 BLOOM shirt mockups live (white+black). Breed content LIVE (70/70, all 3 langs).
- **2026-05-31** — Payment-integrity holes FIXED + live on prod (mirrored to repo): `trg_protect_order_payment_fields` trigger freezes payment fields + enforces design-approval transitions; `create-payment` recomputes charge server-side from `SUM(orders.total)`; `tranzila-webhook` Layer-2 amount verify. Custom-design approval workflow LIVE. Blog: 4 trilingual published posts (in DB `blog_posts`, gated behind maintenance until launch). Full per-page SEO (breed + blog JSON-LD, canonical, hreflang) + `generate-sitemap`. `www.sfalimshop.com` unified everywhere.
- **2026-06-01** — A11y pass (IS 5568 / WCAG 2.1 AA): keyboard ops, `useDialogFocus`, contrast bumps. Quiz a11y widget (`public/quiz/index.html`). High-contrast containing-block fix (portal fixed overlays to `<body>` — **lesson:** a CSS `filter`/`transform`/`perspective` makes its element the containing block for `position:fixed` descendants). Payment-return route handlers (`#track?paid=1`, `#order?paid=0` — read-only, webhook owns `payment_status`). Admin fetch error handling. Cancelled-order timeline fix. Favorites feature (client-only `localStorage` `sf_favorites`). WhatsApp FAB (gated by `WHATSAPP_NUMBER`) + cart trust strip. Migration `restrict_customer_order_status_to_cancel` (customer may only set status `cancelled`).
- **2026-06-02** — Payments fully live & secured behind maintenance for staff testing; `tranzila-webhook` v12, all order emails fire **post-payment only** from the webhook. New `notify-design-submission` edge fn (admin alert on custom-design submit). Pet-name personalization: font picker (Heebo/Assistant/Secular One/Suez One/Rubik) + 7 color swatches + live preview; new `orders` cols `pet_name_font`/`pet_name_color`; admin `AdminPetNameBlock`. Shirt products: new "Oversize Stone-wash" @₪119 flat, Oversize→₪119 flat, removed "240g" wording; fabric facts (Tee Basic/Oversize/Stone-wash = 100% combed cotton, Dri-FIT = polyester, mugs = ceramic). **Pre-launch audit COMPLETE** (a11y WCAG 2.1 AA, SEO Option B = 80 real crawlable URLs, UX/QA, legal text strengthened — privacy abroad-disclosure, exempt-dealer/no-VAT/receipt terms, refund protected-groups clause). Deep re-audit fixed the **mobile nav hamburger off-screen** blocker (removed duplicated inline lang switcher); card display: name centered, species label hidden from cards (gallery filter still works). All 10 edge functions ACTIVE on prod. **`launch-prep` tagged technically LAUNCH-READY.**
- **2026-06-03** — Post-payment 405 fixed (`api/pay-return.js`, `create-payment` v10); `myid` removed (`create-payment` v11) — fixed Tranzila ID-field + right-stuck page. Google Places autocomplete working (key was on old "Places API" not "Places API (New)"). Shipping → single flat ₪35 everywhere (merged to main). About page enriched + carousel dots single line + 5-step "how it works".
- **2026-06-04** — All merged to `main` (fast-forward, behind gate). Commit trail: `131f809` admin A1 (payment status + search/sort + dashboard) · `9a23390` **3 delivery methods** (personal BS ₪0 / UPS home ₪55 / UPS point ₪27) · `4ccba8e` testimonials manager · `404a102` personal-BS optional address (deliver-or-pickup) · `6499fbe` a11y font-size = site-wide `zoom` · `2e6853c` a11y FAB-under-zoom fix · `25406b5` stale-₪35 text fix. **`main` HEAD = `25406b5`.** Flat ₪35 → 3-method delivery; flock/POD/SEO parked (owner-side). **← see CURRENT STATE above.**
- **2026-06-05** — `9e7dc2f` on `launch-prep` (1 commit ahead of `main`, **not merged / not deployed**): (1) **mobile home card glow** — `BloomCardLite` (the <768px BLOOM showcase card) got a warm orange halo (`boxShadow … rgba(255,107,53,0.42)`) to match the desktop `FloatingProductCard`'s holographic glow; (2) **a11y High-Contrast overlay fix** — contrast filter now covers the body-portaled `[data-sf-zoom]` overlays (PetModal / cart / lightbox) via a `sf-hc` body class, not just `#root` (toggling contrast with a card open now boosts the card too); (3) **dev-only maintenance bypass** (`import.meta.env.DEV` in the `staffUnlocked` init) so the local `vite dev` preview shows the real site past the gate — compiled to `false` in the prod build, so it can never reach production. First hands-on session driving Claude Code directly in VS Code (see user memory `gleb-workflow-claude-code`).
- **2026-06-05 (later, deployed to `main` behind gate)** — (a) FB/Meta **domain-verification** tag in `index.html` (`99c74ec`); domain `sfalimshop.com` verified. (b) **Custom-shirt order-flow overhaul:** flat **₪149** for ALL shirts (any size, no size-based bump); added **Lycra** + **Look** products, un-hid **Stone-wash** (`STONEWASH_ENABLED=true`); per-model colour sets from the supplier catalogue via new `SHIRT_COLORS` library + `colorHexes()` (Basic 18 / Dri-fit 17 / Oversize 11 / Look 7 / Stone-wash 8 / Lycra 2; trilingual; `colorName()` resolves every hex); **all prints included** (front / back / sleeves) — `BACK_PRINT_PRICE` / `SECOND_FRONT_PRICE` / `SLEEVE_PRICE` set to 0, toggles show "included"; **Oversize category** (collapsible group — Classic / Look / Stone-wash — `openCat` state) in the product picker; new collapsible **"Our Fabrics" guide** (`FABRIC_GUIDE` — 5 fabrics × how-made / why-great, he/en/ru, `showFabrics` state). Custom orders are supplier-on-demand so the full colour range is offered (no stock table). **BLOOM** collection shirt-type expansion deferred (needs held inventory). Detail in memory `sfalim-custom-tshirt-types-task`.
- **2026-06-05 (full audit + fix batch 1, deployed behind gate)** — Ran a **14-area full-site audit** (multi-agent; saved `AUDIT-2026-06-05.md` — 9 critical / 24 should-fix / 26 nice-to-have). Fixed batch 1: (1) **index.html JSON-LD** shirt prices ₪89/119/95→**₪149**, priceRange ₪35–₪149, + added Lycra/Look/Stone-wash (was stale after the flat-₪149 change → wrong-price rich snippets); (2) `localizeProduct` `PRODUCT_IDS` + the step-2 Size/Option label now include `lycra`/`look`; (3) RTL: cart "לתשלום" arrow direction; (4) **a11y**: 4 white-on-`#FF6B35` buttons → `accentBtn` `#C0501A` (AA), and the included-prints toggles are now real keyboard/SR controls (`role=button` + `tabIndex` + `aria-pressed` + `onKeyDown`→`.click()`); (5) **mobile**: OrderPage padding responsive (`isMobile`); (6) **analytics** (were entirely missing): GA4 + Meta `purchase` (dedup per `order_group`, fired on pay-return; added `total` to the select), `begin_checkout`/`InitiateCheckout` (pre-Tranzila redirect), `add_to_cart`/`AddToCart` (new custom item) — all `window.gtag?.()`/`fbq?.()` guarded. (7) **Repo-sync**: committed the LIVE hardened `create-payment` v11 + `tranzila-webhook` v12 into git (repo had old/pre-hardening copies → closes the "redeploy reintroduces spoofing" critical). **STILL OPEN (next):** the 4 email edge functions into the repo (`supabase functions download`), order-confirmation email shirt details, `view_item`, the deeper `orders.total`-on-INSERT server validation, WAF rate-limits, and the long tail in `AUDIT-2026-06-05.md`.
- **2026-06-05 (audit fix batch 2, deployed behind gate)** — More fixes: FloatingProductCard default `imageUrl` → empty string (was an Unsplash URL outside the CSP `img-src`); business address de-duplicated ("11 HaSportaim St. 28" → "HaSportaim St. 28", all 3 langs — **owner to confirm the exact registered address**); per-print "Uploaded" badge now has a Russian branch; `SmartImage` cached-complete effect gated to `[src]` deps (was running every render ×70 on /pets); `/faq` added to the dynamic `generate-sitemap` staticUrls. **Deliberately deferred** (real trade-offs / need decisions / owner accounts): the global `overflow-x` guard (conflicts with the a11y CSS `zoom` at 130% + `position:sticky`), the refund-policy §1/§2 contradiction wording, the `view_item` event, nudge-button aria-labels, the 4 email functions repo-download + email shirt-detail content, Vercel WAF rate-limits, and the deeper `orders.total`-on-INSERT validation.
- **2026-06-05 (audit fix batch 3, deployed behind gate)** — a11y/perf/i18n/SEO: manual-fine-tune collapsible headers now keyboard-operable (`role=button` + `aria-expanded` + `onKeyDown`); colour-swatch selected state now shows a ✓ (not just border + scale — invisible on light swatches before); the "very narrow" stepper breakpoint 360→400 (labels no longer clip at exactly 360px); drag-to-position hint got a Russian branch; `colorName()` now uses a module-level hex→entry `Map` (was rebuilding the full colour table on every call, twice per swatch); robots.txt dropped the no-op hash-route `Disallow /admin` `/track` lines. STILL TODO (can do without owner, next pass): `view_item` event, GA4 `page_view` title/location, accordion/fabrics `aria-controls`, nudge-button aria-labels, og.js `og:image` dims, RTL hero-CTA arrows, refund §1/§2 clarifying line.
- **2026-06-05 (audit fix batch 4, deployed behind gate)** — analytics/a11y/i18n/legal: `view_item`/`ViewContent` now fires when a BLOOM character (PetModal) opens; GA4 `page_view` now sends `page_title` + `page_location`; the Oversize + "Our Fabrics" accordions got `aria-controls` + panel ids + `aria-hidden` carets; refund policy §1 now clarifies it applies to **ready-made items only** (printed/personalized are made-to-order, non-cancellable after design approval — resolves the §1/§2 contradiction; he/en/ru — owner/lawyer to glance); care-FAQ now describes the Lycra (cotton-elastane) and Look (cotton-poly) fabrics (he/en/ru). **Remaining can-do-alone (small, next):** nudge-button aria-labels, og.js `og:image` width/height/type, RTL hero-CTA arrows, RU refund heading "general" qualifier, mockup-preview alt text. **Needs owner:** 4 email functions repo-download + content, WAF, deeper `orders.total` validation, logo choice, address confirmation.
- **2026-06-06 (custom BLOOM commission flow, deployed to `main` behind gate)** — commits `249aae4`→`82a4cad`. New **commission** service behind `BLOOM_COMMISSION_ENABLED=true` (App.jsx ~1748): customer picks a shirt/mug, then chooses **upload my design / 🐾 draw my pet (BLOOM portrait) / ✏️ custom design (text·logo·idea)**. Commission is **pay-first, no design upload** — after payment a WhatsApp CTA opens (on the thank-you/Track page) to send photos/idea; admin order card shows a "🎨 awaiting photos" badge. 2×2 pricing `COMMISSION_PRICE` (pet shirt ₪189 / mug ₪149 ; custom shirt ₪149 / mug ₪109), threaded via `extra_prints.ctype`/`pid` and **re-priced server-side by `create-payment` v19**. Mug commission tier exists in code but the choice box only renders for non-mug products (mug path not yet exposed). `tranzila-webhook` at v18.
- **2026-06-06 (full pre-launch re-audit + polish, on `launch-prep` — commits `7410c06` + `2e7222c`, pushed to origin, NOT deployed)** — Ran a fresh multi-agent review (UX/journey, pricing/money-flow, payment-security, CRO/trust/growth) **plus a live-browser visual+font pass** (Chrome DevTools MCP, he/en/ru). Findings + fixes:
  - **Typography (verified live):** `Playfair Display` (all headings) has **no Hebrew glyphs** → Hebrew headings were falling back to the device's system serif (inconsistent cross-device). Loaded **Frank Ruhl Libre** and changed the stack to `'Playfair Display','Frank Ruhl Libre',serif` everywhere (98 sites) so Hebrew headings use a controlled Hebrew serif; en/ru keep Playfair (it **does** have Cyrillic — Russian headings/body render fine, corrected an earlier wrong assumption). `index.html` font link updated.
  - **Commission cart clarity:** commission line items showed a blank shirt mockup with no explanation; added trilingual `cartNotePet`/`cartNoteCustom` notes in CartDrawer + OrderSummary.
  - **BLOOM gallery explainer:** `/pets` hero `subheading2` now says "N illustrated pet portraits — pick your breed, print on a shirt/mug" (he/en/ru) instead of the poetic "oil portraits" line.
  - **Product picker numbering:** was 01·02·03·04·**07** (Oversize group consumed indices) → sequential 01–05, sub-models inside the group unnumbered.
  - **Cart drawer footer:** "חינם" → "ללא עלות" (delivery-copy rule).
  - **Mixed-cart guard:** blocked combining a pay-first commission with an approval-first custom upload in one cart (would strand the commission unpaid in the approval queue) — pure client-side guard + trilingual banner, **no payment-logic change**.
  - **DECISIONS (owner):** home stays **carousel-first** (Hero below — not reordered); **commission pricing-security hole deferred** (see Payments note above); **reviews** — owner to supply 1–2 real testimonials to seed the (currently empty → hidden) `testimonials` block before launch.
  - **Noted, not fixed (related, payment-adjacent):** the same strand-unpaid risk exists for **BLOOM item + custom upload** in one cart (same root: pay-first vs approval-first); product-mockup duplication (Lycra/Look/Stone-wash share images) deliberately left for a future real photoshoot.
  - Full older findings live in `AUDIT-2026-06-05.md`.
- **2026-06-07 (wedding/event mugs + first real review, on `launch-prep` `ca75fa1`)** — Short research → shipped the owner's idea: a **wedding & company/branded event MUGS** section on the home page (`EventMugsSection`, he/en/ru, styled like `EventOrdersSection`, rendered right after it). Keepsake/gift positioning distinct from the shirt group-orders block: covers weddings (names/date/photo) + company/branded (logo/date) + the on-brand "your pet as a BLOOM portrait" angle; shows what can go on the mug, a price anchor (**His & Hers pair from ₪149** · small table (10) · company by quote), and a WhatsApp "get a quote" CTA with a guided prefill. **MVP = WhatsApp-quote only — no cart/DB/payment.** Matching wedding/event-mugs FAQ entry added. Phase 2 (post-launch): productized `/mugs-events` page + intake form + his/hers cart SKU. — Also loaded the **first real testimonial** into prod Supabase (`testimonials`: Ella, ★5, repeat customer, custom photo-collage shirt as a gift; he/en/ru body) → the home `Reviews` section + AggregateRating JSON-LD now render (was hidden while empty). **Next ideas parked** (from the research): WhatsApp welcome/reply template, waitlist launch-email draft, more testimonials, and post-launch "wow" features (mug studio, gift-a-character, UGC loop, character-of-the-month, sticker-pack builder).
- **2026-06-07 (batch 2 — templates, merge-to-main deploy, security, reviews i18n)** — (1) **`WHATSAPP-TEMPLATES.md`** at repo root: ready-to-paste he/en/ru replies (greeting, wedding/event mugs, BLOOM commission, custom design, group shirts, thank-you + delivery/turnaround snippets). (2) **Merged `launch-prep` → `main` (`b5e15a9`) and deployed to prod behind the gate** (prod build verified `npm run build` ✓; Vercel ● Ready) — the font/mugs/fixes/reviews-block are now in the staged prod build (still behind maintenance). (3) **`create-payment` quantity clamp** (`d92eeea`): qty floor()'d + clamped to [1,100] (blocks fractional-qty underpay / absurd over-charge). **REPO ONLY — edge fn NOT deployed (live still v19);** deploy with `supabase functions deploy create-payment` on the owner's go. Documented the accepted residual: commission `ctype` is client-supplied → a crafted insert can pay the cheaper "custom" tier (−₪40); a full fix needs a server-trusted anchor (schema follow-up). (4) **Reviews localization** (`2798059`): testimonial author name + product now switch with language (migration `testimonials_localized_name_product` → `author_name_en/ru`, `product_en/ru`; front-end fallback to `author_name`/`localizeProduct`). Ella's row localized (אלה/Ella/Элла · custom-design shirt), verified he/en/ru. **`launch-prep` now 2 commits ahead of `main`** (`d92eeea`, `2798059`).
- **2026-06-07 (batch 3 — create-payment deploy + entrance "wow" effects)** — (1) **Deployed `create-payment` v20** to live Supabase via MCP `deploy_edge_function` (CLI not installed). Pre-deploy: fetched live v19, byte-compared to repo → confirmed repo == v19 + only the qty-clamp (no drift). Post-deploy: re-fetched v20, byte-verified, `verify_jwt:true` preserved. The qty-clamp is now LIVE; the commission-`ctype` residual is still open (needs a schema anchor). (2) **Home entrance "wow" effects** (`c17f901`, from a web-trends research pass): **Aurora** — 3 soft drifting warm radial-gradient blobs behind the particles on home (`.sf-aurora`, radial-gradient so NO live `filter:blur` → mobile-safe; transform-drift; `page==="home" && !reduceMotion`; especially valuable on phones where `ParticlesBackground` bails). **Device-tilt** — the active BLOOM carousel card tilts to the phone gyroscope on mobile (`deviceorientation` → `perspective() rotateX/rotateY`, rAF-throttled, clamped ±8°, gated `isMobile && !reduced-motion`; **no intrusive iOS permission prompt** → Android free, iOS only if motion already granted; desktop keeps FloatingProductCard's cursor tilt). **Staggered hero headline** — words fade/rise in sequence on load (`.sf-hero-word`, RTL-aware via DOM order, instant under reduced-motion). All compositor-only props; verified live (aurora visible, synthetic `deviceorientation` tilts the card, headline words render); `npm run build` ✓; no console errors. **Mobile gyroscope tilt needs a real-phone test.** Not yet merged to `main`.

---

## 🛠️ Tech stack

- **React 18 + Vite 4.5** (esbuild 0.18 — **template literals only, no `+` string concat**)
- **Supabase** (DB + Auth + Storage + Edge Functions), project ref **`ubvgrxlxtelulwjtfudd`**, **Pro tier** (daily backups, no pausing)
- **Vercel hosting**, **Pro tier** (WAF available)
- **GitHub:** `gleb94-droid/sfalimshop` (private)

Local working dir: `C:/Users/Gleb/Documents/GitHub/sfalimshop`

---

## 📁 Repo structure

```
sfalimshop/
├── App.jsx                        # THE ENTIRE APP (~9350 lines). At repo ROOT, NOT in src/.
├── public/
│   └── quiz/index.html            # Standalone BLOOM personality quiz, vanilla JS
├── api/                           # Vercel serverless functions
│   ├── og.js                      # OG meta image generation (has its own MAINTENANCE flag)
│   ├── pay-return.js              # Tranzila POST return → 302 to SPA hash route (fixes 405)
│   └── p/[handle].js              # /p/<slug> share URL handler
├── supabase/functions/            # Edge Functions
│   ├── send-order-confirmation/   # order email (Resend) — post-payment
│   ├── send-status-update/        # order status email
│   ├── send-admin-order-alert/    # admin new-order alert — post-payment
│   ├── notify-design-submission/  # admin alert on custom-design submit (pre-payment workflow)
│   ├── notify-design-decision/    # custom-design approve/changes email — DISABLED by default
│   ├── waitlist-welcome/          # LIVE — welcome email on new waitlist signup
│   ├── waitlist-launch-announce/  # launch-day blast — triple-gated, DISABLED by default
│   ├── create-payment/            # Tranzila + server-side amount + design-approval gate
│   ├── tranzila-webhook/          # Tranzila webhook — query-back verify (enforce)
│   └── generate-sitemap/          # all 70 breeds + posts + core routes
├── vercel.json                    # Routes + CSP + security headers
├── PAYMENTS-LAUNCH-CHECKLIST.md   # Tranzila go-live checklist
├── .claude/agents/                # Subagent library (TRACKED in git)
└── CLAUDE.md                      # THIS FILE
```

---

## ⚠️ Critical conventions (NEVER violate)

1. **Template literals only** — `` `text ${var}` ``. Never `"text " + var`. (esbuild 0.18 limit.)
2. **Hebrew RTL primary**, English/Russian secondary. Every user-facing string is trilingual (he/en/ru).
3. **Single-file React app** — all UI/logic lives in `App.jsx` at the repo root. Only one agent edits `App.jsx` at a time.
4. **BLOOM slug numbering**: `01-47` = dogs, `48-70` = cats. **Do NOT touch the 70 BLOOM designs.**
5. **Windows ImageMagick**: use `magick identify` / `magick convert`. **Bare `convert` is a Windows disk tool** — it will NOT call ImageMagick.
6. **Pixel Agents (VS Code ext.)** is unreliable for actual work — use the regular Claude Code terminal.
7. **Work on branch `launch-prep`. NEVER commit to `main`** — `main` auto-deploys to Vercel (production). No merge to main, no deploy, without explicit approval.
8. **Never weaken RLS** (`is_admin()`). **Secrets live in env / Supabase secrets only.** Touch payment/Tranzila code carefully (it is now live).
9. **Gleb does not code** — report in plain Hebrew, and **stop for approval before every commit / delete / deploy.**

---

## 🗄️ Database schema (Supabase: `ubvgrxlxtelulwjtfudd`)

### Tables

| Table | Rows | Notes |
|---|---|---|
| `pet_designs` | **70 (47 dogs + 23 cats, all active)** | 39 columns. Core catalog. 0 inactive rows (12 legacy drafts deleted 2026-05-30). |
| `orders` | varies | RLS enabled. Design-approval cols: `requires_design_approval` (bool), `design_approval_status` (`not_required`/`pending`/`approved`/`rejected`), `design_review_note`, `design_reviewed_at`. Pet-name cols: `pet_name`, `pet_name_font`, `pet_name_color`. The `trg_protect_order_payment_fields` trigger freezes payment fields AND enforces approval transitions (customer may only go `rejected→pending`, and may only set status `cancelled`; only shop approves/rejects). |
| `order_status_history` | audit log | RLS enabled |
| `payment_events` | webhook audit log | RLS enabled |
| `admins` | 1 (`gleb2009@gmail.com`) | Self-select RLS only |
| `sticker_packs` | 2 | BLOOM sticker bundles (both ₪35) |
| `blog_posts` | 4 published | Trilingual; gated behind maintenance until launch |
| `testimonials` | 1 active (Ella, ★5) | First real review added 2026-06-07 → `Reviews` section now renders. Has per-language columns `author_name_en/ru` + `product_en/ru` (optional overrides; front-end falls back to `author_name`/`localizeProduct(product)`). Add more via admin Testimonials manager. |
| `waitlist` | grows (pre-launch) | RLS enabled. `email`, `lang`, `source`, `consent`, `breed_interest`, `launch_notified_at`. INSERT fires `waitlist-welcome` via DB webhook (pg_net trigger → edge fn). |

### `pet_designs` key columns

- `slug` (e.g., `01_golden_retriever`, `48_tuxedo`), `name_he/en/ru`, `animal_he/en/ru`, `tagline_he/en/ru`
- `mockup_url` — BLOOM portrait (all 70); `mockup_mug_url` — sofa mug photo (all 70)
- `mockup_shirt_url` — legacy, **NULL for all 70** (superseded); `mockup_shirt_white_url` / `mockup_shirt_black_url` — per-color shirt mockups, populated for all 70 (PetModal is color-aware, falls back to portrait if missing)
- `design_url` — raw transparent design; `mockup_bg` — fallback bg color
- `price_shirt`, `price_shirt_basic`, `price_shirt_oversized`, `price_mug`, `price_sticker`, `price_sticker_pack`
- `is_active`, `is_bestseller`, `is_new`, `sort_order`
- `species` (`dog`/`cat`) — always set
- `breed_he/en/ru`, `breed_aliases`
- `breed_origin_he/en/ru` (text, ~1 sentence) — populated for all 70, all 3 langs
- `breed_facts_he/en/ru` (text, **newline-separated**, 3 per breed, rendered as bullets) — populated for all 70, all 3 langs
  - Breed content written by the `content-writer` agent (accurate, well-established facts only — never invented).

### Storage buckets (all public)

- **`mockups/`** — `bloom/<slug>-clean.webp` (1414×2000 portrait, 70 files), `bloom/<slug>-mug.webp` (70 files, ~355 KB avg), generic templates (`mug.png`, `t shirt basic.png`, `oversize.png`, `dri fit t shirt.png`, `round sticker.png`, `square sticker.png`)
- **`pet-designs/`** — `bloom/<slug>.webp` raw transparent design (70; any leftover legacy storage files are orphans, cleanup separate)
- **`designs/`** — user-uploaded custom designs for orders

### Useful queries

```sql
-- Active characters with mockup URLs (all 70 are active)
SELECT slug, name_he, mockup_url, mockup_mug_url
FROM pet_designs WHERE is_active=true ORDER BY slug;

-- Storage file stats
SELECT bucket_id, name, metadata->>'size' AS bytes
FROM storage.objects
WHERE bucket_id='mockups' AND name LIKE 'bloom/%';
```

---

## 🧭 Key code locations in `App.jsx`

| Feature | Approx Line | Notes |
|---|---|---|
| `LANGS` dict (i18n he/en/ru) | 1394 – 1500 | The translations |
| `MAINTENANCE_MODE` flag | ~1509 | Launch gate (find by name) |
| `PAYMENTS_ENABLED` flag | ~1561 | `true` (stays) |
| `PRODUCTS` array | 1757 | mug/shirt/sticker with prices + printArea |
| `MOCKUP_URLS` const | 1855 | Generic product templates |
| `MugMockup` component | 1998 | Wraps `ProductMockupBase` for mug |
| `pet_designs` SELECT | 945 | Includes the 6 `breed_origin_*`/`breed_facts_*` columns |
| `handleViewActiveCharacter` | ~1000 | BLOOM card → `/pets/` |
| `FloatingProductCard` | 1101 | Home carousel card |
| `BloomCardLite` | 1091 | Carousel variant |
| `DesignEditor` (admin) | 3494 | Admin `pet_designs` editor |
| `OrderPage` | 3814 | Order/checkout flow |
| `PetsPage` | 7721 | BLOOM gallery |
| `PetModal` | 8571 | Per-character detail modal |
| `handleOrder` | 8661 | Adds BLOOM character to cart |
| `ProductOption` | 9128 | Mug/shirt/sticker buttons |
| `previewProduct` state | ~8581 | Drives mug/shirt preview swap |

⚠️ **Breed-page hero**: the BLOOM portrait (`mockups/bloom/<slug>-clean.webp`) already has an orange frame baked in (transparent bg). Do NOT add a second frame — just `object-fit: contain` capped to the viewport (e.g. `maxHeight: min(74vh, 600px)`).

---

## 🐾 Quiz (`public/quiz/index.html`)

- **11 questions**: Q0 = species filter (🐶 / 🐱 / 🐾 both), Q1–Q10 = personality
- **6 personality dimensions**: `en` (energy), `so` (social), `el` (elegance), `bo` (bold), `br` (brains), `wa` (warmth)
- Weighted distance-matching against `PETS` array (70 items); Q0 filters the pool by `sp: 'dog' | 'cat' | 'any'`
- ~300 lines vanilla JS, dark theme, back-to-shop button, WhatsApp share, a11y widget
- Routed by Vercel: `/quiz` has **RELAXED** CSP (inline scripts allowed); rest of site has **STRICT** CSP. **Already exists & links to products — do NOT rebuild.**

---

## 🚀 Vercel configuration

- `vercel.json` — routes + security headers. Strict CSP everywhere EXCEPT `/quiz` (negative lookahead in path patterns to avoid CSP intersection).
- HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin. Domain `sfalimshop.com` (Vercel-managed).
- Pro tier: **WAF rate limiting available** (for Tranzila webhook rate limit / order-submit anti-bot — MJ-2/H3, deferred).

---

## 💳 Tranzila integration — LIVE

Payments are live and verified on production (behind maintenance for staff). Full go-live steps in **`PAYMENTS-LAUNCH-CHECKLIST.md`**.

- **`create-payment` v11** (deployed): recomputes the charge server-side from `SUM(orders.total)` (ignores client amount, audit-logged); blocks payment until design approved (`403 design_not_approved`); success/fail URLs point to `/api/pay-return`; **`myid` removed** (order group carried by `u71`). ⚠️ Repo `index.ts` still needs the `myid` line removed — see REPO SYNC TODO above.
- **`tranzila-webhook` v12** (`verify_jwt=false`, `VERIFY_MODE="enforce"`): reads `order_group` from **`u71`** (Tranzila overwrites `myid` with the merchant id). **Query-back** to `report.tranzila.com/v1/transaction` with `transaction_index` as an **INTEGER** (a string is rejected — `error_code 20004`); verifies `processor_response_code`, amount (agorot/100), currency, `child_terminal`. Layer-2 = amount match. Unverified success → order held as `payment_status='processing'` (never wrongly marked paid).
- **Payment-integrity:** `trg_protect_order_payment_fields` trigger (migrations `20260531120000_*` then `20260531130000_*`, latter's body wins) blocks non-server/non-admin writes to payment columns (`payment_status`, `amount_paid`, `paid_at`, `total`, `tranzila_transaction_id`, `payment_method`, `currency`, `failed_reason`) and enforces design-approval transitions. `service_role`/`postgres`/`supabase_admin`/`supabase_auth_admin` + `is_admin()` exempt.
- **All order emails fire post-payment only, from the webhook** (`send-order-confirmation` + `send-admin-order-alert`). No pre-payment order emails.
- **Custom-design approval workflow LIVE:** customer-uploaded custom designs must be shop-approved before payment (checkout creates `pending` orders, no payment → "submitted for approval" → `#track` shows pending/approved/rejected → admin approve/request-changes queue). BLOOM gallery items + pet-name personalization **pay immediately** (unchanged).
- **Env (Supabase secrets / Vercel):** `TRANZILA_SUPPLIER`, `TRANZILA_TK`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL=https://www.sfalimshop.com`.
- **Still open:** H2 (Layer-1 webhook signature/HMAC — the query-back is the strong Layer-1 in practice; in-code "TODO" is a stale comment), H3 (rate limit / WAF — MJ-2, deferred post-launch).

---

## 🎓 Lessons learned

- **Windows ImageMagick**: use `magick identify` / `magick convert`. Bare `convert` is a Windows disk tool.
- **`.claude/` partial gitignore**: only `.claude/agents/` is tracked. The rest stays ignored.
- **Supabase storage URLs are public** — no auth needed for `curl` / `HEAD`.
- **BLOOM image standard**: 1414×2000, WebP, sRGB, target <500 KB. Paths: `mockups/bloom/<slug>-clean.webp`, `mockups/bloom/<slug>-mug.webp`, `pet-designs/bloom/<slug>.webp`.
- **CSP**: two CSP headers on the same path → browser intersects → most-restrictive applied. Use negative-lookahead in path patterns.
- **Staff bypass**: `?staff=1` opens the staff password field (needs `VITE_STAFF_PASSWORD`); a bare `?staff=1` no longer bypasses.
- **CSS `filter`/`transform`/`perspective`** makes its element the containing block for `position:fixed` descendants — keep fixed UI (overlays, FABs) portaled to `<body>`.
- **Sticker spot color**: must be EXACTLY `PerfCutContour` (Roland convention), NOT `CutContour`.

---

## 💬 Communication style

- **Conversation language**: Hebrew (Gleb is Hebrew-first).
- **Agent output**: English (consistent across all subagents).
- **Style**: Concise, action-oriented, code-ready-to-paste, tables for comparisons, emoji for visual scanning, no excessive caveats.

---

## 🤖 Agent roster (`.claude/agents/`)

- Pre-existing: `explorer`, `code-finder`, `supabase-helper`, `rtl-auditor`, `ramkol`
- Added 2026-05-27: `tranzila-specialist`, `i18n-translator`, `whatsapp-responder`, `seo-auditor`, `a11y-auditor`, `legal-content-checker`, `security-auditor`
- Added 2026-05-28: `mockup-qa`, `pre-deploy-orchestrator`, `order-helper`, `bloom-curator`, `canva-pipeline`, `sticker-print-helper`
- Added 2026-05-29: `content-writer` — owns brand voice; writes he/en/ru; accurate well-established facts only (never invents). BLOOM breed content + future blog/articles.
