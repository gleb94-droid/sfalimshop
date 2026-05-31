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
