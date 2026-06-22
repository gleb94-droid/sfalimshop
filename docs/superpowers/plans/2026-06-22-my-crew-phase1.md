# MY CREW (Pet Photo-Collage Tee) — ALL-IN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MY CREW — an oversize tee (₪169) with a streetwear collage of the customer's REAL pet photos — as a complete on-site experience: a new `collage` commission type with full on-site selectors (colour / style / mode / phrase / sleeve / pet names), a **smart WhatsApp brief** auto-built from those choices, a **mug set-upsell (+₪49)**, an "in memory" mode, a `/collage` landing page, a home showcase band, and SEO.

**Architecture:** MY CREW is a third **commission type** (`collage`) inside the existing "we design it" flow — NOT a new product and NOT a live collage constructor (the owner builds the collage by hand from WhatsApp photos). All on-site selections are captured as **order metadata in `orders.extra_prints` (jsonb — no migration)** and on the cart item, then composed into the post-pay WhatsApp prefill so the owner receives a complete order brief. Pricing is authoritative server-side in `create-payment`.

**Tech Stack:** React 18 + Vite single-file `App.jsx`; Supabase edge function `create-payment` (Deno/TS); trilingual he/en/ru; inline styles; AboutIcon SVG set.

## Global Constraints

- **Template literals ONLY** (esbuild 0.18). Trilingual he/en/ru everywhere; Hebrew RTL-primary.
- **Branch `launch-prep`** — NEVER commit to `main`; no merge/deploy without explicit owner approval.
- **Server-first deploy:** deploy `create-payment` with the `collage` price BEFORE the client option ships to `main`.
- **Name LOCKED:** `MY CREW` (English in all langs) + subtitle he `החבורה שלך על חולצה` / ru `твоя банда на футболке` / en `your crew on a tee`. Name NEVER appears without the subtitle + a visual nearby.
- **Price LOCKED:** tee **₪169** (all sides + up to 12 photos + name(s) + approval included). Mug set-upsell **+₪49**.
- **Copy rules:** never "free" (→ "included"/`כלול`/`включено`); never claim artwork "hand-drawn" ("printed by hand"/`מודפס בעבודת יד` is true); own-style designs only.
- **UI chrome uses AboutIcon SVG, not emoji** for NEW standalone components (showcase, page). The existing commission buttons use emoji — match that local pattern only where editing inside it.
- **"In memory" mode handled gently** — quiet toggle, never aggressive marketing.
- **No test framework** — each task's "test" = `npm run build` (must pass) + Playwright/Chrome-DevTools live-verify on the `launch-prep` Vercel Preview (he/en/ru, no console errors, no 390px overflow).
- **NO live collage constructor** (photo upload + layout render) — explicitly out of scope.

---

### Task 1: Server pricing — `collage` tier + mug-set price (deploy FIRST)

**Files:** Modify `supabase/functions/create-payment/index.ts:273-285`.

**Interfaces:**
- Consumes: `meta.ctype` (`pet`|`custom`|`collage`), `meta.pid` (`oversized` for the tee, `mug` for the set add-on).
- Produces: unit price **169** for collage shirt; **49** for a collage mug (= the set add-on; collage has no standalone mug).

- [ ] **Step 1: Add the `collage` tier + coercion**

```typescript
          const CPRICE: Record<string, { shirt: number; mug: number }> = {
            pet: { shirt: 189, mug: 119 },
            custom: { shirt: 149, mug: 89 },
            collage: { shirt: 169, mug: 49 }, // MY CREW tee=169; mug=49 = "Full Crew Set" add-on (set-only, no standalone collage mug)
          };
          const ctype = meta.ctype === "custom" ? "custom" : (meta.ctype === "collage" ? "collage" : "pet");
          unit = pid === "mug" ? CPRICE[ctype].mug : CPRICE[ctype].shirt;
```

- [ ] **Step 2: Build the app to confirm no accidental breakage**

Run: `npm run build` → Expected: PASS.

- [ ] **Step 3: STOP — request owner approval to deploy (server-first gate)**

Report in Russian: "Готов задеплоить create-payment v24 — цена MY CREW (collage: футболка ₪169, кружка-сет ₪49) на сервере. Деплоить?" Do NOT deploy until owner says yes.

- [ ] **Step 4: After approval — deploy + byte-verify**

