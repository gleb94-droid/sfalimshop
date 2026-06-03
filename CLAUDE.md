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
- Status: **PRE-LAUNCH.** `MAINTENANCE_MODE = true` in App.jsx until the Tranzila payment integration is live.

---

## 📌 STATE AS OF 2026-06-03 (production deploy behind maintenance gate; pre-public-launch polish — read this first)

> Supersedes every block below where they conflict. **Code is now LIVE ON
> PRODUCTION (Vercel) but the site STAYS in maintenance** — all 3 launch flags
> are still ON. Public sees the maintenance page; staff see the full live site.

### 🚀 Production state
- **`main` has been merged + deployed to production** (latest merge, post the
  about/dots/shipping/pay-return work) and is **live on Vercel behind the
  maintenance gate.** All 3 launch flags still ON: **`MAINTENANCE_MODE=true`**,
  **`index.html` noindex ×3**, **`api/og.js` MAINTENANCE=true**. Public sees the
  maintenance page; **staff** (`?staff=1` + `VITE_STAFF_PASSWORD`) see the full
  live site.
- ⚠️ **`launch-prep` has commits NOT yet merged to `main`** — see *Pending merge*
  below.

### ✅ Done this session (verified live on production where noted)
- **PAYMENTS verified end-to-end on production:** real **₪36 test orders
  succeeded** (e.g. tx `376598`, `376992`); webhook **query-back enforced**;
  orders marked paid; thank-you page renders.
- **Post-payment 405 fixed:** added **`api/pay-return.js`** (Vercel serverless,
  accepts GET+POST, **302-redirects** to the SPA hash route) so Tranzila's POST
  return no longer hits a 405. `create-payment` success/fail URLs repointed to
  `/api/pay-return`. **Deployed as `create-payment` v10.**
- **Tranzila ת.ז.-field + right-stuck page fixed:** ROOT CAUSE was the **`myid`**
  param (maps to the ID field on Tranzila's hosted page). **Removed `myid`** from
  `create-payment` (the order group is carried by **`u71`** only, which the
  webhook reads). **Deployed as `create-payment` v11.** Verified live: ID field
  empty + page centered.
  - ⚠️ **REPO SYNC TODO (next code session, not now):** `create-payment` v10/v11
    were deployed **directly to Supabase**. The repo
    `supabase/functions/create-payment/index.ts` already has the pay-return URL
    change but **must also REMOVE the `myid` line** so the repo matches the
    deployed v11.
- **Google Places address autocomplete:** working on production. The 403 was the
  API key being restricted to the **old "Places API"** instead of **"Places API
  (New)"** — fixed in Google Cloud Console (key also allows the live domain).
  Manual-typing fallback intact.
- **Shipping → single flat ₪35** everywhere (cart / checkout / FAQ / policies,
  he/en/ru). Committed on `launch-prep`, **merged to `main` + deployed.**
- **About page enriched** (hero "Where animal love meets art", first-person
  story, "Why us" 4-benefit block, CTA → BLOOM collection), trilingual, + polish
  (alternating section backgrounds, story→why-us divider, consistent card
  radius/padding). **Carousel pagination dots → single centered line.** **"How it
  works" → 5 steps** incl. the **design-approval step (scoped to custom /
  personalized orders only**, with a clarifying note). All on `launch-prep`.

### ⏳ Pending merge to `main` (still only on `launch-prep`, NOT yet in production)
The **enriched About page**, the **single-line carousel dots**, and the **5-step
"how it works"**. When ready to go public: **merge `launch-prep` → `main`** to
bring these live, then flip the launch flags.

### 🧷 Owner-side / non-blocking (before public launch, owner's choice)
- **Interspace/Tranzila RECEIPT (קבלה, exempt-dealer, 0% VAT) auto-emailed to the
  customer + logo on receipt.** Owner configured the document settings in the
  Tranzila panel (auto-send + logo `Invoice_logo_fxpsfalimshop.png` + sender
  `hello@sfalimshop.com`) and is sending Interspace the activation answers (doc
  type=receipt, numbering starts ~1001 pending accountant, no retro, auto-email
  on). Interspace said ~1 day to activate. **Receipt did NOT arrive on the test
  order yet — pending their activation.** Accountant wants a monthly receipts
  report (owner pulls it from Tranzila directly).
- **Shipping carrier decision (owner researching):** owner does **NOT** want
  Israel Post, does **NOT** want lockers — wants **private door-to-door**. Top
  private options found: **GetPackage** (no minimum/contract, door-to-door
  nationwide, from ₪65 or a special ~₪30 tier to confirm), **ZigZag**
  (small-customer no-monthly-minimum, nationwide incl. Eilat), **Deal Delivery**
  (from ₪49), **UPS/SHIP** (door-to-door if self-deposit at the Be'er Sheva
  branch; do **NOT** order the ₪118 pickup). Reality: true private door-to-door at
  low volume is ~₪49–65, so **the flat ₪35 may not cover door-to-door** — owner to
  confirm a real price with a carrier and decide pricing. **No code change made.**

### 🔔 Launch gates (unchanged, still all ON)
- `MAINTENANCE_MODE` (App.jsx, find by name) `true` → **`false`**
- `index.html` noindex ×3 → **`index, follow`**
- `api/og.js` MAINTENANCE → **`false`**
- Keep: `PAYMENTS_ENABLED=true`, `SHIPPING_PRICE=35`, `STONEWASH_ENABLED=false`,
  `MUG_STUDIO_ENABLED=false`.

---

## 📌 STATE AS OF 2026-06-02 (final pre-launch fixes — launch-ready — historical, superseded by the 2026-06-03 block above)

> Superseded by the 2026-06-03 block above. Kept for the deep-audit / a11y detail
> it documents. **`launch-prep` was tagged technically LAUNCH-READY** here (HEAD
> `1bb03ef`), all behind the maintenance gate.

### 🔍 Deep re-audit + final fix wave (commit `1bb03ef`)
- **Deep full-site re-audit** (he/en/ru, desktop + mobile) surfaced **one real blocker** that earlier URL-based audits missed: the **mobile nav hamburger rendered off-screen** (right-cluster overflow), so phone users couldn't open the menu. **FIXED** by removing the **duplicated inline language switcher** from the mobile nav cluster (it stays inside the dropdown). **Desktop nav unchanged.**
- **Owner card-display changes:** carousel/character card **name centered**; the **dog/cat species label removed from all user-facing CARDS** (carousel, gallery `PetCard`, `PetModal`, breed-page eyebrow). The gallery **filter (All/Dogs/Cats) is intentionally kept and still works** — the `species` data field is intact (the filter needs it); the species is only **hidden from card display**.
- **Accessibility refinements:** home hero product cards keyboard-operable (`role="button"`/`tabIndex`/Enter-Space); the **"Leave order?" modal** got `role="dialog"` + `aria-modal` + `aria-labelledby` + focus-move (`useDialogFocus`), Esc kept; the **Policies section is now a real tablist** (`role=tablist/tab/tabpanel` + `aria-selected` + roving `tabindex` + RTL arrow-key nav); two failing small-text contrasts fixed (footer copyright + inactive policy tab → `#a0a0a0`, **≥6.6:1**).
- **Debunked three stale false-positives:** SEO images **exist** on disk (`og-image.png`/`logo.jpg`/favicons/manifest); the iOS **16px input rule is global**; single prices **render correctly in RTL** (₪ left of digits — measured). All prior fix waves held; **build clean; 0 console errors.**

