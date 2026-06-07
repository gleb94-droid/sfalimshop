# Sfalim Shop — Full Pre-Launch Site Review & Growth Roadmap
**Date:** 2026-06-07 · **Branch:** launch-prep · **Status:** PRE-LAUNCH (behind maintenance gate)
**Method:** 8 specialist agents each reviewed one area, read-only, against the live code. (Russian summary delivered in chat.)

> This is the single source of truth for "where the site stands and what's next." Where it conflicts with older notes, this wins. Nothing here was auto-fixed — every item is a reviewed recommendation awaiting the owner's go-ahead.

---

## 0. Scoreboard

| Area | Grade | One-line verdict |
|---|---|---|
| Security / payments | **B+** | Payment integrity is A-grade; gaps are infra (CORS, one open endpoint, dev-only vuln). |
| RTL (Hebrew) | **B+** | New mugs sections are RTL-correct; a few hardcoded `→` arrows + an English-only label. |
| Accessibility | **B−** | Solid foundation; 2 pre-existing blockers (a dialog focus-trap, input `outline:none`). |
| SEO | **B−** | Infra is built but NOT ready to flip noindex: missing OG image file, `/mugs` shares generically, stale static sitemap. |
| Product mockups | **A−** | Technically A+ (70/70 mug+shirt files clean); showcase shows **dogs only, no cats**. |
| Legal / policy | **B−** | Above-average; needs governing-law clause, commission pre-pay consent, uploaded-files privacy disclosure. |
| Marketing / social | **F → plan ready** | Currently zero content/audience; full plan below. This is the owner's priority growth area. |
| UX / CRO / visual | **B+** | Visually A−; held back by the carousel-first home, thin social proof (1 review), and pay-first commission friction. |

**Overall:** the product/tech/payments are launch-ready; **trust (social proof), the home first-screen, a few launch-SEO files, and marketing** are what stand between "ready" and "great." None are large.

---

## 1. Security & Payments — B+
Strong. Server-side re-pricing + query-back webhook + payment-field trigger + fail-closed are all correctly live. No service-role key or Tranzila secret in the browser bundle or git history.

