# MY CREW (Pet Photo-Collage Tee) — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add MY CREW — a "we design it" commission option for an oversize tee with a streetwear collage of the customer's REAL pet photos (₪169) — wired through the existing commission flow, priced server-side, with a `/collage` landing page and a home showcase block.

**Architecture:** MY CREW is NOT a new product type — it is a third **commission type** (`collage`) alongside the existing `pet` / `custom` types in the "we design it" flow. The customer picks the oversize tee, chooses the 📸 photo-collage option, pays, then sends photos + choices over WhatsApp (post-pay prefill), and the owner builds + previews the design (reuses the existing commission approval flow). Rich on-site selectors (colour/style/phrase/mode) are deferred to Phase 2 — Phase 1 captures them in the WhatsApp conversation.

**Tech Stack:** React 18 + Vite single-file `App.jsx`; Supabase edge function `create-payment` (Deno/TypeScript) for authoritative pricing; trilingual he/en/ru; inline styles; AboutIcon SVG set (no emoji in UI chrome).

## Global Constraints

- **Template literals ONLY** — `` `text ${var}` ``, never `"a" + b` (esbuild 0.18).
- **Trilingual he/en/ru** for every user-facing string; **Hebrew RTL-primary**.
- **Branch `launch-prep`** — NEVER commit to `main`; no merge/deploy without explicit owner approval.
- **Server-first deploy rule:** deploy `create-payment` with the new `collage` price BEFORE the client option that lets a customer pick it, else a `collage` order would fall to the "pet" tier (safe-but-wrong direction) or fail to resolve.
- **Name LOCKED:** `MY CREW` (English in all langs, like BLOOM) + subtitle he `החבורה שלך על חולצה` / ru `твоя банда на футболке` / en `your crew on a tee`. Name must NEVER appear without the subtitle + a product visual nearby.
- **Price LOCKED:** tee **₪169** (all sides + up to 12 photos + name + approval included). "+ same-design mug" = +₪49 (Phase 2 upsell, not Phase 1).
- **Copy rules:** never the word "free" (→ "included"/`כלול`/`включено`); never claim the artwork is "hand-drawn" ("printed by hand"/`מודפס בעבודת יד` IS true); designs are our own style, not a copy of any brand.
- **UI uses AboutIcon SVG icons, not emoji.** (The existing commission buttons still use emoji — match the file's local pattern there, but use AboutIcon for any NEW standalone showcase chrome.)
- **No test framework exists** — the "test" cycle for each task is `npm run build` (must pass) + live verification via Playwright/Chrome-DevTools MCP on the `launch-prep` Vercel Preview deployment (he/en/ru, no console errors).

---

### Task 1: Server pricing for the `collage` commission type (deploy FIRST)

**Files:**
- Modify: `supabase/functions/create-payment/index.ts:273-285` (the `CPRICE` block + `ctype` coercion inside `meta.src === "commission"`).

**Interfaces:**
- Consumes: `meta.ctype` (client-set, one of `pet` | `custom` | `collage`), `meta.pid` (product id; for MY CREW = `oversized`).
- Produces: an authoritative unit price of **169** when `ctype === "collage"` (any non-mug pid → shirt price; collage has no mug variant in Phase 1, so a `collage` + `mug` would resolve to the collage shirt price — acceptable, mug-set is Phase 2).

- [ ] **Step 1: Add the `collage` tier to `CPRICE` and the coercion**

In the `meta.src === "commission"` branch, change the `CPRICE` table and `ctype` line to:

```typescript
          const CPRICE: Record<string, { shirt: number; mug: number }> = {
            pet: { shirt: 189, mug: 119 },
            custom: { shirt: 149, mug: 89 },
            collage: { shirt: 169, mug: 169 }, // MY CREW — oversize photo-collage tee (mug-set = Phase 2)
          };
          // ctype/pid come from client-set extra_prints. Unknown ctype coerces to
          // "pet" (the MORE expensive of pet/custom — safe direction); "collage" is
          // an explicit known tier. non-"mug" → shirt.
          const ctype = meta.ctype === "custom" ? "custom" : (meta.ctype === "collage" ? "collage" : "pet");
          unit = pid === "mug" ? CPRICE[ctype].mug : CPRICE[ctype].shirt;
```

- [ ] **Step 2: Verify the edit compiles locally (type check by eye + build the app)**

Run: `npm run build`
Expected: build succeeds (this file isn't bundled by Vite, but the build confirms no accidental App.jsx breakage if touched). The edge fn itself is validated on deploy.

- [ ] **Step 3: STOP — request owner approval to deploy `create-payment` (server-first gate)**

Per CLAUDE.md, never deploy without explicit owner go. Report in Russian: "Готов задеплоить create-payment v24 — добавлена цена MY CREW (collage = ₪169) на сервере. Деплоить?" Do NOT call `deploy_edge_function` until the owner says yes.

- [ ] **Step 4: After approval — deploy + byte-verify**

Deploy via the Supabase MCP `deploy_edge_function` (CLI not installed). Then re-fetch with `get_edge_function` and byte-compare the deployed source to the repo file. Confirm `verify_jwt: true` is preserved. Record the new version number.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-payment/index.ts
git commit -m "feat(create-payment): add MY CREW collage commission tier (collage shirt=169)"
```

---

### Task 2: i18n strings for MY CREW (LANGS dictionary)

**Files:**
- Modify: `App.jsx` — the `commission` sub-object inside `LANGS.he` / `LANGS.en` / `LANGS.ru` (locate by the existing `choiceCommission` / `choiceCustom` keys, ~LANGS block 1394-1500 region; the commission keys live alongside `cartNotePet`/`cartNoteCustom`).

**Interfaces:**
- Produces: new keys on `LANGS[lang].commission` — `choiceCollage`, `choiceCollageSub`, `cartNoteCollage`, `collageHow` (the post-pay "how it works" line) — referenced by Tasks 3, 4, 5.

- [ ] **Step 1: Add the keys to all three languages**

Add to each `commission` object (he / en / ru respectively):

```javascript
// he
choiceCollage: `📸 קולאז' מהתמונות שלכם`,
choiceCollageSub: `MY CREW — החבורה שלך על חולצה. עד 12 תמונות אמיתיות של החיה שלך`,
cartNoteCollage: `MY CREW · קולאז' מהתמונות שלך — נתאם את התמונות אחרי התשלום בוואטסאפ`,
collageHow: `שולחים עד 12 תמונות בוואטסאפ, אנחנו בונים קולאז' ושולחים לאישור לפני ההדפסה`,
```

```javascript
// en
choiceCollage: `📸 Collage from your photos`,
choiceCollageSub: `MY CREW — your crew on a tee. Up to 12 real photos of your pet`,
cartNoteCollage: `MY CREW · collage from your photos — we'll arrange the photos over WhatsApp after payment`,
collageHow: `Send up to 12 photos on WhatsApp, we build the collage and send a preview for approval before printing`,
```

```javascript
// ru
choiceCollage: `📸 Коллаж из ваших фото`,
choiceCollageSub: `MY CREW — твоя банда на футболке. До 12 реальных фото питомца`,
cartNoteCollage: `MY CREW · коллаж из ваших фото — согласуем фото после оплаты в WhatsApp`,
collageHow: `Пришлите до 12 фото в WhatsApp, мы соберём коллаж и пришлём превью на утверждение перед печатью`,
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS (no syntax/template-literal errors).

- [ ] **Step 3: Commit**

```bash
git add App.jsx
git commit -m "i18n(my-crew): add collage commission strings (he/en/ru)"
```

---

### Task 3: Expose the `collage` option in the commission flow

**Files:**
- Modify: `App.jsx:1856` (`COMMISSION_PRICE` const — add the `collage` tier so the client button shows the right price).
- Modify: `App.jsx:7340-7353` (the commission choice buttons — add a 4th button for collage, oversize-only).
- Modify: `App.jsx:7372` (the post-pay "how it works" line — branch for collage).

**Interfaces:**
- Consumes: `commissionType` state (already `'pet' | 'custom'`; now also `'collage'`), `commissionPrice(ctype, pid)` (App.jsx:1857), `t.commission.choiceCollage` / `choiceCollageSub` / `collageHow` (Task 2).
- Produces: a `collage` value flowing into `commissionType` → `addCommissionToCart` → `extra_prints.ctype` (App.jsx:6264, 6936) → server (Task 1). No new state needed — reuses `commissionType`.

- [ ] **Step 1: Add the `collage` tier to `COMMISSION_PRICE`**

At App.jsx:1856 change:

```javascript
const COMMISSION_PRICE = { pet: { shirt: 189, mug: 119 }, custom: { shirt: 149, mug: 89 }, collage: { shirt: 169, mug: 169 } };
```

- [ ] **Step 2: Add the 4th commission choice button (oversize-only)**

After the `custom` button (App.jsx:7352, the `</button>` closing the ✏️ custom button), add. The collage option only makes sense on the oversize tee, so gate it to `selectedProduct === "oversized"`:

```javascript
                  {selectedProduct === `oversized` && (
                  <button onClick={() => { setCommissionMode(true); setCommissionType(`collage`); setCommissionAck(false); }} style={{ flex: `1 1 150px`, textAlign: `start`, background: (commissionMode && commissionType === `collage`) ? `rgba(255,107,53,0.12)` : `transparent`, border: `2px solid ${(commissionMode && commissionType === `collage`) ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: `12px 14px`, cursor: `pointer`, fontFamily: `'Heebo',sans-serif` }}>
                    <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 13 }}>{t.commission.choiceCollage}</div>
                    <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 3 }}>{t.commission.choiceCollageSub}</div>
                  </button>
                  )}