### 🚦 Verdict — LAUNCH-READY
Only remaining step to go live is the **launch flip**: merge `launch-prep` → `main` + flip **`MAINTENANCE_MODE`→false**, **`index.html` noindex → index,follow**, **`api/og.js` MAINTENANCE → false**. (`PAYMENTS_ENABLED` stays `true`; shipping already **30/20/35**; **Stone-wash stays hidden** until a real photo.)

**Owner-side, non-blocking:** real Stone-wash photo; Interspace **ת.ז.** field optional on the terminal; **post-launch security** — rotate the edge-fn fallback secrets (**MJ-1**) + Vercel rate-limiting (**MJ-2**); **lawyer** policy review when revenue justifies.

---

## 📌 STATE AS OF 2026-06-02 (pre-launch audit complete — historical, superseded by the launch-ready block above)

> Superseded by the "final pre-launch fixes — launch-ready" block above. Kept for
> the a11y / SEO / UX-QA / legal detail it documents. **All technical pre-launch
> work is now DONE on `launch-prep`**, all behind the maintenance gate. Production
> (`main`) is unchanged.

### ✅ PRE-LAUNCH AUDIT — COMPLETE

**Accessibility (WCAG 2.1 AA remediation — commit `452912f`).** Keyboard-operable product cards, color pickers and the address listbox; `main`/`header` landmarks; skip link; SPA focus-on-route-change + an `aria-live` route announcer; checkout form labels; AA contrast (white text on `#C0501A` buttons = **4.77:1**; footer `#808080`); correct heading order. Optional residuals **deferred** (decorative carousel touch-targets; secondary lang-switcher group label) — not required for 2.1 AA.

**SEO (Option B — no routing migration).** Real crawlable paths for breeds (`/breed/<slug>`) and blog (`/blog/<slug>`) via the `api/og.js` crawler-HTML + 302-human pattern; **sitemap rebuilt to 80 real URLs** (no hash fragments); `index.html` Product `ItemList` refreshed to current catalog/prices; per-view trilingual meta; real-path canonicals; per-language `og:locale`; breed Product JSON-LD now carries an **`AggregateOffer` (₪59–₪119)**. A full `vite-ssg` + path-routing migration is **explicitly DEFERRED** as a separate post-launch project (hash routing remains today).

**UX/QA fixes (commit `741cd0d`).** Stone-wash hidden behind `STONEWASH_ENABLED=false` (re-enable = flip to `true` **and** restore its Product row in the `index.html` ItemList) until a real photo exists; all customer-facing `alert()` replaced with styled **trilingual** error banners/toasts (no raw `e.message`, esp. payment); **iOS 16px inputs** (no zoom); trilingual **load-error + retry** states on customer data fetches; checkout **inline validation** (entered values kept); **RTL price-range** ordering; trilingual **404 page**; mobile cookie banner pinned to bottom; product-name consistency. **three.js/MugStudio left as-is** (separate lazy chunk, zero main-bundle weight, intentionally kept).

**Legal text strengthened (commit `7c343cb`).** Privacy **"storage & processing abroad"** disclosure (Supabase/Vercel/Tranzila, Amendment 13) + a voluntary-data line; Terms now state **exempt-dealer / no-VAT / receipt (not tax invoice)**; Refunds **extended-cancellation clause for protected groups** (sections renumbered 1–7); footer label fixed to **"עוסק פטור מס׳ 321630279"** (was "ח.פ."); policy **"last updated"** dates. ⚠️ Self-prepared good-faith drafts — **lawyer review still advised later** (cross-border basis; custom-vs-stock cancellation classification).

**Final full-site audit fix wave (commit `e92514e`).** **Restored shipping to 30/20/35** (it had been TEMP-set to `0` — a real blocker, now fixed); cookie banner no longer overlaps the breed **Add-to-cart** CTA (+ focus / Esc / privacy link); phone field marked required; breed Product offers; real-path blog/FAQ canonicals; per-lang `og:locale`; a11y (notes label, **trilingual color-swatch names**, shipping group, cookie focus); **RTL** mobile design arrows & CartToast slide direction; removed stale `supabase.js`; minor polish batch. **Two audit "blockers" were verified externally as already fine and NOT changed:** the webhook query-back verification is implemented/enforced, and all 4 emailing edge functions are deployed & ACTIVE on prod.

### 🔍 External verifications (confirmed via Supabase, not just code)
- **All 10 edge functions ACTIVE on prod**, incl. `send-order-confirmation` **v9**, `send-admin-order-alert` **v7**, `send-status-update` **v7**, `notify-design-submission` **v1**.
- **`tranzila-webhook` v12** is `VERIFY_MODE="enforce"` with a real query-back to `report.tranzila.com` (**Layer-1 strong**; the in-code "TODO" is a stale comment only).