**Fix:**
- **[SHOULD]** CORS `Access-Control-Allow-Origin: "*"` on `create-payment` (`supabase/functions/create-payment/index.ts:26`) and the webhook (`:36`) → restrict to `https://www.sfalimshop.com` (drop CORS entirely on the webhook — it's server-to-server).
- **[SHOULD]** `notify-design-submission` has no auth (`index.ts:131-171`) → anyone with an order-group UUID can spam the admin inbox. Add the same `x-webhook-secret` the other notify functions use.
- **[SHOULD]** `ADMIN_EMAIL = "gleb2009@gmail.com"` ships in the browser bundle (`App.jsx:1627`) → remove; the real admin check is DB-backed anyway.
- **[SHOULD]** `vite ^4.4.0` / `esbuild` have a HIGH dev-server vuln (`npm audit`). Dev-only (not in the prod artifact) but exploitable on your machine during `vite dev`. Upgrade carefully (esbuild template-literal constraint — re-test build).
- **[SHOULD]** `designs` storage bucket allows anon upload with no path restriction → add a `WITH CHECK` path constraint + WAF rate-limit.
- **[SHOULD]** Blog HTML uses a hand-rolled sanitizer + `dangerouslySetInnerHTML` (`App.jsx:14188`) → swap to DOMPurify (belt-and-suspenders vs a compromised admin account).
- **[NICE]** HSTS missing `preload`; anon key hardcoded (move to env); email-fn `RESEND_API_KEY!` crashes opaquely if unset; add a CSP `report-to`; verify SPF/DKIM/DMARC DNS before launch.

**To verify live (run via Supabase SQL):** RLS enabled on all sensitive tables; no `USING(true)` anon policy; `trg_protect_order_payment_fields` enabled; storage bucket MIME/size limits; no anon DELETE/UPDATE grants on `orders`/`payment_events`/`admins`.

---

## 2. RTL (Hebrew) — B+
New `HomeMugsBanner` + `MugsPage` correctly set `dir`, arrows, and alignment.

**Fix:**
- **[CRITICAL]** Hero secondary CTA renders a hardcoded `→` in Hebrew (`App.jsx:8619`) → `{lang === 'he' ? '←' : '→'}`.
- **[SHOULD]** MugsPage showcase card shows `name_en` even in he/ru (`:8856`) → `d[\`name_${lang}\`] || d.name_en || d.name_he`.
- **[SHOULD]** HomeMugsBanner mug-photo `alt` = the CTA string (`:8705`) → use the breed name.
- **[SHOULD]** Several LANGS.he strings have `→` instead of `←`: `quiz.banner_cta` (~1900), `bloom.seeAll` (~1965), `blogRelatedProduct`, `blogFromOurBlog`.
- **[NICE]** Prefer logical `textAlign:'start'` over physical `right`/`left` in the new sections.

---

## 3. Accessibility — B− (WCAG 2.1 AA / IS 5568)
Good base: focus-traps on modals, skip-link, route announcer, lang/dir switching, reduced-motion coverage, AA-safe `#C0501A` buttons.

**Fix:**
- **[CRITICAL]** `payFailed` dialog has no focus-trap and no Escape (`App.jsx:6639`) → add `useDialogFocus` + `onKeyDown` Escape.
- **[CRITICAL]** `outline:"none"` on inputs/textareas can defeat focus-visibility on Safari/iOS (multiple `inputStyle` spots) → remove; let the global `:focus-visible` rule handle it.
- **[SHOULD]** Mug-photo/showcase buttons: image `alt` duplicates the button `aria-label` and all 4 banner tiles share one label → set image `alt=""`, give each button a unique name (breed + destination).
- **[SHOULD]** MugsPage "ways to order" `div[role=button]` cards lack `aria-label` (`:8892`); major `<section>`s lack `aria-labelledby`; 10px gray labels are borderline contrast.
- **[NICE]** Convert `div[role=button]` cards to real `<button>`; wrap decorative arrows in `aria-hidden`.

---

## 4. SEO — B− (NOT ready to flip noindex yet)
Infra (dynamic meta/canonical/hreflang/JSON-LD, breed+blog crawler HTML, sitemap fn) is well built. Five launch-blockers:

**Fix:**
- **[CRITICAL]** `og-image.png` is referenced everywhere but **not present in `public/`** → every WhatsApp/FB link preview is a broken image. Generate & commit `public/og-image.png` (1200×630) before launch.
- **[CRITICAL]** `/mugs` (highest-value page, in sitemap) has **no server-side OG HTML** → shares with generic home tags. Add a `type==='mugs'` branch to `api/og.js` + a `vercel.json` rewrite.
- **[CRITICAL]** `public/sitemap.xml` (static) is stale — missing `/mugs`, `/faq`, `/about` (the dynamic fn has them). Pick one source of truth (delete the static, or sync it).
- **[SHOULD]** `setGenericSeo` hardcodes `og:url` to `/` for all non-breed/blog pages (`App.jsx:14171`) → wrong for `/mugs`. Breed OG image has no `width/height/type`. `/about` not in sitemap. Add `twitter:site=@sfalimshop`, Google Search Console + Bing verification meta tags.
- **Multilingual:** same-URL client-side switching is **adequate for a Hebrew-first launch**, but EN/RU content is not crawler-indexable. Defer SSR / `/en` `/ru` URLs to post-launch.
- **[NICE]** `vatID`→`taxID` in JSON-LD; breed `changefreq` weekly→monthly; price range floor.

---

## 5. Product Mockups — A− (technical A+)
All 70 mug + 70×2 shirt files exist, HTTP 200, WebP/sRGB, consistent size (mugs 2048², 344–353 KB). Excellent.

**Fix:**
- **[SHOULD]** Mug showcase (MugsPage + HomeMugsBanner) queries `sort_order ASC` → shows **dogs only (01–47); zero cats** in the first 8/4. Cat owners see no cats. Hand-pick a dog+cat mix (use bestseller flags: Pug, French Bulldog, Siamese, Persian, Corgi, Husky…).
- **[SHOULD]** HomeMugsBanner 4 tiles are all brown dogs → swap 2 for high-contrast/distinctive (Siamese, Corgi).
- **[NICE]** Shirt mockups are JPEG (acceptable, under 500 KB); `tshirt_basic.png` 458 KB near the ceiling; `t shirt basic .png` URL has a trailing space (fragile). Lycra/Look/Stone-wash share one image **by design** (photoshoot later — not a defect).

---

## 6. Legal / Policy — B−
Above-average; all six required areas exist, exempt-dealer + 14-day + personalized-exception present in all 3 langs.

**Fix (most are copy I can do; commission framing needs a lawyer glance):**
- **[CRITICAL]** Terms name the court but no **governing-law** clause → add "governed by the laws of the State of Israel, incl. Consumer Protection Law 5741-1981…" (he/en/ru ready in the agent output).
- **[CRITICAL]** Commission is pay-first/made-to-order; "no refund after approval" is correct but must be **acknowledged before payment** (ideally a tick/inline notice at "Continue to Payment"), not only in the cart note. → Lawyer should bless the exact framing.
- **[CRITICAL]** Privacy "Info We Collect" doesn't mention **uploaded design files** / WhatsApp photos → add one line.
- **[SHOULD]** Add an **indemnification** clause (customer covers third-party IP claims from their uploads); resolve refund §5 cancellation-fee vs §2 non-cancellable inconsistency; state a data-retention period (7 yrs tax); name the accessibility coordinator.
- "Printed by hand" claim is fine (owner runs the press); "illustrated portraits" is accurate-style language — both OK. ("Hand-drawn" prohibition correctly observed everywhere.)

---

## 7. Marketing & Social — currently zero, full plan ready (OWNER PRIORITY)
IG @sfalimshop exists with no posts; waitlist + welcome email live; quiz unused as a funnel; 1 testimonial. Everything below grows audience + list **before** launch.

**5 content pillars:** ① The Pet Portrait (BLOOM reveals, breed facts, quiz) · ② Behind the Print (press, packing — local/craft, no "handmade" claim) · ③ Your Style On It (custom/commission reveals, gift unboxings) · ④ Pet Life in Israel (relatable, no product — audience growth) · ⑤ Made for Moments (gifting, weddings, events). Ratio ~60% audience (①④) / 40% conversion (②③⑤).

**Cadence:** 3–4 Reels/feed posts a week; anchor Reel **Saturday 20:30**, second slot **Wed 19:00**; Stories every 1–2 days; never silent >4 days. (A full 2-week sample calendar + hashtag sets A/B/C + 6 Reel-hook formulas are in the agent output — paste-ready.)

**List growth (pre-launch):** quiz → result → "notify me at launch" → waitlist (the single highest-leverage funnel; quiz link in IG bio) · monthly **giveaway** (BLOOM mug + pet commission; follow + comment breed + join waitlist + tag a friend) · **WhatsApp broadcast list** of everyone who messages · organic posts in Hebrew **breed-specific Facebook groups** · referral ("share a friend, both get 10%").

**WhatsApp Business setup (do this week):** greeting message, away message (nights/Shabbat), **quick replies** for the 8 templates, **labels** (interested / active order / waitlist / VIP), **catalog** (5 items w/ photo+price). Reply standard: within ~2h Sun–Thu; personal singular tone; ask for a photo before quoting. Two new templates drafted: "not open yet → join waitlist" and "quiz result → join waitlist."

**Launch sequence:** Phase 1 countdown (3–4 pre-launch Reels, giveaway, WhatsApp status countdown, prep the `waitlist-launch-announce` blast) → Phase 2 launch day (blast email + WhatsApp broadcast + launch Reel; reply to everything within 1h) → Phase 3 UGC loop (post-delivery follow-up → repost customer photos → seed testimonials → monthly giveaway). Week-4 goal: 10 orders, 2–3 UGC posts, 300+ followers.

> Note: a `highlight-covers/` folder already exists in the repo — check before re-making Instagram highlight covers.

---

## 8. UX / CRO / Visual — B+ (visually A−, trust C+)
Genuinely above POD-shop quality. Held back by identity blur + thin social proof + the home first-screen.

**Fix:**
- **[CRITICAL]** Home opens on a single rotating illustration with **no headline / value / price above the fold** (`App.jsx:10850`, carousel-first). Put a real headline + value sub over the carousel (or lead with Hero). Highest-leverage conversion change.
- **[CRITICAL]** Social proof = 1 review in a 3-col grid → looks emptier than none. Use a **single-column featured-testimonial** layout until ≥3; seed 2–3 real reviews before launch.
- **[SHOULD]** Brand says "mugs" but the hero is shirts-led → make the **mug the visual lead**. Three near-identical orange gradient sections (mugs banner + 2 event blocks) blur into one ribbon → differentiate one (dark/image-led).
- **[SHOULD]** **De-risk the pay-first commission**: show 2–3 finished-work example thumbnails in the commission box; bold "free revisions until you're happy / refund if you don't love the first concept"; pre-explain "pay → then send photos on WhatsApp" *before* payment.
- **[SHOULD]** Add turnaround ("Made & shipped in 3–7 days") to the TrustRow/hero & near CTAs. Cart-drawer big number is "total" but excludes shipping → relabel "Subtotal" / move the shipping note above it. Product picker is text-heavy → larger imagery.
- **[SHOULD]** WhatsApp FAB is a small unlabeled circle → expand once to a labeled pill ("Questions? Chat with us") + a "usually replies within hours · he/en/ru" line; put a help link on **every** order confirmation (not just commission).

---

## 9. ≥10 New Ideas (visual · customer service · WhatsApp · marketing · social)

1. **Home first-screen rework** — headline + value + price anchor over the carousel; lead the hero with the mug. *(visual/conversion, S)*
2. **Featured-testimonial layout + seed 2–3 reviews** — single-column quote-led until ≥3 exist. *(trust, S + owner)*
3. **Mix dogs + cats in the mug showcase** — hand-picked bestseller mix, not dogs-only. *(visual/conversion, S)*
4. **De-risk pay-first commission** — example thumbnails + bold revisions/refund promise + pre-explain the WhatsApp step. *(conversion/CS, M)*
5. **WhatsApp Business setup** — greeting/away/quick-replies/labels/catalog. *(customer service, S, owner)*
6. **WhatsApp FAB → labeled pill + "replies within hours · he/en/ru"** + help link on every confirmation. *(customer service, S)*
7. **Quiz → waitlist funnel + a quiz Reel** (bio link) — turn the unused quiz into the main lead magnet. *(marketing/list, S)*
8. **Monthly giveaway** — BLOOM mug + pet commission; follow + comment breed + join waitlist + tag a friend. *(social/list, M)*
9. **Instagram content engine** — 5 pillars, Sat 20:30 anchor Reel, "Behind the Print", "גזע החודש" monthly breed spotlight, weekly "יש לכם [גזע]?" Story polls. *(social, ongoing)*
10. **Micro-influencer barter + breed FB groups** — custom portrait for a Story/Reel from pet accounts (2k–15k); organic breed-group posts. *(marketing, M)*
11. **UGC loop** — post-delivery WhatsApp follow-up → repost customer photos as Stories → "tag us for 10% off next order". *(social/CS, ongoing)*
12. **Turnaround + support-expectation trust line** site-wide. *(trust, S)*
13. **Instagram Highlight covers** (BLOOM / gifts / order / reviews / about) — folder already exists. *(visual/social, S, owner)*
14. **Add `/mugs` server-side OG + a real mug social image** — the namesake page should share beautifully. *(SEO/marketing, M)*
15. **Gift mode** (later) — gift note + "ship to a friend" + gift-wrap option; huge for the mug/pet-gift angle. *(feature, L)*

---

## 10. Roadmap (prioritized)

### A. Quick code fixes — small, safe, do next (½–1 day total)
- [ ] RTL: Hero secondary CTA arrow `→`→`←` in he (`8619`); LANGS.he `→`→`←` (quiz banner_cta, bloom.seeAll, blog links).
- [ ] MugsPage card uses `name_${lang}` not `name_en` (`8856`).
- [ ] Mug showcase: hand-picked **dog+cat mix** (MugsPage + HomeMugsBanner).
- [ ] Alt text on mug photos = breed name; `alt=""` where inside a labeled button; aria-labels on "ways to order" cards.
- [ ] a11y: `payFailed` dialog focus-trap + Escape (`6639`); remove input `outline:"none"`.

### B. Pre-launch — before flipping the 3 flags
- [ ] **SEO:** generate & commit `public/og-image.png`; `/mugs` server-side OG (+rewrite); sync/dedupe sitemap; fix `og:url` for `/mugs`; add GSC + Bing verification + `twitter:site`.
- [ ] **Trust/UX:** featured-testimonial layout + **seed 2–3 real reviews (owner)**; home first-screen headline; turnaround line; commission de-risk (examples + bold promise + pre-explain).
- [ ] **Security:** lock CORS to the domain; auth `notify-design-submission`; remove `ADMIN_EMAIL` from bundle; verify SPF/DKIM/DMARC DNS.
- [ ] **Legal:** add governing-law clause; commission pre-pay acknowledgment; privacy uploaded-files line; indemnification; refund §5 fix. *(Lawyer glance on commission framing.)*
- [ ] **Marketing:** WhatsApp Business setup; IG bio + Highlight covers; first 3–4 pre-launch Reels; quiz→waitlist funnel live.

### C. Post-launch
- [ ] DOMPurify for blog; Vercel WAF rate-limits on payment/upload; `vite` upgrade; HSTS preload; CSP report endpoint.
- [ ] SSR/prerender or `/en` `/ru` URLs for true multilingual SEO; breed OG 1200×630 crops.
- [ ] Referral-code system; gift mode; mug studio (3D customizer, behind flag); monthly giveaway engine; email marketing.
- [ ] Convert shirt mockups to WebP; fix the trailing-space filename.

### D. Deferred — OWNER tasks (explicitly "leave for the end")
- [ ] **Audit which shirts are actually in stock / available to offer; add more shirts to the catalog.**
- [ ] **Add a SIZE CHART / size-guide** (per shirt model: Basic / Lycra / Oversize / Look / Stone-wash / Dri-fit) so customers pick the right size — table with chest/length cm, "how to measure", fit notes (he/en/ru). *(Current shirt models in code: Basic, Lycra, Oversize, Look-Oversize, Stone-wash-Oversize, Dri-fit — all custom flat ₪149.)*
- [ ] Seed more testimonials; real product/lifestyle photoshoot (incl. mugs + the Lycra/Look/Stone-wash variants); confirm registered business address; lawyer policy review.

---

*Generated from 8 specialist reviews (security · RTL · a11y · SEO · mockup-QA · legal · marketing · UX/CRO). Detailed per-issue wording (incl. paste-ready legal clauses, the full 2-week content calendar, hashtag sets, and Reel hooks) lives in the review session.*