```

- [ ] **Step 3: Branch the post-pay "how it works" line for collage**

At App.jsx:7372 change the single line to handle all three types:

```javascript
                      <div>📸 {commissionType === `collage` ? t.commission.collageHow : (commissionType === `pet` ? t.commission.microHow : t.commission.customHow)}</div>
```

- [ ] **Step 4: Verify the cart note renders for collage**

At App.jsx:5871 and 10640 the cart note uses `it.commissionType === \`custom\` ? cartNoteCustom : cartNotePet`. Update both to surface the collage note:

```javascript
{it.isCommission && <div style={{ color: COLORS.accent, fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>{(LANGS[lang] || LANGS.he).commission[it.commissionType === `collage` ? `cartNoteCollage` : (it.commissionType === `custom` ? `cartNoteCustom` : `cartNotePet`)]}</div>}
```

(apply the matching change at line 10640 with its own font sizing).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Live-verify on the launch-prep Preview**

Using Playwright on the `launch-prep` Vercel Preview: open the order flow, pick the Oversize tee → confirm a 4th "📸 Collage from your photos" button appears, selecting it shows the ₪169 add button, the cart line shows the collage note. Repeat in he + ru. Confirm no console errors.

- [ ] **Step 7: Commit**

```bash
git add App.jsx
git commit -m "feat(my-crew): expose collage commission option on oversize tee (₪169)"
```