Deploy via Supabase MCP `deploy_edge_function`; re-fetch via `get_edge_function`, byte-compare to repo, confirm `verify_jwt: true`, record version.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/create-payment/index.ts
git commit -m "feat(create-payment): MY CREW collage tier (tee=169, set mug=49)"
```

---

### Task 2: i18n — all MY CREW strings (LANGS dictionary)

**Files:** Modify `App.jsx` — add a `myCrew` sub-object to `LANGS.he` / `.en` / `.ru` (place beside the existing `commission` object so the implementer finds it by proximity), plus the four commission keys from the original plan.

**Interfaces:** Produces `LANGS[lang].commission.choiceCollage` / `choiceCollageSub` / `cartNoteCollage` / `collageHow` / `adminBadgeCollage` (admin queue label: `📸 MY CREW — awaiting photos` / he `MY CREW — ממתין לתמונות` / ru `MY CREW — ожидает фото`), and a `LANGS[lang].myCrew` object with: `name` (`MY CREW`), `subtitle`, selector labels (`colorLabel`, `styleLabel`, `styleBW`, `styleColor`, `modeLabel`, `modeCelebrate`, `modeMemory`, `phraseLabel`, `phraseOptions` [array], `sleeveLabel`, `petNamesLabel`, `petCountLabel`), `memoryPhrases` [array], `yearsLabel`, `photoGuideTitle`, `photoGuide` [array of 3 tips], `oneOfOne`, `setUpsellLabel` (`+ same design on a mug · +₪49`), `briefLabel` (the WhatsApp brief preamble), and page/band copy (`heroPitch`, `step1/2/3`, `priceLine`, `cta`, `bandPitch`, `bloomCrosslink`). All trilingual.

- [ ] **Step 1: Add the four `commission.*` keys** (he/en/ru) — choiceCollage / choiceCollageSub / cartNoteCollage / collageHow. Copy the exact strings from the version-controlled spec §8 + the values below into each `commission` object:

```javascript
// he (mirror in en/ru with the translations already in the spec)
choiceCollage: `📸 קולאז' מהתמונות שלכם`,
choiceCollageSub: `MY CREW — עד 12 תמונות אמיתיות של החיה שלך`,
cartNoteCollage: `MY CREW · קולאז' מהתמונות שלך — נתאם את התמונות אחרי התשלום בוואטסאפ`,
collageHow: `שולחים עד 12 תמונות בוואטסאפ, אנחנו בונים קולאז' ושולחים לאישור לפני ההדפסה`,
```
(en: `📸 Collage from your photos` / `MY CREW — up to 12 real photos of your pet` / `MY CREW · collage from your photos — we'll arrange them over WhatsApp after payment` / `Send up to 12 photos on WhatsApp, we build the collage and send a preview for approval before printing`. ru: `📸 Коллаж из ваших фото` / `MY CREW — до 12 реальных фото питомца` / `MY CREW · коллаж из ваших фото — согласуем после оплаты в WhatsApp` / `Пришлите до 12 фото в WhatsApp, мы соберём коллаж и пришлём превью на утверждение перед печатью`.)

- [ ] **Step 2: Add the `myCrew` object to each language.** Use the spec for tone. Concrete he example (translate to en/ru, keeping `MY CREW` in Latin and the subtitle per the Global Constraints):