### 🧭 Decisions
- **MJ-1** (rotate hardcoded edge-fn fallback secrets) + **MJ-2** (Vercel WAF rate-limiting on payment endpoints): **DEFERRED to post-launch / part of the launch process.** Critical security is already strong (query-back webhook, RLS, no service-role key client-side, security headers). Waitlist secrets are effectively moot — no real signups.
- **Waitlist launch-announce email:** not relevant (no real signups; only the owner's own test row).
- **Stone-wash** stays hidden until a real product photo is shot.
- The **ת.ז.-based exempt-dealer number is displayed** (required for distance selling); owner may confirm comfort level with a lawyer.

### 🔔 Launch gates (current → at launch)
| Gate | Location | Current | At launch |
|---|---|---|---|
| `MAINTENANCE_MODE` | App.jsx:1509 | `true` | → **`false`** |
| index.html noindex | index.html:49-51 | `noindex,nofollow` | → **`index,follow`** |
| `api/og.js` MAINTENANCE | api/og.js (~26) | `true` | → **`false`** |
| `PAYMENTS_ENABLED` | App.jsx:1561 | `true` | **stays `true`** |
| shipping constants | App.jsx | **30/20/35 ✓** | unchanged |
| `STONEWASH_ENABLED` | App.jsx | `false` | keep `false` |
| `MUG_STUDIO_ENABLED` | App.jsx | `false` | keep `false` |
| `VITE_STAFF_PASSWORD` gate | Vercel env | set | optional remove |
| `WHATSAPP_NUMBER` | App.jsx:141 | live ✓ | unchanged |

### 🧷 Still open (owner side — NOT blocking the code)
- Real **Stone-wash photo**.
- **Interspace:** make the **ת.ז. field optional** on the Tranzila terminal (was causing `026` declines).
- **Accountant:** confirm turnover + receipt settings + refund the 3 test charges (`374782` / `374798` / `374836`).
- **Lawyer:** policy review when revenue justifies.
- **Post-launch backlog (researched, parked):** n8n/Make automation, WhatsApp auto-notify, GEO, email marketing.

---

## 📌 STATE AS OF 2026-06-02 (historical — payments, pet-name, shirts; superseded by the audit-complete block above)

> Superseded by the audit-complete 2026-06-02 block above. Supersedes the
> 2026-06-01 block and older snapshots where they conflict. The work below was
> committed on **`launch-prep`** (commits `bbe3440`, `62d16df`, `93f1d53`,
> `400e610`) — kept for the payment/personalization/shirt detail it documents.

### 💳 Payments — now fully live & secured (behind maintenance for staff testing)
- **`tranzila-webhook` is at v12** (`verify_jwt=false`, `VERIFY_MODE="enforce"`). Reads `order_group` from **`u71`** (Tranzila overwrites `myid` with the merchant id). **Query-back** to `report.tranzila.com/v1/transaction` with `transaction_index` sent as an **INTEGER** (a string is rejected — `error_code 20004`); verifies `processor_response_code`, amount (**agorot/100**), currency, and `child_terminal`. **Layer 2** = amount match. An **unverified** success → order held as `payment_status='processing'` (safe; never wrongly marked paid).
- **ALL order emails fire only AFTER confirmed payment, from the webhook:** customer confirmation (`send-order-confirmation`) + business alert (`send-admin-order-alert`). **No emails are sent before payment** anymore — the frontend pre-payment email calls were removed.
- **Frontend post-payment return fixes** (commit `bbe3440`): decode `&amp;`→`&` in the URL hash (central `rawHash()` helper) so `paid=1` is detected; **strict success gate** (`payment_status==='succeeded'` only); **clear cart on confirmed success only**; clear thank-you screen.

### 🆕 New edge function
- **`notify-design-submission` (v1, `verify_jwt=false`):** emails the admin when a **custom design is submitted for approval** — a **pre-payment WORKFLOW alert**, only for orders with `requires_design_approval=true`. Called **fire-and-forget** from the custom-design submission path (commit `62d16df`). (Distinct from order emails, which remain post-payment only.)

### 🐾 Pet-name personalization (commit `93f1d53`)
- **Product card (mug + shirt only):** optional pet-name input; a **font picker** (Heebo, Assistant, Secular One, Suez One, Rubik) + **7 fixed color swatches** appear only **after a name is typed** (progressive disclosure); **live preview** under the design (light-orange card, RTL/LTR aware). The **+₪20 `PET_NAME_SURCHARGE`** applies **only when a name is entered**. Admin order view shows an **`AdminPetNameBlock`** (name rendered in the chosen font + font name + color swatch/hex).
- **New `orders` columns:** `pet_name_font`, `pet_name_color` (text). `pet_name` already existed.

### 👕 Shirt products (commit `400e610`)
- Shirt/mug products are defined **in code** (the `PRODUCTS` array in `App.jsx`), **not the DB**. Per-size pricing: S/M/L base, XL/XXL **+₪10**, except where set flat.
- **NEW product "Oversize Stone-wash"** (`חולצת אוברסייז סטון ווש`) @ **₪119 flat** — mirrors Oversize exactly (reuses the oversize mockup image **for now** — to be replaced).
- **Oversize price → ₪119 flat** (removed its per-size surcharge). **Removed all "240g heavy cotton" wording.**
- **Fabric facts:** Tee Basic / Oversize / Stone-wash = **100% combed cotton**; **Dri-FIT = breathable technical polyester (NOT cotton)**; mugs = **ceramic**. New FAQ **"what fabric"** entry added + the **old material FAQ aligned** to this.

### 🧹 DB data cleanup
- **Dogs Sticker Pack price restored ₪1 → ₪35** (both packs now ₪35).

### 🧷 Still pending (Gleb's side / future)
- **Refund 3 test charges** in the Tranzila admin: `374782`, `374798`, `374836` (₪3).
- **Interspace:** make the **ת.ז. (ID) field optional/disabled** on the terminal (caused `026` declines).
- **Accountant:** confirm the Tranzila **receipt settings** (exempt-dealer "קבלה", 0% VAT).
- **Replace the Stone-wash product image** (currently reuses the oversize mockup).
- **After-launch backlog:** WhatsApp auto-notify (Business API/provider vs Telegram), personal area / save customer details, on-product designer (ZAKEKE) once orders are flowing.

### 🔔 Launch arming (unchanged, when ready)
- Merge `launch-prep` → `main`; flip **`MAINTENANCE_MODE=false`** + **`index.html` noindex off** + **`api/og.js` MAINTENANCE off**; **`PAYMENTS_ENABLED` stays `true`**; set up the design-decision **DB webhook** + `DESIGN_NOTIFY_ENABLED`; arm `waitlist-launch-announce`.

---

## 📌 STATE AS OF 2026-06-01 (historical — superseded by the 2026-06-02 block above)

> Superseded by the 2026-06-02 block. Supersedes the 2026-05-31 block and all
> older snapshots where they conflict.
> Records the live production state + everything shipped since.

### 🚀 Production / deploy
- **`main` HEAD = `e26bc92`** (merge of `launch-prep`), **live on Vercel behind the maintenance gate** (deploy `dpl_5oz1gLwYndNKgnUUesVbCQfzc89o`, READY). Rollback candidate = the prior prod merge **`592f67d`** (quiz a11y widget). Flags unchanged: `MAINTENANCE_MODE=true`, `PAYMENTS_ENABLED=false`, `index.html` noindex ON, staff password gate (`VITE_STAFF_PASSWORD`).
- **`launch-prep` is 1 commit ahead of `main`: `4d98049`** (WhatsApp FAB + trust strip) — committed, **NOT yet deployed**; ships in the next deploy.
- This session merged to prod, in order: **`b19c4b1`** (a11y pass + payment-return UX + repo↔prod sync), **`8880fd1`** (high-contrast toggle fix), **`e3b9588`** (portal overlays fix), **`592f67d`** (quiz a11y widget), **`e26bc92`** (favorites). All behind maintenance.

### 🆕 Frontend work shipped since 2026-05-31
1. **Accessibility pass (IS 5568 / WCAG 2.1 AA)** — commit `29a399f` (in merge `b19c4b1`): keyboard operability for the 70 gallery cards + nav logos; dialog focus-trap/ARIA on overlays via a shared `useDialogFocus` hook; form-label associations; `role="alert"` / `aria-live` announcements; contrast bumps (`#555`/`#666` → `#8a8a8a`); hamburger `aria-expanded`; quiz a11y (progressbar role, `type="button"`, focus-to-result, `#qcount dir="rtl"`). **Decision:** `#888` and white-on-`#FF6B35` left as-is — they pass AA in the contexts used; preserves the brand.
2. **Quiz accessibility widget** — commit `5f2cac6` (merge `592f67d`): self-contained vanilla widget on `public/quiz/index.html` (font-size, high-contrast, link to `/accessibility`, focus-trap, Esc, localStorage). Filter scoped to `#a11y-content`; the button sits **outside** that wrapper so it stays viewport-fixed.
3. **High-contrast containing-block fix** — commits `39729dd` (merge `8880fd1`) + `982c445` (merge `e3b9588`): moved the high-contrast `filter` from `<body>` to `#root`, and **portaled to `document.body`** the a11y widget + the **5 fixed overlays** (zoom lightbox, PetModal, CartDrawer, both PaySoon modals). **Lesson (record):** a CSS `filter` (also `transform`/`perspective`) makes its element the **containing block for `position:fixed` descendants** — so a filtered ancestor reanchors fixed children. Fix = keep fixed UI outside the filtered element (portal to `<body>`).
4. **Payment-return route handlers** — commit `9093d84` (merge `b19c4b1`): `#track?paid=1&order_group=…` shows a success/processing/unknown screen by **reading** `payment_status` (never writing it — the webhook owns it); `#order?paid=0` shows a failure-with-retry overlay. UI-only; inert while `PAYMENTS_ENABLED=false`; safe if visited directly.
5. **Admin fetch error handling** — commit `9093d84`: `try/catch` + a `role="alert"` error banner + Reload on `fetchOrders`/`fetchPetDesigns`/`fetchStickerPacks` (no more silent blank/empty admin on a network failure).
6. **Cancelled-order timeline fix** — commit `9093d84`: `#track` no longer renders the misleading `ORDER_STAGES` timeline for a cancelled order; shows the cancelled state instead.
7. **Favorites feature (client-only, no DB/auth)** — commit `596a888` (merge `e26bc92`): `localStorage` key `sf_favorites` + `useFavorites()` hook (window-event synced across components/tabs), `FavHeart` on PetCard / PetModal / BreedPage, a "show favorites only" gallery toggle (nav deep-link `#/pets?fav=1`), and a live favorites count badge in the nav.
8. **WhatsApp FAB + trust strip** — commit `4d98049` (**on `launch-prep`, NOT yet deployed**): floating WhatsApp `<a>` portaled to `<body>` (bottom inline-end, z-940 — below cart/modals, opposite the a11y FAB), gated by a `WHATSAPP_NUMBER` constant — still `WHATSAPP_PLACEHOLDER`, so the **button is HIDDEN until a real number is set**; renders only on the full app, not the maintenance screen. Trust strip in the CartDrawer footer: 🚚 "Ships anywhere in Israel" **always**; 🔒 "Secure payment" **only when `PAYMENTS_ENABLED===true`**.

### 🔒 Backend (live on prod + mirrored to repo)
- **Migration `restrict_customer_order_status_to_cancel`** — commit `cac9cef` (merge `b19c4b1`), file `supabase/migrations/20260531140000_*`. Extends `protect_order_payment_fields` so a non-privileged customer may only set `orders.status='cancelled'`; any other status change reverts to `OLD`. Admins / `service_role` unaffected. (Mirror-only — already applied on prod via MCP; not re-run.)
- **Edge functions UNCHANGED this round:** `create-payment` v4, `tranzila-webhook` v2, `notify-design-decision` v1 (disabled), `generate-sitemap`, `waitlist-welcome` (enabled), `waitlist-launch-announce` (disabled). See the 2026-05-31 block for details.

### 🧷 Open items / reminders
- **`WHATSAPP_NUMBER` is a placeholder** (`App.jsx`, near the favorites module). Owner is getting a dedicated **WhatsApp Business** number → replace the one constant when provided; the FAB auto-appears (6–15 digit check). Carried live in the next deploy.
- **Two MAINTENANCE flags at launch:** `App.jsx MAINTENANCE_MODE` **and** `api/og.js`'s own `MAINTENANCE` flag must BOTH be flipped, alongside reverting the `index.html` noindex.
- **Next planned quick win:** an FAQ section (content TBD with owner).
- **Phase-2 backlog (from the Cowork proposal — NOT started):** "Breed Almanac" / "Meet the Cast" homepage; quiz-as-front-door; gentle/floating character motion (owner wants examples first); **live pet-name personalization preview** (recommended "wow"); Israeli trust polish; paid on-product **3D customizer** (Zakeke best fit / PitchPrint budget option — phase-2, **post-revenue only**).
- **Launch-arming sequence unchanged:** waiting on the **Tranzila supplier number** (supplier docs submitted 2026-05-31). See `PAYMENTS-LAUNCH-CHECKLIST.md`.

---

## 📌 STATE AS OF 2026-05-31 (historical — superseded by the 2026-06-01 block above)

> ⚠️ **Historical.** Production has since advanced (`e3a31b4` → `e26bc92`) and more
> work shipped — see the 2026-06-01 block above for the current source of truth.
> Kept for the security/workflow/SEO/edge-function detail it still documents.

> This block supersedes older snapshots below where they conflict. It records the
> live production state, all security/workflow/SEO work shipped, edge-function
> versions, and the remaining launch-arming steps.

### 🚀 Production / deploy
- **`main` HEAD = `e3a31b4`** (merge of `launch-prep`), **live on Vercel behind the maintenance gate.** Rollback candidate = **`174f312`** (prior production merge).
- `MAINTENANCE_MODE = true` (`App.jsx:1314`), `PAYMENTS_ENABLED = false` (`App.jsx:1342`), **`index.html` noindex ON** (lines 49–51), **staff password gate** reads `VITE_STAFF_PASSWORD` (set in Vercel **Production + Preview**; build-time var → redeploy to change; unset = gate stays closed). Public sees the maintenance page + waitlist signup.

### 🔒 Security — all LIVE on prod (repo mirrors them)
1. **DB trigger `trg_protect_order_payment_fields` / fn `protect_order_payment_fields()`** (migrations `20260531120000_*` then `20260531130000_*`, the latter's body wins). Non-privileged (customer) callers **cannot** change `payment_status`, `amount_paid`, `paid_at`, `total`, `tranzila_transaction_id`, `payment_method`, `currency`, `failed_reason`; **cannot self-approve designs** (only `rejected→pending` allowed); on INSERT cannot pre-mark paid or approved. `service_role` / `postgres` / `supabase_admin` / `supabase_auth_admin` + `is_admin()` are exempt.
2. **`create-payment` v4:** charge amount is **always recomputed server-side** from `SUM(orders.total)`; the client amount is ignored (audit-logged with a mismatch flag). **Blocks payment until the design is approved** (`403 design_not_approved`). `SITE_URL` fallback = `https://www.sfalimshop.com`.
3. **`tranzila-webhook` v2:** **Layer-2 amount verification** — Tranzila's reported `sum` must equal the `order_group` total (±0.01), else the order is held as `payment_status='processing'`, a `payment_amount_mismatch` event is logged, the webhook returns `409`, and **no confirmation email is sent**. **Layer-1 signature verification (`TRANZILA_WEBHOOK_SECRET`) = TODO at the Tranzila sandbox.**

### 🎨 Custom-design approval workflow (LIVE)
- `orders` columns: `requires_design_approval` (bool), `design_approval_status` (`not_required`|`pending`|`approved`|`rejected`), `design_review_note`, `design_reviewed_at`.
- **Applies ONLY to custom image-upload orders.** BLOOM gallery items + pet-name personalization **pay immediately** (unchanged).
- **UI (`App.jsx`):** checkout for a custom upload creates the order(s) as `pending` with **no payment** → trilingual "submitted for approval" screen. `#track` shows: **pending** (review badge, no pay), **approved** (prominent **Pay now ₪X**), **rejected** (review note + **Edit & resubmit** [optional re-upload → `rejected→pending`] + **Cancel order**). Admin has a **"Pending design approval" queue** with **Approve** / **Request changes** (note prompt → `rejected` + note + `design_reviewed_at`).
- **Email:** `notify-design-decision` v1 (`verify_jwt=false`), trilingual approved/rejected, secret-gated (`x-webhook-secret`), **DISABLED by default** (`DESIGN_NOTIFY_ENABLED`). Dry-run verified (200 `dryRun` + 401 on wrong secret).

### 📝 Content
- **Blog: 4 trilingual PUBLISHED posts** (content lives in the DB `blog_posts`, NOT the repo): `top-10-dog-breeds-israel-2026`, `israeli-cat-types-guide`, `gifts-for-pet-lovers-guide`, `custom-pet-photo-gift-guide`. Covers = BLOOM mockups. **Meets the ~3–5-post unlock threshold** (blog stays gated behind maintenance until launch).
- **`testimonials` table exists but is EMPTY** → the `Reviews` section stays **hidden** until real post-launch reviews are added.

### 🔎 SEO
- Full per-page SEO (title / description / OG / Twitter card / **Product** (breed) & **Article** (blog) JSON-LD / canonical / hreflang he-en-ru-x-default) set dynamically on route change via the existing `setMeta` / `injectJsonLd` mechanism, for **breed pages + blog posts**. Generic site SEO is restored on all other routes.
- **`generate-sitemap`** edge function covers **all 70 breed pages + published blog posts + core routes**. `noindex` stays until launch.
- **`https://www.sfalimshop.com` unified everywhere** (canonical/hreflang/OG/sitemap/links; bare-host grep = 0).
- **Known limitation:** hash-router SPA → non-JS crawlers don't see client-set tags on first hit. `/p/<handle>` via `api/og.js` is the SSR share path for BLOOM characters; full crawler SEO for breed/blog pages would need prerender/SSR (future, moot while `noindex` is on).

### ⚙️ Edge function versions LIVE on prod
| Function | Version / state |
|---|---|
| `create-payment` | **v4** — server-side amount + design-approval gate |
| `tranzila-webhook` | **v2** — Layer-2 amount verify (Layer-1 signature TODO) |
| `notify-design-decision` | **v1** — DISABLED by default (dry-run) |
| `generate-sitemap` | extended with all 70 breeds + posts |
| `waitlist-welcome` | ENABLED (welcome email on signup) |
| `waitlist-launch-announce` | DISABLED (triple-gated launch blast) |
| `send-order-confirmation` / `send-status-update` / `send-admin-order-alert` | live (transactional) |

### 🔔 LAUNCH-ARMING CHECKLIST (waiting on Tranzila — supplier docs submitted 2026-05-31)
1. Set `TRANZILA_SUPPLIER` + `SITE_URL` (`=https://www.sfalimshop.com`) in Supabase secrets (also `TRANZILA_TK`).
2. **Sandbox:** run a full end-to-end test payment; **implement Layer-1 webhook signature verification** using Tranzila's real mechanism.
3. Create the **DB webhook on `orders` UPDATE → `notify-design-decision`** with header `x-webhook-secret`; set a real `DESIGN_NOTIFY_WEBHOOK_SECRET` (rotate the in-code fallback); set `DESIGN_NOTIFY_ENABLED="true"`.
4. Flip **`MAINTENANCE_MODE=false` + `PAYMENTS_ENABLED=true`**; **remove the `index.html` noindex** (revert robots/googlebot/bingbot to `index, follow`).
5. **Arm + send `waitlist-launch-announce`** (triple-gate: secret + `ENABLED="true"` + `{"confirm":"SEND"}`; dry-run first).
6. Add **real testimonials** as they arrive (un-hides the Reviews section).

### 🧹 Open / low priority
- Move `WAITLIST_WEBHOOK_SECRET` + `DESIGN_NOTIFY_WEBHOOK_SECRET` to real Edge Function secrets + rotate (currently in-code fallbacks).
- Prerender/SSR for breed-page crawler SEO (future; moot under `noindex`).

### 🌿 Branch state
- **`main` = production (`e3a31b4`).** `launch-prep` is ahead by `2d3b7ab` (the `tranzila-webhook` v2 repo mirror) plus this docs commit; both are docs/repo-mirror only (no code diff vs prod behaviour). `launch-prep` will be reconciled into `main` at the next deploy/launch.

---

## 🛠️ Tech stack

- **React 18 + Vite 4.5** (esbuild 0.18 — **template literals only, no `+` string concat**)
- **Supabase** (DB + Auth + Storage + Edge Functions), project ref `ubvgrxlxtelulwjtfudd`, **Pro tier** (daily backups, no pausing)
- **Vercel hosting**, **Pro tier** (WAF available)
- **GitHub:** `gleb94-droid/sfalimshop` (private)

Local working dir on owner's machine: `C:/Users/Gleb/Documents/GitHub/sfalimshop`

---

## 📁 Repo structure

```
sfalimshop/
├── App.jsx                        # THE ENTIRE APP (~9350 lines). At repo ROOT, NOT in src/.
├── public/
│   └── quiz/index.html            # Standalone BLOOM personality quiz, vanilla JS
├── api/                           # Vercel serverless functions
│   ├── og.js                      # OG meta image generation
│   └── p/[handle].js              # /p/<slug> share URL handler
├── supabase/functions/            # Edge Functions
│   ├── send-order-confirmation/   # order email (Resend)
│   ├── send-status-update/        # order status email
│   ├── send-admin-order-alert/    # admin new-order alert
│   ├── waitlist-welcome/          # LIVE — welcome email on new waitlist signup
│   ├── waitlist-launch-announce/  # launch-day "we're live" blast — triple-gated, DISABLED by default
│   ├── create-payment/            # Tranzila + server-side amount + design-approval gate (gated off)
│   ├── tranzila-webhook/          # Tranzila webhook (v2) — Layer-2 amount verify LIVE; Layer-1 signature TODO
│   └── notify-design-decision/    # custom-design approve/changes email — DISABLED by default (dry-run)
├── vercel.json                    # Routes + CSP + security headers
├── PAYMENTS-LAUNCH-CHECKLIST.md   # Tranzila go-live checklist (both payment-integrity holes now FIXED)
├── .claude/agents/                # Subagent library (TRACKED in git as of 2026-05-28)
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
8. **Don't touch payment/Tranzila code** until the supplier number arrives. **Never weaken RLS** (`is_admin()`). **Secrets live in env / Supabase secrets only.**
9. **Gleb does not code** — report in plain Hebrew, and **stop for approval before every commit / delete / deploy.**

---

## 🗄️ Database schema (Supabase: `ubvgrxlxtelulwjtfudd`)

### Tables

| Table | Rows | Notes |
|---|---|---|
| `pet_designs` | **70 (all active: 47 dogs + 23 cats)** | 39 columns. Core catalog. The 12 obsolete demo/legacy drafts were **DELETED 2026-05-30** — there are now 0 inactive rows. |
| `orders` | varies | RLS enabled. Custom-design approval columns: `requires_design_approval` (bool), `design_approval_status` (`not_required`/`pending`/`approved`/`rejected`), `design_review_note`, `design_reviewed_at`. The `trg_protect_order_payment_fields` trigger freezes payment fields AND enforces approval transitions (customer may only go `rejected→pending`; only shop approves/rejects). |
| `order_status_history` | audit log | RLS enabled |
| `payment_events` | webhook audit log | RLS enabled |
| `admins` | 1 (`gleb2009@gmail.com`) | Self-select RLS only |
| `sticker_packs` | 2 | BLOOM sticker bundles |
| `waitlist` | grows (pre-launch signups) | RLS enabled. `email`, `lang`, `source`, `consent`, `launch_notified_at`. **INSERT fires the `waitlist-welcome` email** via a DB webhook (pg_net trigger → edge function). See Edge Functions below. |

### `pet_designs` key columns

- `slug` (e.g., `01_golden_retriever`, `48_tuxedo`)
- `name_he` / `name_en` / `name_ru`
- `animal_he` / `animal_en` / `animal_ru`
- `tagline_he` / `tagline_en` / `tagline_ru`
- `mockup_url` — BLOOM portrait (populated for all 70 rows)
- `mockup_mug_url` — sofa-style mug photo (populated for 70 active rows)
- `mockup_shirt_url` — legacy single shirt mockup (**NULL for all 70** — superseded by the per-color columns below)
- `mockup_shirt_white_url` / `mockup_shirt_black_url` — per-color shirt mockups; **populated for all 70**. PetModal is color-aware (white/black) and falls back to the portrait only if a URL is ever missing.
- `design_url` — raw transparent design
- `mockup_bg` — fallback background color
- `price_shirt`, `price_shirt_basic`, `price_shirt_oversized`, `price_mug`, `price_sticker`, `price_sticker_pack`
- `is_active`, `is_bestseller`, `is_new`, `sort_order`
- `species` (`dog` / `cat`) — always set now (the only NULL-species rows were the 12 legacy drafts, deleted 2026-05-30)
- `breed_he` / `breed_en` / `breed_ru`, `breed_aliases`
- `breed_origin_he` / `breed_origin_en` / `breed_origin_ru` (text) — breed origin/background, ~1 sentence. **Populated for all 70 active (all 3 langs).**
- `breed_facts_he` / `breed_facts_en` / `breed_facts_ru` (text) — fun facts, **newline-separated** (3 per breed), rendered as a bulleted list. **Populated for all 70 active (all 3 langs).**
  - Breed content written by the `content-writer` agent (accurate, well-established facts only — never invented).

### Storage buckets (all public)

- **`mockups/`**
  - `bloom/<slug>-clean.webp` — 1414×2000 BLOOM portrait (70 active files)
  - `bloom/<slug>-mug.webp` — sofa lifestyle mug photo (70 files, ~355 KB avg)
  - `mug.png`, `t shirt basic.png`, `oversize.png`, `dri fit t shirt.png`, `round sticker.png`, `square sticker.png` — generic product templates
- **`pet-designs/`**
  - `bloom/<slug>.webp` — raw transparent design (70 active designs; the 12 legacy rows were removed from the DB 2026-05-30 — any leftover legacy storage files are orphans, cleanup separate)
- **`designs/`**
  - User-uploaded custom designs for orders

### Useful queries

```sql
-- Active characters with mockup URLs (all 70 are active)
SELECT slug, name_he, mockup_url, mockup_mug_url 
FROM pet_designs WHERE is_active=true ORDER BY slug;

-- Inactive rows — now returns 0 (the 12 legacy drafts were deleted 2026-05-30)
SELECT slug, name_he, species 
FROM pet_designs WHERE is_active=false ORDER BY slug;

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
| `PRODUCTS` array | 1757 | mug/shirt/sticker with prices + printArea |
| `MOCKUP_URLS` const | 1855 | Generic product templates |
| `MugMockup` component | 1998 | Wraps `ProductMockupBase` for mug |
| `pet_designs` SELECT | 945 | Fetches catalog columns (incl. the 6 `breed_origin_*` / `breed_facts_*` columns) |
| `handleViewActiveCharacter` | ~1000 | BLOOM card → `/pets/` |
| `FloatingProductCard` | 1101 | Home carousel card |
| `BloomCardLite` | 1091 | Carousel variant |
| `DesignEditor` (admin) | 3494 | Admin `pet_designs` editor |
| `OrderPage` | 3814 | Order/checkout flow |
| `PetsPage` | 7721 | BLOOM gallery |
| `PetModal` | 8571 | Per-character detail modal |
| `handleOrder` | 8661 | Adds BLOOM character to cart |
| `ProductOption` | 9128 | Mug/shirt/sticker buttons |
| `previewProduct` state | ~8581 | Drives mug/shirt preview swap (added 2026-05-28) |

---

## 🐾 Quiz (`public/quiz/index.html`)

- **11 questions**: Q0 = species filter (🐶 / 🐱 / 🐾 both), Q1–Q10 = personality
- **6 personality dimensions**: `en` (energy), `so` (social), `el` (elegance), `bo` (bold), `br` (brains), `wa` (warmth)
- Weighted distance-matching against `PETS` array (70 items)
- Q0 filters the `PETS` pool by `sp: 'dog' | 'cat' | 'any'`
- ~300 lines vanilla JS, dark theme, back-to-shop button, WhatsApp share
- Routed by Vercel: `/quiz` has **RELAXED** CSP (inline scripts allowed); rest of site has **STRICT** CSP

---

## 🚀 Vercel configuration

- `vercel.json` — routes + security headers
- Strict CSP everywhere EXCEPT `/quiz` (negative lookahead in path patterns to avoid CSP intersection)
- HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin
- Domain: `sfalimshop.com` (Vercel-managed)
- Pro tier: **WAF rate limiting available** (use for Tranzila webhook rate limit / order-submit anti-bot)

---

## ✅ Current status (snapshot 2026-05-30)

> ⚠️ **Historical snapshot — see "STATE AS OF 2026-05-31" near the top for the
> current source of truth.** Kept for history; where it conflicts (e.g. it cites
> the old prod merge `174f312` / rollback `4927eb4`, or "the only launch gate is
> the supplier number"), the 2026-05-31 block wins.

### 🚀 SESSION END 2026-05-30 — ALL THIS SESSION'S WORK IS LIVE ON PRODUCTION

- ✅ **Merged `launch-prep` → `main` (merge commit `174f312`, `--no-ff`, history preserved) and deployed to production via Vercel.** Production deployment is **READY** (`dpl_4oryTToeXGG5pP7LTmsYBmLugH4u`, target=production, SHA `174f312…`). Domain `sfalimshop.com`.
- ✅ **Now live on prod (this session's work):** breed pages (`#/breed/<slug>`); pet-name **paid add-on (+₪20)**; quick-look modal **view-nav** + unified breed/modal image nav via shared **`BloomImageCarousel`** (portrait→white tee→black tee→mug, "1/4" counter, zoom/swipe/keyboard, buy-panel sync); hero baked-in-frame handling via shared **`BloomHeroImage`** (no 2nd frame, contain+capped); home **"Our Stars" symmetric arrows**; **testimonials** table + `Reviews` component (hidden until rows exist); **admin waitlist dashboard**; **launch-announce email** (built, DISABLED by default, triple-gated); **staff PASSWORD gate** (reads `VITE_STAFF_PASSWORD`, sets `sf_staff` sessionStorage flag — a bare `?staff=1` only opens the password field, no longer bypasses); bottom **character rail `BloomCharacterRail`** (all 70, rAF auto-scroll, pause on hover/touch, hand-drag + native swipe, lazy-load, seamless loop — note `el.scrollLeft` is integer-quantized so the loop uses a float accumulator).
- ⚠️ **This production deploy = infra / preview-on-prod ONLY. It is NOT the public launch.** `MAINTENANCE_MODE=true` and `PAYMENTS_ENABLED=false` **stay ON** — the public still sees the maintenance page + waitlist signup. Merging to main just ships the code to the prod environment behind the maintenance gate.
- 🔑 **`VITE_STAFF_PASSWORD` is set in Vercel (Production + Preview).** It's a **build-time** Vite var (inlined into the bundle), so **changing it requires a redeploy** to take effect. If unset, the staff gate stays closed (safe default).
- ↩️ **Rollback candidate = prior production commit `4927eb4`** (`dpl_HguZgApkxm5QcvRJVxsun46oqnw7`) if a revert is ever needed.
- 📣 **Instagram teaser launched** (business reel + personal story, early-access / waitlist push) to grow the pre-launch list.
- ⛳ **STILL PENDING for the REAL public launch (in order):** (1) get the **Tranzila supplier number**; (2) ✅ ~~fix the cancel-button security hole~~ **DONE 2026-05-31** (both payment-integrity holes fixed + live on prod — see below); (3) flip **`MAINTENANCE_MODE=false` + `PAYMENTS_ENABLED=true`**; (4) **arm `waitlist-launch-announce`** on launch day (dry-run → enable + `{"confirm":"SEND"}`).
- ℹ️ **Branch state at session end:** `main` is at the merge commit `174f312` (deployed to prod). `launch-prep` is at the same code tree **plus this CLAUDE.md doc commit on top** (so `launch-prep` is 1 commit ahead of `main` — docs only, no code diff). Both pushed to origin. **Next session: keep working on `launch-prep`; `main` is prod.**

- ✅ MAINTENANCE_MODE = true (visitors see maintenance screen) + robots noindex until launch. The **only launch gate is the Tranzila supplier number.**
- ⏳ Tranzila registered, awaiting supplier number
- ✅ **`pet_designs` cleaned to exactly 70** (47 dogs + 23 cats, all active) — the 12 demo/legacy drafts were deleted 2026-05-30. `is_active` filters added in App.jsx (~10339, ~10140) so only active rows ever render.
- ✅ **`waitlist-welcome` email is LIVE** (2026-05-30). New waitlist signups get an automatic BLOOM-branded welcome email (he/en/ru), styled like the order-confirmation mail (black `#0f0f0f` + orange `#FF6B35` + Playfair/Heebo). Wiring: DB webhook (pg_net trigger `waitlist_welcome_on_insert`) on INSERT into `public.waitlist` → POSTs to the edge function. **Armed by default**; kill-switch = set secret `WAITLIST_WELCOME_ENABLED="false"`. **Secret-protected:** the function requires an `x-webhook-secret` header — direct calls without it return 401 and send nothing. Already wired to **Resend** (`RESEND_API_KEY` set, `hello@sfalimshop.com` verified). ⚠️ The webhook secret is currently hard-coded in `waitlist-welcome/index.ts` and in the trigger — TODO: move to a real Edge Function secret + rotate (see Roadmap).
- ✅ **In-house printing — Gleb prints himself, there is NO external print provider.** Pet-name personalization is therefore fully feasible; the pet name MUST show clearly in the admin order view (see Roadmap task 8).
- ✅ **Quiz already exists and already links to products** (`public/quiz/index.html` → product flow). Do NOT rebuild it.
- ✅ 70 BLOOM active in DB (47 dogs + 23 cats)
- ✅ 70 BLOOM portraits + 70 mug mockups in Supabase storage
- ✅ 70 / 70 BLOOM shirt mockups live (Mokey AI, white+black per slug, uploaded + DB URLs set, 140 files).
  - 4 slugs use 2000×1600 landscape mockups (08_great_dane, 14_doberman, 61_bengal, 70_devon_rex); the other 66 are 1600×2000 portrait. Optional future polish: regenerate those 4 as portrait.
- ✅ Sticker print workflow ready (Roland PerfCutContour CMYK FOGRA39), awaiting Dima
- ✅ Security baseline: H1 + M1 + M6 + M7 done; C1/C2/H2/H3 deferred to Tranzila integration
- ✅ Quiz fully refreshed: Q0 species filter, dark theme, back button, WhatsApp share fix, OG image fix
- ✅ BLOOM mug mockup wired into PetModal (preview swap + product-specific cart thumbnail)
- ✅ PetsPage browse: sticky dog/cat/all emoji filter tabs (🐾/🐶/🐱, `position:sticky` top:72 under the navbar) + breed search
- ✅ BLOOM breed content LIVE: PetModal shows a "🐾 על הגזע / About the breed / О породе" card (origin paragraph + bulleted facts), language-aware + RTL/LTR, renders only when `breed_origin_<lang>` exists. 70/70 active breeds populated in all 3 langs (content-writer output). SELECT at ~line 945 includes the 6 breed columns.
- ✅ PetModal UX: product preview is **decoupled** from add-to-cart — clicking shirt/mug only previews; a separate "🛒 Add to cart · ₪X" button does the purchase (color-aware for shirts).
- ✅ Home page product grid: 4-up row on desktop (was 3+1 orphan); 2×2 tablet; 1-col mobile (`gridCols` breakpoints 900/600).
- ✅ **Task 7 — Breed pages DONE** (2026-05-30, commit `5d5750c`). Each BLOOM breed has a rich routable page at `#/breed/<slug>` (e.g. `#/breed/01_golden_retriever`): hero + thumbnail strip, product picker, shirt color/type/size, add-to-cart, "על הגזע" breed story, related-breeds grid (same species), breadcrumb + back. Reuses the existing cart (`addBloomToCart`) + `ProductOption`; extracted shared `BreedStoryCard` + `BloomShirtOptions`. The quick-look modal stays the default and gained a "View full page" link. Behind MAINTENANCE_MODE like `/pets` (public preview → Join-the-BLOOM-Family CTA). Routing: `goToBreed`, `parseBreedSlugFromHash`, popstate/hashchange. No DB changes.
- ✅ **Task 8 — Pet-name personalization DONE** (2026-05-30, commit `bf62c1d`). Optional per-item pet name on BLOOM shirt/mug orders via a shared `PetNameInput` (in both the modal and the breed page). Flows input → `addBloomToCart` cart line → order INSERT (`orders.pet_name` column, migration `20260530120000_add_pet_name_to_orders.sql`) → a prominent 🐾 badge in the admin order item card. Optional (empty → NULL, never blocks checkout), max 40 chars, strips `<>`. BLOOM-only scope. No RLS/grant changes. Verified end-to-end (real order row → admin badge shows the name).
  - 💰 **Now a PAID add-on** (2026-05-30, commit `adbe5ab`): a pet name adds **+₪20 per item** (`PET_NAME_SURCHARGE` const). Folded into the cart line `unitPrice`, so it threads through the cart subtotal, order total, and stored `orders.total` (verified: ₪99 shirt → ₪119; empty name = no surcharge). The personalization field is a premium tinted block (🐾 heading + `+₪20` pill).
- ✅ **Breed-page polish DONE** (2026-05-30, commit `adbe5ab`): hero image, labeled active-highlighted **view selector** thumbnails (portrait / white tee / black tee / mug, trilingual), premium pet-name personalization block. Plus a 2nd pass (commit pending): product-option prices now large + brand-orange; the cart drawer line shows `🐾 <name> (+₪20)`. App.jsx only.
  - ⚠️ **Breed-page hero — the BLOOM portrait artwork (`mockups/bloom/<slug>-clean.webp`) already has its own orange frame baked in (transparent bg). Do NOT add a second frame/border — just `object-fit: contain` capped to the viewport (e.g. `maxHeight: min(74vh, 600px)`) so the whole image + its frame fits with no clipping.**
- ✅ **Task 9 — Launch announcement email BUILT (disabled until launch day)** (2026-05-30, commit `e31aebd`). New edge function `waitlist-launch-announce` (deployed, `verify_jwt=false`) sends a one-time "we're live 🎉" email (he/en/ru, BLOOM design, CTA → gallery) to every `waitlist` row where `launch_notified_at IS NULL`, stamping `launch_notified_at` per row on success (no double-sends; batched + idempotent, safe to re-run). ⛔ **MANUAL-TRIGGER / DISABLED by default** — a real send is **triple-gated**: `x-webhook-secret` + `LAUNCH_ANNOUNCE_ENABLED="true"` + body `{"confirm":"SEND"}`. A bare authed call = harmless dry-run (count only); `{test:true,to,lang}` sends ONE email without touching the list. Secret uses an in-code fallback (same TODO as waitlist-welcome). Verified (401 w/o secret, dry-run count, 1 test to gleb2009, no rows stamped, left disabled). **Launch day:** arm deliberately (dry-run → enable + confirm), like waitlist-welcome.
- ✅ **Task 10 — Admin waitlist dashboard DONE** (2026-05-30, commit `0a948d4`). Read-only `Waitlist` section in `AdminPage` (5th sticky-nav chip): total signups, most-requested breeds (`breed_interest` grouped + counted, slug→name via `petDesigns`), recent signups (email, lang, friendly source label, date). Admin SELECT policy on `waitlist` (`USING is_admin()`) already existed → no RLS change/migration. Trilingual inline; reuses `COLORS` + `timeAgo`.

---

## 🗺️ Roadmap / next

- ✅ **Tasks 7–10 DONE + LIVE ON PRODUCTION** 2026-05-30 (merged `launch-prep` → `main`, commit `174f312`; see the SESSION END block in Current status above): breed pages `5d5750c`, pet-name `bf62c1d`, launch email `e31aebd`, admin waitlist dashboard `0a948d4`, plus modal/breed nav, staff password gate, character rail.
- 🚦 **REAL public-launch sequence (still pending):** (1) Tranzila supplier number → (2) ✅ ~~fix the cancel-button security hole~~ **DONE 2026-05-31** (both payment-integrity holes fixed + live on prod, `PAYMENTS-LAUNCH-CHECKLIST.md`) → (3) flip `MAINTENANCE_MODE=false` + `PAYMENTS_ENABLED=true` → (4) arm `waitlist-launch-announce` (dry-run → enable + `{"confirm":"SEND"}`).
- ⏳ **Task 6 (blocked) — Tranzila payment:** waiting on the supplier number. Payment code is ~complete behind `PAYMENTS_ENABLED=false`. ✅ **Payment-integrity holes FIXED 2026-05-31** (live on prod Supabase, mirrored into repo): (a) a `BEFORE INSERT/UPDATE` trigger `trg_protect_order_payment_fields` on `orders` blocks any non-server/non-admin write to the payment columns (so a customer can no longer self-set `payment_status='paid'`); (b) `create-payment` now recomputes the charge server-side as `SUM(orders.total)` and ignores the client `amount`. Documented in `PAYMENTS-LAUNCH-CHECKLIST.md`. → then flip `MAINTENANCE_MODE` off.
- 📰 **Blog — built but blocked in maintenance** (page + routing done, trilingual + SEO). Decision: stays non-public until there are ~3–5 posts. The `content-writer` agent produces the content.
- 🔐 **TODO (small):** move `WAITLIST_WEBHOOK_SECRET` to a real Edge Function secret and rotate it (currently hard-coded in `waitlist-welcome/index.ts` and the DB trigger — low-stakes, but worth tidying).

---

## 🎓 Lessons learned (read before relevant tasks)

- **Windows ImageMagick**: Use `magick identify` / `magick convert`. Bare `convert` is a Windows disk tool that will NOT do what you want.
- **`.claude/` partial gitignore**: Only `.claude/agents/` is tracked. The rest (cache, projects, etc.) stays ignored.
- **Supabase storage URLs are public** — no auth needed for `curl` / `HEAD`.
- **BLOOM image standard**: 1414×2000, WebP, sRGB, target <500 KB.
- **Mockup paths**: `mockups/bloom/<slug>-clean.webp`, `mockups/bloom/<slug>-mug.webp`, `pet-designs/bloom/<slug>.webp`.
- **Pixel Agents** (VS Code ext.): unreliable for actual code work. Stick to regular Claude Code terminal.
- **CSP**: Two CSP headers on the same path → browser intersects → most-restrictive applied. Use negative-lookahead in path patterns to avoid this.
- **Staff bypass**: `?staff=1` query param bypasses MAINTENANCE_MODE for testing.
- **Sticker spot color**: must be EXACTLY `PerfCutContour` (perforated cut, Roland convention), NOT `CutContour` or other spellings.

---

## 💬 Communication style

- **Conversation language**: Hebrew (Gleb is Hebrew-first).
- **Agent output**: English (consistent across all subagents).
- **Style**: Concise, action-oriented, code-ready-to-paste, tables for comparisons, emoji for visual scanning, no excessive caveats.

---

## 💳 Tranzila integration (pending supplier number)

- Code is **mostly written**, gated off behind `PAYMENTS_ENABLED=false`. Full go-live steps are in **`PAYMENTS-LAUNCH-CHECKLIST.md`**.
- ✅ **Payment-integrity holes FIXED 2026-05-31 (live on prod Supabase, mirrored into repo):** (a) browser can no longer write payment fields on `orders` — a `BEFORE INSERT/UPDATE` trigger (`trg_protect_order_payment_fields` → `public.protect_order_payment_fields()`) pins payment columns to server/admin-only; migration `20260531120000_harden_orders_payment_fields.sql`. (b) `create-payment` recomputes the charge server-side from `SUM(orders.total)` and ignores the client-supplied amount.
- ✅ **Custom-design approval workflow LIVE 2026-05-31 (prod Supabase, mirrored into repo):** customer-uploaded custom designs must be shop-approved before payment. UI in `App.jsx` (checkout → `#track` → admin queue). Server: the 4 `orders` design-approval columns + the SAME `trg_protect_order_payment_fields` trigger (now also enforces `rejected→pending`-only for customers; only shop approves/rejects) — migration `20260531130000_add_design_approval_workflow.sql` (its trigger body supersedes the payment-only `…120000…` one). `create-payment` (v3) refuses payment with `403 design_not_approved` until approved. Email: `notify-design-decision/` (built, **DISABLED by default** / dry-run; arm via the `orders` UPDATE DB webhook + `DESIGN_NOTIFY_ENABLED="true"` — see `PAYMENTS-LAUNCH-CHECKLIST.md`).
- ✅ **Webhook Layer-2 amount verification LIVE (prod, `tranzila-webhook` v2; repo mirrors it):** on a Tranzila success notice the reported `sum` must equal `SUM(orders.total)` for the `order_group` (±0.01); on mismatch the order is held as `payment_status='processing'` (NOT marked paid), logged as `payment_amount_mismatch`, and no confirmation email is sent. ⏳ **Layer-1 signature verification is still TODO** at the Tranzila sandbox (`TRANZILA_WEBHOOK_SECRET`; tracked with H2 below).
- Files in `supabase/functions/`:
  - `create-payment/` (server-side amount + design-approval gate, gated off)
  - `tranzila-webhook/` (v2 — Layer-2 amount verify live; Layer-1 signature TODO)
  - `notify-design-decision/` (custom-design approve/changes email — DISABLED by default)
- Env vars needed in Vercel:
  - `TRANZILA_SUPPLIER` (pending from Tranzila — the single launch gate)
  - `TRANZILA_TK` (transaction key)
  - `SUPABASE_SERVICE_ROLE_KEY` (Supabase admin key)
- Open security tasks: ✅ ~~C1, C2 (payment integrity)~~ **FIXED 2026-05-31** (orders payment-field trigger + server-side amount + webhook Layer-2 amount verify); still open: H2 (webhook signature/HMAC = Layer-1, TODO at sandbox), H3 (rate limit / WAF rules)

---

## 🤖 Agent roster (`.claude/agents/`)

Pre-existing: `explorer`, `code-finder`, `supabase-helper`, `rtl-auditor`, `ramkol`
Added 2026-05-27: `tranzila-specialist`, `i18n-translator`, `whatsapp-responder`, `seo-auditor`, `a11y-auditor`, `legal-content-checker`, `security-auditor`
Added 2026-05-28: `mockup-qa`, `pre-deploy-orchestrator`, `order-helper`, `bloom-curator`, `canva-pipeline`, `sticker-print-helper`
Added 2026-05-29: `content-writer` — owns brand voice; writes he/en/ru; accurate, well-established facts only (never invents). Used for BLOOM breed content and future blog/article content.