---

### Task 4: `/collage` landing page (MY CREW mini-page)

**Files:**
- Modify: `App.jsx:10791` (`VALID_PAGES` — add `'collage'`).
- Create (in App.jsx): `function CollagePage({ lang, setPage })` — placed near `MugsPage` (App.jsx:9482), mirroring its structure.
- Modify: `App.jsx` render block — render `<CollagePage>` when `page === 'collage'` (find where `MugsPage` is rendered and add a sibling branch).
- Modify: `vercel.json` — add a `/collage` rewrite to the OG crawler HTML IF following the `/mugs` pattern (optional; if `api/og.js` has no collage type, point `/collage` at the SPA — see Step 4).

**Interfaces:**
- Consumes: `lang`, `setPage` (to deep-link into the order flow with the oversize tee preselected — reuse the same `setPage('order')` entry the MugsPage CTA uses).
- Produces: a reachable `#collage` / `/collage` route showing the MY CREW pitch + 3-step how-it-works + CTA into the order flow.

- [ ] **Step 1: Add `'collage'` to VALID_PAGES**

At App.jsx:10791:

```javascript
  const VALID_PAGES = ['home', 'mugs', 'collage', 'order', 'track', 'auth', 'admin', 'about', 'pets', 'breed', 'blog', 'faq', 'policies', 'reset-password', ...(MUG_STUDIO_ENABLED ? ['mug-studio'] : [])];
```