```javascript
myCrew: {
  name: `MY CREW`,
  subtitle: `החבורה שלך על חולצה`,
  colorLabel: `צבע חולצה`, // white/black handled by product.colors
  styleLabel: `סגנון הקולאז'`, styleBW: `שחור-לבן (סטריט)`, styleColor: `צבעוני`,
  modeLabel: `מצב`, modeCelebrate: `חגיגה 🎉`, modeMemory: `לזכר 🤍`,
  phraseLabel: `משפט קדמי (אופציונלי)`,
  phraseOptions: [`[שם]`, `DOG MOM`, `DOG DAD`, `CAT MOM`, `CAT DAD`, `POWERED BY [שם]`, `[שם] EST. '21`],
  sleeveLabel: `הדפס שרוול קטן (אופציונלי)`,
  petNamesLabel: `שם/שמות החיה`, petCountLabel: `כמה חיות?`,
  memoryPhrases: [`בלב לנצח`, `תמיד איתי`, `[שם] · 2015–2024`],
  yearsLabel: `שנים (אופציונלי)`,
  photoGuideTitle: `אילו תמונות לשלוח`,
  photoGuide: [`תמונות חדות וברורות`, `פנים מקרוב + זוויות שונות`, `אור טוב, רקע פשוט`],
  oneOfOne: `1 OF 1 · עיצוב ייחודי רק לך`,
  setUpsellLabel: `+ אותו עיצוב על ספל · +₪49`,
  briefLabel: `הפרטים שבחרתי:`,
  heroPitch: `החיה האמיתית שלך, כקולאז' סטריטוויר על חולצת אוברסייז. 1 of 1.`,
  step1: `בוחרים חולצה ושולחים עד 12 תמונות`, step2: `אנחנו בונים קולאז' ושולחים לאישור`, step3: `מאשרים → מדפיסים בבאר שבע`,
  priceLine: `₪169 · הכל כלול`, cta: `מתחילים את MY CREW`,
  bandPitch: `MY CREW — החיה האמיתית שלך על חולצה`,
  bloomCrosslink: `רוצה את החיה האמיתית שלך? → קולאז' מהתמונות`,
},
```

- [ ] **Step 3: Build** → `npm run build` → PASS.
- [ ] **Step 4: Commit**

```bash
git add App.jsx
git commit -m "i18n(my-crew): collage strings + myCrew selector/page copy (he/en/ru)"
```

---

### Task 3: `CollageOptions` selector panel + collage commission option

**Files:**
- Modify `App.jsx:1856` (`COMMISSION_PRICE` — add `collage` tier).
- Modify `App.jsx:7340-7353` (add the 4th commission choice button, oversize-only — from the original plan Task 3 Step 2).
- Modify `App.jsx:7354-7382` (render `<CollageOptions/>` instead of the generic colour/size block when `commissionType === 'collage'`).
- Create `function CollageOptions({...})` near the OrderPage commission code.

**Interfaces:**
- Consumes: `commissionType` state (now also `'collage'`), `t.myCrew.*` (Task 2), `product.colors`, the new state from Step 3.
- Produces: collage-choice state — `collageStyle` (`bw`|`color`), `collageMode` (`celebrate`|`memory`), `collagePhrase` (string), `collageSleeve` (bool), `petNames` (string), `petCount` (number), `setMug` (bool) — consumed by Task 4.

- [ ] **Step 1: `COMMISSION_PRICE` collage tier** — App.jsx:1856:

```javascript
const COMMISSION_PRICE = { pet: { shirt: 189, mug: 119 }, custom: { shirt: 149, mug: 89 }, collage: { shirt: 169, mug: 49 } };
```

- [ ] **Step 2: Add the collage choice button** (oversize-only) after the ✏️ custom button at App.jsx:7352 — exact JSX from the previous plan revision:

```javascript
                  {selectedProduct === `oversized` && (
                  <button onClick={() => { setCommissionMode(true); setCommissionType(`collage`); setCommissionAck(false); }} style={{ flex: `1 1 150px`, textAlign: `start`, background: (commissionMode && commissionType === `collage`) ? `rgba(255,107,53,0.12)` : `transparent`, border: `2px solid ${(commissionMode && commissionType === `collage`) ? COLORS.accent : COLORS.border}`, borderRadius: 10, padding: `12px 14px`, cursor: `pointer`, fontFamily: `'Heebo',sans-serif` }}>
                    <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 13 }}>{t.commission.choiceCollage}</div>
                    <div style={{ color: COLORS.gray, fontSize: 11, marginTop: 3 }}>{t.commission.choiceCollageSub}</div>
                  </button>
                  )}
```

- [ ] **Step 3: Add collage state** near the other commission state (`commissionType` is at App.jsx:6204). Add:

```javascript
  const [collageStyle, setCollageStyle] = useState(`bw`);
  const [collageMode, setCollageMode] = useState(`celebrate`);
  const [collagePhrase, setCollagePhrase] = useState(``);
  const [collageSleeve, setCollageSleeve] = useState(false);
  const [collageYears, setCollageYears] = useState(``);
  const [petNames, setPetNames] = useState(``);
  const [petCount, setPetCount] = useState(1);
  const [setMug, setSetMug] = useState(false);