- [ ] **Step 2: Write `CollagePage` (mirror MugsPage)**

Read `MugsPage` (App.jsx:9482) first to copy its exact layout/color/section idiom. Create `CollagePage` with: a hero (`MY CREW` wordmark + the localized subtitle directly under it — NEVER the name alone), 1-2 showcase images (PLACEHOLDER until owner supplies real collage-tee photos — use a tasteful existing oversize mockup as a stand-in and add a `{/* TODO: swap to real MY CREW collage photos */}` comment), a 3-step "how it works" (1. pick the tee + send up to 12 photos · 2. we build the collage + send a preview · 3. you approve → we print in Be'er Sheva), the "1 of 1" promise line, price anchor (`₪169 · הכל כלול` / `всё включено` / `everything included`), and a CTA button that calls `setPage('order')`. Use `AboutIcon` for the step icons (valid names only: pawprint, sparkles, printer, heart, truck, palette). Trilingual throughout.

- [ ] **Step 3: Render CollagePage in the page switch**

Find where `page === 'mugs'` renders `<MugsPage .../>` and add:

```javascript
            {page === `collage` && <CollagePage lang={lang} setPage={setPage} />}
```

- [ ] **Step 4: Decide the `/collage` server route**

Check `api/og.js` and `vercel.json` for the `/mugs` rewrite pattern. For Phase 1, add a `/collage` SPA route so `https://www.sfalimshop.com/collage` resolves to the app (no custom OG type needed yet — the home OG image is fine). If `vercel.json` rewrites unknown paths to `index.html` already, no change is needed; verify and note it.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Live-verify**

Playwright: navigate to `/#collage` on the Preview → page renders hero + subtitle + 3 steps + CTA in he/en/ru; CTA opens the order flow; no console errors; no horizontal overflow at 390px width.

- [ ] **Step 7: Commit**

```bash
git add App.jsx vercel.json
git commit -m "feat(my-crew): add /collage MY CREW landing page"
```

---

### Task 5: Discovery hooks — home showcase + cross-links

**Files:**
- Modify: `App.jsx` — add a compact MY CREW showcase block on the home page (near `HomeMugsBanner`, App.jsx:9404, rendered in the home section).
- Modify: `App.jsx` — add a small cross-link in the BLOOM context (PetsPage hero or PetModal): "want your REAL pet? → MY CREW photo collage" → `setPage('collage')`.

**Interfaces:**
- Consumes: `setPage` (to route to `'collage'`), the Task 2 i18n keys + a couple of new home-banner strings.
- Produces: at least two entry points into `/collage` from high-traffic surfaces (home + BLOOM gallery).

- [ ] **Step 1: Add a home showcase block**

Mirror `HomeMugsBanner` (App.jsx:9404) styling. A short band: MY CREW + subtitle + one showcase image (placeholder for now) + a one-line pitch ("your real pet, as a streetwear collage tee — 1 of 1") + CTA → `setPage('collage')`. Render it in the home section after an existing band (place it logically near the mugs banner; match the home section's ScrollReveal wrapper pattern if present). Use AboutIcon, not emoji, for any icon chrome.

- [ ] **Step 2: Add the BLOOM cross-link**

In `PetsPage` (App.jsx:7721) hero area OR `PetModal`, add a subtle line/link: he `רוצה את החיה האמיתית שלך? → קולאז' מהתמונות` / ru `Хочешь СВОЕГО реального питомца? → коллаж из фото` / en `Want your REAL pet? → photo collage`, calling `setPage('collage')`. Keep it small and non-intrusive.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Live-verify**

Playwright: home page shows the MY CREW band (he/en/ru), clicking it routes to `/collage`; the BLOOM cross-link is visible on /pets and routes to `/collage`. No console errors, no overflow at 390px.

- [ ] **Step 5: Commit**

```bash
git add App.jsx
git commit -m "feat(my-crew): home showcase band + BLOOM cross-link to /collage"
```

---

### Task 6: SEO — sitemap + blog internal links

**Files:**
- Modify: `public/sitemap.xml` (add `/collage`).
- Modify: `supabase/functions/generate-sitemap/index.ts` (add `/collage` to the static URLs list).
- Modify: the already-published gift blog posts in the `blog_posts` table — add an internal contextual link to `/collage` in `custom-pet-photo-gift-guide` and `gifts-for-dog-lovers` (DB UPDATE, not code; or via admin). This is owner-gated content publishing — STOP and ask before writing to prod `blog_posts`.

**Interfaces:**
- Consumes: the live `/collage` route (Task 4).
- Produces: `/collage` in both sitemaps + funnel links from existing posts.

- [ ] **Step 1: Add `/collage` to `public/sitemap.xml`**

Mirror the existing `/mugs` `<url>` entry (priority 0.8, weekly).

- [ ] **Step 2: Add `/collage` to `generate-sitemap`**

Add `/collage` to the `staticUrls` array alongside `/mugs` `/faq` etc.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: STOP — owner approval for blog DB edits + sitemap edge-fn deploy**

The blog internal links are AI/owner content edits to prod `blog_posts` — ask the owner before the UPDATE. The `generate-sitemap` edge fn deploy also needs owner go. Report in Russian and wait.

- [ ] **Step 5: Commit the code part**

```bash
git add public/sitemap.xml supabase/functions/generate-sitemap/index.ts
git commit -m "seo(my-crew): add /collage to sitemap + generate-sitemap"
```

---

### Task 7: Final review + deploy gate

**Files:** none (verification + handoff).

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Cross-language overflow + a11y spot-check**

Playwright at 390px he/en/ru: `/collage`, home band, order-flow collage option — no overflow, no console errors, CTAs keyboard-reachable.

- [ ] **Step 3: Confirm server-first ordering held**

Verify `create-payment` v24 (Task 1) is already LIVE before the client `collage` option (Task 3) reaches `main`. If the owner deploys later, the client option must stay on `launch-prep` until the edge fn is live.

- [ ] **Step 4: STOP — report to owner; do NOT merge to main**

Summarize in Russian what shipped on `launch-prep`, that the showcase uses placeholder photos pending his real collage-tee shots, and that merging to `main` (production) + deploying needs his explicit go. List the remaining owner items: (a) real MY CREW photos to swap the placeholders, (b) approve the blog internal links, (c) request GSC indexing for `/collage`.

---

## Self-Review Notes

- **Spec coverage:** §2-4 (anatomy/customization/included) → captured via WhatsApp + the `collageHow` copy in Phase 1 (Tasks 2-3), on-site selectors explicitly deferred to Phase 2 per spec §8. §5 extensions: "1 of 1" promise → CollagePage copy (Task 4); the Set/+₪49 mug + "in memory" mode are Phase 2 (spec §8 defers rich selectors) — noted, not built now. §6 pricing ₪169 → Tasks 1 & 3. §8 site implementation → Tasks 3-6. §9 marketing → out of code scope (owner/ramkol). §10 blockers → Task 4 Step 2 placeholder strategy + Task 7 owner handoff.
- **Placeholder scan:** the only intentional placeholder is the showcase image (real photos pending from owner) — flagged explicitly with a TODO comment + owner handoff, not a silent gap.
- **Type/name consistency:** `collage` used consistently as the `ctype`/`commissionType` value across client (COMMISSION_PRICE, commissionType state, extra_prints.ctype) and server (CPRICE) — matches existing `pet`/`custom` plumbing exactly, so no new state or threading is introduced.