```

- [ ] **Step 4: Write `CollageOptions`** — a focused component rendering, inside the commission panel, the selectors: tee colour (reuse the existing `product.colors` swatch row), collage style (bw/color toggle), mode (celebrate/memory toggle — when `memory`, the phrase menu becomes `t.myCrew.memoryPhrases` and a years input shows), front phrase (chip menu from `t.myCrew.phraseOptions` / `memoryPhrases`), pet count + names input (with a helper line stating the naming rule: 1→one name, 2→`A & B`, 3+→`THE … CREW`), sleeve checkbox, the photo-guide collapsible (`t.myCrew.photoGuide`), the `1 OF 1` seal, and the **mug set-upsell checkbox** (`t.myCrew.setUpsellLabel`, toggles `setMug`). Mirror the styling idiom of the existing commission block (App.jsx:7354-7382) and `BloomShirtOptions`. Props: pass all the collage state + setters + `lang` + `t` + `product`.

- [ ] **Step 5: Render `CollageOptions` for the collage type** — in the `commissionMode &&` block (App.jsx:7354), branch: when `commissionType === 'collage'` render `<CollageOptions .../>`; else keep the existing colour/size block. Keep the existing ack checkbox + "how it works" line (already branched for collage in the original plan).

- [ ] **Step 6: Build** → `npm run build` → PASS.
- [ ] **Step 7: Live-verify** — Playwright on Preview: Oversize tee → "📸 Collage" button → CollageOptions renders all selectors; mode=memory swaps phrases + shows years; set-mug checkbox toggles; add button shows ₪169. he/en/ru, no console errors, no 390px overflow.
- [ ] **Step 8: Commit**

```bash
git add App.jsx
git commit -m "feat(my-crew): CollageOptions selector panel + collage option on oversize tee"
```

---

### Task 4: Capture choices → cart, order metadata, smart WhatsApp brief, set-mug line

**Files:**
- Modify `App.jsx:6246-6276` (`addCommissionToCart` — store collage choices on the cart item + push the set-mug second line).
- Modify `App.jsx:6936` (order INSERT `extra_prints` — persist collage choices).
- Modify the post-pay WhatsApp prefill (the `postPrefill(id)` / `customPostPrefill(id)` usage on the Track page, ~App.jsx:3662 region) — compose the smart brief.
- Modify cart-note lines `App.jsx:5871` and `App.jsx:10640` (surface `cartNoteCollage`).

**Interfaces:**
- Consumes: the Task 3 collage state.
- Produces: `extra_prints.collage = { style, mode, phrase, sleeve, years, petNames, petCount }` on the collage order row; a second cart line (`pid: 'mug'`, `ctype: 'collage'`) when `setMug`; a brief string appended to the WhatsApp prefill text.

- [ ] **Step 1: Cart-note for collage** — at App.jsx:5871 and 10640 change the ternary to include collage:

```javascript
{it.isCommission && <div style={{ color: COLORS.accent, fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>{(LANGS[lang] || LANGS.he).commission[it.commissionType === `collage` ? `cartNoteCollage` : (it.commissionType === `custom` ? `cartNoteCustom` : `cartNotePet`)]}</div>}
```
(apply with the local font size at 10640.)

- [ ] **Step 2: Store collage choices on the cart item** — in `addCommissionToCart` (App.jsx:6253 `itemData`), when `commissionType === 'collage'` attach:

```javascript
      collage: commissionType === `collage` ? { style: collageStyle, mode: collageMode, phrase: collagePhrase, sleeve: collageSleeve, years: collageYears, petNames, petCount } : null,
```

- [ ] **Step 3: Push the set-mug second line** — after the existing `setCart(c => [...c, {...}])` in `addCommissionToCart`, if `commissionType === 'collage' && setMug`, append a second cart item: `productId: 'mug'`, `commissionType: 'collage'`, `isCommission: true`, `unitPrice: 49`, `itemPrice: 49`, `collage: {...same...}`, a `variantId` matching the mug's sizeless variant. (Read the mug product entry in `PRODUCTS` for its variant id.)

- [ ] **Step 4: Persist to `extra_prints`** — at App.jsx:6936 add `collage` to the commission row's `extra_prints` object: `..., collage: it.collage || null`.

- [ ] **Step 4b: Admin badge** — find where the existing commission `adminBadge` ("BLOOM commission — awaiting photos") renders on the admin order card (grep `adminBadge`). Add a branch so a collage order shows `t.commission.adminBadgeCollage` instead, so the owner's queue clearly distinguishes a MY CREW photo-collage order from a BLOOM-portrait one.

- [ ] **Step 5: Smart WhatsApp brief** — find where the Track-page commission CTA builds the prefill (the `postPrefill(id)` calls near App.jsx:3662 / the strings at 2334/2405). Add a helper that, for a collage order, reads `extra_prints.collage` and appends a localized brief, e.g.:

```javascript
const collageBrief = (c, lang) => c ? `\n\n${(LANGS[lang]||LANGS.he).myCrew.briefLabel}\n• ${c.style === 'bw' ? 'B&W' : 'Color'} · ${c.mode === 'memory' ? '🤍' : '🎉'}${c.phrase ? ` · "${c.phrase}"` : ''}${c.petNames ? ` · ${c.petNames}` : ''}${c.sleeve ? ' · sleeve' : ''}${c.years ? ` · ${c.years}` : ''}` : ``;
```
Append `collageBrief(order.extra_prints?.collage, lang)` to the collage prefill text so the owner's WhatsApp opens with the full order brief.

- [ ] **Step 6: Build** → `npm run build` → PASS.
- [ ] **Step 7: Live-verify** — Playwright: place a collage order through to the Track page (use a guest/test flow without paying); confirm the cart note reads collage, and the "send photos on WhatsApp" link's prefilled text includes the brief line. Verify the set-mug adds a ₪49 line. he/en/ru.
- [ ] **Step 8: Commit**

```bash
git add App.jsx
git commit -m "feat(my-crew): persist collage choices + smart WhatsApp brief + mug set-upsell line"
```

---

### Task 5: `/collage` landing page

**Files:**
- Modify `App.jsx:10791` (`VALID_PAGES` — add `'collage'`).
- Create `function CollagePage({ lang, setPage })` near `MugsPage` (App.jsx:9482).
- Modify the page-switch render (where `page === 'mugs'` renders `MugsPage`).
- Modify `vercel.json` / verify `api/og.js` for the `/collage` route.

**Interfaces:** Consumes `lang`, `setPage`, `t.myCrew.*`. Produces a reachable `#collage` / `/collage` route.

- [ ] **Step 1:** Add `'collage'` to VALID_PAGES (App.jsx:10791), right after `'mugs'`.
- [ ] **Step 2:** Read `MugsPage` (App.jsx:9482) first, then write `CollagePage`: hero (`MY CREW` + `t.myCrew.subtitle` directly beneath — never the name alone), 1-2 showcase images (PLACEHOLDER — reuse an existing oversize mockup with a `{/* TODO: swap to real MY CREW collage photos */}` comment), the 3-step how-it-works (`t.myCrew.step1/2/3`) with `AboutIcon` icons (pawprint / palette / printer), the `1 OF 1` seal (`t.myCrew.oneOfOne`), the photo-guide, price line (`t.myCrew.priceLine`), and a CTA (`t.myCrew.cta`) → `setPage('order')`. Trilingual, RTL-safe.
- [ ] **Step 3:** Render `{page === \`collage\` && <CollagePage lang={lang} setPage={setPage} />}` beside the MugsPage branch.
- [ ] **Step 4:** Verify `vercel.json` rewrites unknown paths to the SPA (mirror `/mugs`); add a `/collage` rewrite if `/mugs` has an explicit one. No custom OG type needed (home OG is fine for Phase 1).
- [ ] **Step 5: Build** → `npm run build` → PASS.
- [ ] **Step 6: Live-verify** — `/#collage` renders hero+subtitle+steps+CTA he/en/ru; CTA opens order flow; no console errors; no 390px overflow.
- [ ] **Step 7: Commit**

```bash
git add App.jsx vercel.json
git commit -m "feat(my-crew): /collage MY CREW landing page"
```

---

### Task 6: Discovery — home showcase band + BLOOM cross-link

**Files:** Modify `App.jsx` — home band near `HomeMugsBanner` (App.jsx:9404); BLOOM cross-link in `PetsPage` (App.jsx:7721) or `PetModal`.

**Interfaces:** Consumes `setPage`, `t.myCrew.bandPitch` / `bloomCrosslink`. Produces two entry points into `/collage`.

- [ ] **Step 1:** Add a home showcase band mirroring `HomeMugsBanner` styling: `MY CREW` + subtitle + placeholder showcase image + `t.myCrew.bandPitch` + CTA → `setPage('collage')`. Use AboutIcon, not emoji. Render it in the home section near the mugs banner (wrap in the section's ScrollReveal if that's the local pattern).
- [ ] **Step 2:** Add a subtle BLOOM cross-link (`t.myCrew.bloomCrosslink`) in the PetsPage hero or PetModal → `setPage('collage')`. Keep it small/non-intrusive.
- [ ] **Step 3: Build** → `npm run build` → PASS.
- [ ] **Step 4: Live-verify** — home band visible + routes to /collage; BLOOM cross-link visible on /pets + routes. he/en/ru, no console errors, no overflow.
- [ ] **Step 5: Commit**

```bash
git add App.jsx
git commit -m "feat(my-crew): home showcase band + BLOOM cross-link to /collage"
```

---

### Task 7: SEO — sitemap + blog internal links

**Files:** `public/sitemap.xml`; `supabase/functions/generate-sitemap/index.ts`; (owner-gated) `blog_posts` DB rows.

- [ ] **Step 1:** Add `/collage` to `public/sitemap.xml` (mirror the `/mugs` `<url>`, priority 0.8).
- [ ] **Step 2:** Add `/collage` to the `staticUrls` array in `generate-sitemap`.
- [ ] **Step 3: Build** → `npm run build` → PASS.
- [ ] **Step 4: STOP — owner approval** for the blog `blog_posts` internal-link UPDATEs + the `generate-sitemap` edge-fn deploy (both are prod content/infra). Report in Russian, wait.
- [ ] **Step 5: Commit the code part**

```bash
git add public/sitemap.xml supabase/functions/generate-sitemap/index.ts
git commit -m "seo(my-crew): add /collage to sitemap + generate-sitemap"
```

---

### Task 8: Final review + deploy gate

- [ ] **Step 1:** Full `npm run build` → PASS.
- [ ] **Step 2:** Playwright 390px he/en/ru: `/collage`, home band, order-flow collage option + CollageOptions, set-mug line — no overflow, no console errors, CTAs keyboard-reachable, RTL correct.
- [ ] **Step 3:** Confirm `create-payment` (Task 1) is LIVE before the client collage option reaches `main`.
- [ ] **Step 4: STOP — report to owner in Russian; do NOT merge to `main`.** Summarize what shipped on `launch-prep`; note showcase uses placeholder photos pending real shots; list owner items: (a) real MY CREW photos to swap placeholders, (b) approve blog internal links, (c) request GSC indexing for `/collage`, (d) approve merge to production + deploy.

---

## Self-Review Notes

- **Spec coverage:** §2 anatomy (back/front/sleeve) → captured as metadata (phrase=front, sleeve toggle, collage=back) Tasks 3-4. §3 customization (colour/style/phrase/multi-pet naming rule) → CollageOptions Task 3 + naming-rule helper. §4 included → copy in Tasks 2/5. §5 extensions: 1-of-1 → seal (Tasks 3,5); Set bundle → mug set-upsell (Tasks 1,3,4); in-memory → mode toggle (Tasks 2,3). §6 pricing ₪169 / +₪49 → Tasks 1,3,4. §7 journey → Tasks 3-4 (selectors→pay→WhatsApp brief→approval reuses existing commission approval). §8 all-in site build → Tasks 3-7. §9 marketing → owner/ramkol (out of code scope). §10 blockers → placeholder strategy (Tasks 5,6) + owner handoff (Task 8).
- **Placeholder scan:** only intentional placeholder = showcase imagery (real photos pending), flagged with TODO comments + owner handoff. No silent gaps.
- **Type/name consistency:** `collage` used identically as `ctype`/`commissionType` across client (`COMMISSION_PRICE`, state, `extra_prints.ctype`/`.collage`) and server (`CPRICE`). Collage choice state names (`collageStyle`/`collageMode`/`collagePhrase`/`collageSleeve`/`collageYears`/`petNames`/`petCount`/`setMug`) are defined in Task 3 Step 3 and consumed verbatim in Task 4. Mug set line uses the SAME `collage` payload object.
- **OUT of scope, intentionally:** live collage constructor; tote/socks set variants.
