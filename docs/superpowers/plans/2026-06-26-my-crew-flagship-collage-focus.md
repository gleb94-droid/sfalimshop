# MY CREW Flagship / Collage-Focus — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (INLINE execution — one agent edits `App.jsx`; **no subagents**, per the project rule "only one agent edits App.jsx at a time"). Steps use checkbox (`- [ ]`) syntax. There is **no unit-test harness**; "verify" = `npm run build` + targeted live-browser DOM check.

**Goal:** Make MY CREW (the ₪169 pet photo-collage tee) the unmistakable flagship — strengthen brand surfaces (home hero, nav, home SEO/OG) and deepen `/collage` (reveal-video slot, loud guarantee, In-Memory occasion, gift occasions), without touching payment/price or weakening mug/BLOOM.

**Architecture:** Additive UI/copy edits to existing components in single-file `App.jsx` (+ `index.html` static head). New trilingual keys under `LANGS[lang].myCrew`. One new small inline component `MyCrewReveal`. No DB / edge-function / price changes.

**Tech Stack:** React 18 + Vite 4.5 (esbuild 0.18). Branch `launch-prep`.

## Global Constraints

- **Template literals only** (esbuild 0.18) — never `"a" + b`.
- **Trilingual he/en/ru** for every user-facing string, under `LANGS[lang].myCrew`. Hebrew RTL-primary.
- **RTL:** inside `dir="rtl"` use plain `flexDirection: 'row'` (NOT `isRTL ? 'row-reverse' : 'row'` — double-flip bug); use `←/→` chosen by `isRTL`; logical props `insetInlineStart/End`.
- **Never the word "free"** (`free / חינם / бесплатно`) — use "included / כלול / включено" or "no extra cost / ללא עלות".
- **UI icons via `AboutIcon`, not emoji** (🤍 in the In-Memory label is the existing allowed exception).
- **Never claim the artwork is hand-drawn.** "hand-printed / מודפס בעבודת יד / печать вручную" is allowed.
- **No CLS:** every image/video gets a reserved aspect-ratio box.
- **Graceful asset fallback:** reveal video falls back to the worn-tee poster image when the file is absent.
- **No payment/price/DB/edge-fn changes.** ₪169 untouched. `create-payment` untouched.
- **No commit to `main`, no deploy** without explicit owner approval. Commits land on `launch-prep`; owner (non-coder) approves before any commit/deploy — batch and ask.

---

### Task 1: New trilingual copy keys (`LANGS.myCrew`)

**Files:** Modify `App.jsx` — he block ends at line ~2333 (`faq: [ … ],` then `},`), en ~2471, ru ~2609. Add the new keys just **before** the closing `},` of each `myCrew` object (i.e., right after the existing `faq: [...]` array).

**Interfaces — Produces** (consumed by Tasks 2–4): `myCrew.videoAlt`, `myCrew.guaranteeTitle`, `myCrew.guarantee` (array of 3 strings), `myCrew.occasionsTitle`, `myCrew.occasions` (array of 4 strings), `myCrew.memoryTitle`, `myCrew.memoryText`, `myCrew.memoryCta`.

- [ ] **Step 1: Add keys to the `he` myCrew object** (after the `faq: [...]` array, before `},` at ~line 2333):

```js
      videoAlt: `MY CREW על החולצה — סרטון`,
      guaranteeTitle: `ההבטחה שלנו`,
      guarantee: [
        `משלמים — ואנחנו מעצבים את הקולאז' מהתמונות שלכם`,
        `מאשרים את העיצוב לפני ההדפסה — תיקונים עד שתאהבו`,
        `לא יצא מושלם? מחזירים את הכסף לפני ההדפסה`,
      ],
      occasionsTitle: `מתנה מושלמת לכל רגע`,
      occasions: [`יום הולדת`, `יום האימוץ`, `מתנה לאוהב/ת חיות`, `סתם כי מגיע`],
      memoryTitle: `לזכר חבר אמיתי 🤍`,
      memoryText: `הקולאז' שומר אותם קרוב — חולצת מחווה עדינה מהתמונות האהובות. מעצבים בעדינות, ומאשרים יחד לפני ההדפסה.`,
      memoryCta: `ליצירת חולצת זיכרון`,
```

- [ ] **Step 2: Add the same keys to the `en` myCrew object** (after its `faq: [...]`, ~line 2471):

```js
      videoAlt: `MY CREW on the tee — video`,
      guaranteeTitle: `Our promise`,
      guarantee: [
        `You pay — and we design your collage from your photos`,
        `You approve the design before we print — revisions until you love it`,
        `Not perfect? Money back before we print`,
      ],
      occasionsTitle: `The perfect gift for any moment`,
      occasions: [`Birthday`, `Gotcha day`, `For a pet-lover`, `Just because`],
      memoryTitle: `In memory of a true friend 🤍`,
      memoryText: `Keep them close — a gentle tribute tee from your favourite photos. Designed with care, and approved together before we print.`,
      memoryCta: `Create a memorial tee`,
```

- [ ] **Step 3: Add the same keys to the `ru` myCrew object** (after its `faq: [...]`, ~line 2609):

```js
      videoAlt: `MY CREW на футболке — видео`,
      guaranteeTitle: `Наша гарантия`,
      guarantee: [
        `Вы платите — и мы создаём коллаж из ваших фото`,
        `Вы утверждаете дизайн до печати — правки, пока не понравится`,
        `Не идеально? Вернём деньги до печати`,
      ],
      occasionsTitle: `Идеальный подарок на любой повод`,
      occasions: [`День рождения`, `Из приюта`, `Другу-зооману`, `Просто так`],
      memoryTitle: `В память о настоящем друге 🤍`,
      memoryText: `Сохраните их рядом — деликатная футболка-память из любимых фото. Создаём бережно и утверждаем вместе перед печатью.`,
      memoryCta: `Создать футболку-память`,
```

- [ ] **Step 4: Verify build.** Run `npm run build` → expect success. Then `grep -n "guaranteeTitle" App.jsx` → expect 3 matches (he/en/ru).

---

### Task 2: `MyCrewReveal` component + use in `/collage` hero and home hero

**Files:** Modify `App.jsx` — add component just **above** `function HomeMyCrewHero` (~line 9790, before its leading comment); edit `HomeMyCrewHero` visual (~line 9839); edit `CollagePage` hero (insert after the 1 OF 1 seal block, ~line 10180, just before the `{/* SHOWCASE … */}` section).

**Interfaces — Consumes:** `myCrew.videoAlt` (Task 1). **Produces:** `MyCrewReveal({ poster, alt, radius, maxWidth })`.

- [ ] **Step 1: Add the `MyCrewReveal` component** immediately before the `// HomeMyCrewBand — …` comment at ~line 9790:

```jsx
// MyCrewReveal — the reveal video for MY CREW (turn-around in the tee).
// Graceful: reserves a 4/5 box (no CLS); falls back to the worn-tee POSTER
// image when the video file is absent/errors or under reduced-motion. The
// poster image always exists, so something always renders even before the
// owner uploads /my-crew/reveal.mp4. Muted autoplay is allowed without a gesture.
function MyCrewReveal({ poster = `/my-crew/mycrew-worn-1.webp`, alt = `MY CREW`, radius = 18, eager = false }) {
  const [failed, setFailed] = useState(false);
  const reduce = typeof window !== `undefined` && window.matchMedia
    ? window.matchMedia(`(prefers-reduced-motion: reduce)`).matches : false;
  const box = { position: `relative`, width: `100%`, aspectRatio: `4 / 5`, borderRadius: radius, overflow: `hidden`, background: COLORS.bgCard, display: `block` };
  const media = { width: `100%`, height: `100%`, objectFit: `cover`, display: `block` };
  if (failed || reduce) {
    return (
      <div style={box}>
        <img src={poster} alt={alt} loading={eager ? `eager` : `lazy`} decoding="async" style={media} />
      </div>
    );
  }
  return (
    <div style={box}>
      <video autoPlay loop muted playsInline preload="metadata" poster={poster} aria-label={alt}
        onError={() => setFailed(true)} style={media}>
        <source src={`/my-crew/reveal.webm`} type="video/webm" />
        <source src={`/my-crew/reveal.mp4`} type="video/mp4" />
      </video>
    </div>
  );
}
```

- [ ] **Step 2: Use it in `HomeMyCrewHero`'s main visual.** Replace the single `<img …>` at ~line 9839 (the one with `alt={mc.name}` inside the glow wrapper) with:

```jsx
            <div style={{ position: `relative`, zIndex: 1, filter: `drop-shadow(0 18px 36px rgba(0,0,0,0.5))` }}>
              <MyCrewReveal poster={shots[0]} alt={mc.videoAlt} radius={18} eager />
            </div>
```

(Keep the surrounding glow `<div aria-hidden>` and the `maxWidth` wrapper unchanged.)

- [ ] **Step 3: Insert the reveal in `CollagePage` hero.** After the 1 OF 1 seal `<div>` closes and the HERO `</section>` ends (~line 10180), and before `{/* SHOWCASE … */}`, add a new section:

```jsx
      {/* REVEAL — the strongest proof: the tee in motion (graceful to poster) */}
      <section style={{ ...sectionStyle, paddingTop: 0, paddingBottom: isMobile ? 18 : 28 }}>
        <div style={{ maxWidth: 360, margin: `0 auto` }}>
          <MyCrewReveal poster={`/my-crew/mycrew-worn-1.webp`} alt={t.videoAlt} radius={18} eager />
        </div>
      </section>
```

- [ ] **Step 4: Verify build + browser.** `npm run build` → success. Load `/collage`: a 4/5 media box shows at the top (poster image, since no video file yet); **0 console errors**; no layout shift. Home: MY CREW hero shows the same media box. Reduced-motion (DevTools "Emulate prefers-reduced-motion") → shows the poster image, no `<video>`.

---

### Task 3: Loud Guarantee section (+ social proof up to 2)

**Files:** Modify `App.jsx` `CollagePage` — insert a GUARANTEE section immediately **before** the `{/* PRICE + CTA */}` section (~line 10300); widen the testimonial fetch to keep up to 2 relevant reviews (~lines 10122–10140 + the SOCIAL PROOF render ~10276).

**Interfaces — Consumes:** `myCrew.guaranteeTitle`, `myCrew.guarantee[]` (Task 1).

- [ ] **Step 1: Insert the GUARANTEE section** right before `{/* PRICE + CTA */}` (~line 10300):

```jsx
      {/* GUARANTEE — the loud objection-buster, right before the price */}
      <section style={{ ...sectionStyle, paddingTop: isMobile ? 28 : 44, paddingBottom: 0 }}>
        <div style={{ background: `linear-gradient(160deg, rgba(255,107,53,0.10), rgba(255,107,53,0.02))`, border: `1px solid rgba(255,107,53,0.28)`, borderRadius: 18, padding: isMobile ? `24px 18px` : `30px 28px`, maxWidth: 620, margin: `0 auto` }}>
          <h2 style={{ fontFamily: `'Playfair Display','Frank Ruhl Libre',serif`, fontWeight: 800, fontSize: `clamp(20px,3.8vw,28px)`, textAlign: `center`, margin: `0 0 18px`, display: `flex`, alignItems: `center`, justifyContent: `center`, gap: 10 }}>
            <AboutIcon name="sparkles" size={22} color={COLORS.accent} />
            {t.guaranteeTitle}
          </h2>
          <ul role="list" style={{ listStyle: `none`, margin: 0, padding: 0, display: `flex`, flexDirection: `column`, gap: 14 }}>
            {(t.guarantee || []).map((g, i) => (
              <li key={i} style={{ display: `flex`, alignItems: `flex-start`, gap: 12, color: COLORS.white, fontFamily: `'Heebo',sans-serif`, fontSize: 15.5, fontWeight: 600, lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, display: `inline-flex`, alignItems: `center`, justifyContent: `center`, width: 26, height: 26, borderRadius: `50%`, background: COLORS.accentDim, color: COLORS.accent, fontWeight: 800, fontSize: 13, fontFamily: `'Heebo',sans-serif` }}>{`0${i + 1}`}</span>
                {g}
              </li>
            ))}
          </ul>
        </div>
      </section>
```

- [ ] **Step 2: Keep up to 2 reviews.** Change the testimonial effect (~line 10134–10136) from picking one to keeping up to 2 relevant ones. Replace:

```jsx
        const rx = /(קולאז|collage|коллаж|חולצה|shirt|футбол)/i;
        const pick = data.find(r => rx.test(`${r.product || ``} ${r.body_he || ``} ${r.body_en || ``} ${r.body_ru || ``}`)) || data[0];
        if (!cancelled) setReview(pick);
```

with:

```jsx
        const rx = /(קולאז|collage|коллаж|חולצה|shirt|футбол)/i;
        const ranked = [...data].sort((a, b) => {
          const am = rx.test(`${a.product || ``} ${a.body_he || ``} ${a.body_en || ``} ${a.body_ru || ``}`) ? 0 : 1;
          const bm = rx.test(`${b.product || ``} ${b.body_he || ``} ${b.body_en || ``} ${b.body_ru || ``}`) ? 0 : 1;
          return am - bm;
        });
        if (!cancelled) setReview(ranked.slice(0, 2));
```

Change the state init (~line 10122) `const [review, setReview] = useState(null);` → `const [review, setReview] = useState([]);`

- [ ] **Step 3: Render up to 2 reviews.** Replace the SOCIAL PROOF block (`{review && ( <section> … one <article> … </section> )}` at ~10276–10298) so it maps the array: wrap in `{review.length > 0 && (` , and render `review.map((rv, idx) => ( <article key={idx} …> … ))` reusing the existing `<article>` markup with `rv` in place of `review` (use `rv.rating`, `rv[\`body_${lang}\`]`, `rv.author_*`, `rv.product`). Stack them with `gap:14` inside the section; cap section content `maxWidth: 560`.

- [ ] **Step 4: Verify build + browser.** `npm run build` → success. `/collage`: GUARANTEE section renders above the price in he/en/ru; Hebrew numbers `01/02/03` read right-to-left correctly; testimonial area shows the available real review(s) (1 today), **no fake placeholders**; 0 console errors.

---

### Task 4: Occasions — gift strip + In-Memory block

**Files:** Modify `App.jsx` `CollagePage` — insert GIFT-OCCASIONS strip after the `{/* HOW IT WORKS … */}` section (~line 10238), and the IN-MEMORY block after the `{/* VALUE STACK … */}` section (~line 10273, before `{/* SOCIAL PROOF … */}`).

**Interfaces — Consumes:** `myCrew.occasionsTitle`, `myCrew.occasions[]`, `myCrew.memoryTitle`, `myCrew.memoryText`, `myCrew.memoryCta` (Task 1).

- [ ] **Step 1: Insert GIFT-OCCASIONS strip** after the HOW IT WORKS `</section>` (~line 10238):

```jsx
      {/* GIFT OCCASIONS — frames MY CREW as THE pet-lover gift */}
      <section style={{ ...sectionStyle, paddingTop: isMobile ? 8 : 16, paddingBottom: isMobile ? 16 : 28 }}>
        <h3 style={{ fontFamily: `'Playfair Display','Frank Ruhl Libre',serif`, fontWeight: 800, fontSize: `clamp(18px,3.4vw,26px)`, textAlign: `center`, margin: `0 0 18px` }}>
          {t.occasionsTitle}
        </h3>
        <div style={{ display: `grid`, gridTemplateColumns: isMobile ? `repeat(2, 1fr)` : `repeat(4, 1fr)`, gap: 10, maxWidth: 720, margin: `0 auto` }}>
          {(t.occasions || []).map((label, i) => {
            const icon = [`gift`, `pawprint`, `heart`, `sparkles`][i] || `pawprint`;
            return (
              <div key={i} style={{ display: `flex`, flexDirection: `column`, alignItems: `center`, gap: 8, background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: isMobile ? `16px 10px` : `18px 14px`, textAlign: `center` }}>
                <span style={{ display: `inline-flex`, alignItems: `center`, justifyContent: `center`, width: 40, height: 40, borderRadius: 10, background: COLORS.accentDim }}>
                  <AboutIcon name={icon} size={20} color={COLORS.accent} />
                </span>
                <span style={{ fontFamily: `'Heebo',sans-serif`, fontSize: 13.5, fontWeight: 600, color: COLORS.white, lineHeight: 1.35 }}>{label}</span>
              </div>
            );
          })}
        </div>
      </section>
```

- [ ] **Step 2: Insert IN-MEMORY block** after the VALUE STACK `</section>` (~line 10273), before `{/* SOCIAL PROOF … */}`:

```jsx
      {/* IN MEMORY — the highest-emotion occasion, calm & respectful */}
      <section style={{ ...sectionStyle, paddingTop: isMobile ? 24 : 36, paddingBottom: 0 }}>
        <div style={{ background: `linear-gradient(160deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))`, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: isMobile ? `24px 20px` : `30px 30px`, maxWidth: 560, margin: `0 auto`, textAlign: `center`, display: `flex`, flexDirection: `column`, alignItems: `center`, gap: 12 }}>
          <h3 style={{ fontFamily: `'Playfair Display','Frank Ruhl Libre',serif`, fontWeight: 700, fontSize: `clamp(19px,3.4vw,26px)`, color: COLORS.white, margin: 0 }}>{t.memoryTitle}</h3>
          <p style={{ fontFamily: `'Heebo',sans-serif`, fontSize: isMobile ? 14.5 : 16, lineHeight: 1.7, color: COLORS.gray, margin: 0, maxWidth: 440 }}>{t.memoryText}</p>
          <button type="button" onClick={() => (goToCollage ? goToCollage() : setPage(`order`))} style={{ display: `inline-flex`, alignItems: `center`, gap: 8, background: `transparent`, color: COLORS.accent, border: `1.5px solid ${COLORS.accent}`, borderRadius: 10, padding: `11px 22px`, fontSize: 14.5, fontWeight: 700, fontFamily: `'Heebo',sans-serif`, cursor: `pointer`, transition: `all 0.2s` }}
            onMouseOver={e => { e.currentTarget.style.background = COLORS.accentDim; }}
            onMouseOut={e => { e.currentTarget.style.background = `transparent`; }}>
            {t.memoryCta} {isRTL ? `←` : `→`}
          </button>
        </div>
      </section>
```

- [ ] **Step 3: Verify build + browser.** `npm run build` → success. `/collage` he/en/ru: gift strip (4 tiles, 2×2 on mobile) after How-it-works; In-Memory block after value-stack with the 🤍 title; tones read correctly (playful gifts vs calm memorial, separated); arrows correct in Hebrew; 0 console errors.

---

### Task 5: Nav — MY CREW first content slot + subtle emphasis

**Files:** Modify `App.jsx` `Nav` — desktop array (line ~10503) and mobile array (line ~10574); add a subtle weight for `collage`.

- [ ] **Step 1: Reorder desktop nav.** At ~line 10503 change `["home", "mugs", "pets", "collage", "order", "about"]` → `["home", "collage", "mugs", "pets", "order", "about"]`.

- [ ] **Step 2: Subtle emphasis for collage (desktop).** In the same desktop `.map` button style (~line 10510), bump weight for collage. Change `fontWeight: p === "pets" ? 700 : 500,` → `fontWeight: (p === "pets" || p === "collage") ? 700 : 500,`. (Leave font-family/italic special-casing to `pets` only.)

- [ ] **Step 3: Reorder mobile nav.** At ~line 10574 change `["home", "mugs", "pets", "collage", "order", "about"]` → `["home", "collage", "mugs", "pets", "order", "about"]`. In the mobile button style, change `fontWeight: p === "pets" ? 700 : 500` → `fontWeight: (p === "pets" || p === "collage") ? 700 : 500`.

- [ ] **Step 4: Verify build + browser.** `npm run build` → success. Desktop nav order: Home · MY CREW · Mugs · BLOOM · Order · About; MY CREW slightly bolder. Mobile menu same order. `aria-current` still highlights the active page. 0 console errors.

---

### Task 6: Home SEO/OG leads with MY CREW

**Files:** Modify `App.jsx` runtime titles (he ~12018, en ~12029, ru ~12040) + add `home` to `VIEW_SEO_DESC` (he ~16294, en ~16301, ru ~16308); modify `index.html` head (lines 10–12, 27–28, 42–43).

- [ ] **Step 1: Runtime home titles.** Replace the three `home:` title lines:
  - he (~12018): `home:     "MY CREW · ספלים שופ | קולאז' מהחיות שלך על חולצה",`
  - en (~12029): `home:     "MY CREW · Sfalim Shop | Your pets as a streetwear collage tee",`
  - ru (~12040): `home:     "MY CREW · Sfalim Shop | Коллаж с вашими питомцами на футболке",`

- [ ] **Step 2: Add `home` to VIEW_SEO_DESC.** Add a `home:` line at the top of each language object in `VIEW_SEO_DESC` (~16288 he, ~16295 en, ~16302 ru):
  - he: `home: \`MY CREW — קולאז' סטריטוויר מהתמונות האמיתיות של החיות שלכם על חולצת אוברסייז. 1 מתוך 1, אישור עיצוב לפני הדפסה, מודפס בעבודת יד בבאר שבע.\`,`
  - en: `home: \`MY CREW — a streetwear collage of your real pets on an oversize tee. 1 of 1, you approve the design before we print, hand-printed in Be'er Sheva.\`,`
  - ru: `home: \`MY CREW — уличный коллаж из реальных фото ваших питомцев на оверсайз-футболке. 1 of 1, утверждение дизайна до печати, печать вручную в Беэр-Шеве.\`,`

- [ ] **Step 3: index.html static head (default = Hebrew, leads with MY CREW; keep brand + breadth).** Edit:
  - line 10 `<title>` and line 11 `<meta name="title">` content → `MY CREW · ספלים שופ | קולאז' מהחיות שלך על חולצה`
  - line 12 `<meta name="description">` → `MY CREW — קולאז' סטריטוויר מהתמונות האמיתיות של החיות שלכם על חולצת אוברסייז. 1 מתוך 1, אישור עיצוב לפני הדפסה. גם ספלים, חולצות ומדבקות — מודפס בעבודת יד בבאר שבע.`
  - line 13 `<meta name="keywords">` → append `, MY CREW, קולאז' חיות, חולצת פטים, מתנה לאוהבי כלבים, חולצה עם החתול שלך`
  - line 27 `og:title` → `MY CREW · ספלים שופ | קולאז' מהחיות שלך על חולצה`
  - line 28 `og:description` → same text as the new description (line 12).
  - line 42 `twitter:title` → same as og:title.
  - line 43 `twitter:description` → `MY CREW — קולאז' מהתמונות האמיתיות של החיות שלכם על חולצת אוברסייז. 1 מתוך 1.`
  - **Leave `og:image` / `twitter:image` = `/og-image.png`** (root brand card; the MY CREW-specific `og-collage.jpg` stays on `/collage`). **Do not touch** robots/googlebot/bingbot, facebook-domain-verification, canonical, hreflang.

- [ ] **Step 4: Verify build + browser.** `npm run build` → success. On `/` (home) check `document.title` starts with `MY CREW` in he/en/ru (switch language). Navigate to `/mugs`, `/pets`, `/about`, `/collage` and confirm their titles are **unchanged** (no regression). 0 console errors.

---

## Self-Review

**Spec coverage:** A1 home hero → Task 2 (+6 SEO). A2 nav → Task 5. A3 home SEO/OG → Task 6. B1 reveal video → Task 2. B2 guarantee → Task 3. B3 In-Memory → Task 4. B4 gift occasions → Task 4. B5 more proof → Task 3 (up-to-2 reviews) + extra example files are asset-only (arrays already accept them, no code task). D price → untouched (Global Constraints). All covered.

**Placeholder scan:** No TBD/TODO; every code step has complete code; every string is given verbatim in he/en/ru. Line numbers are "~approx" (App.jsx drifts) — locate by the quoted anchor text, not the number.

**Type consistency:** `MyCrewReveal` props (`poster`, `alt`, `radius`, `eager`) match all three call sites. `review` state changes from a single object to an array consistently (init `[]`, set `slice(0,2)`, render `.map`, guard `review.length > 0`). New copy keys used in Tasks 2–4 all exist after Task 1. Nav arrays identical in both call sites.

**Order of execution:** Task 1 first (copy contract). Tasks 2–6 each independently build + verify. A single owner-approved commit (or a few) lands on `launch-prep` after Gleb reviews — no deploy without approval.
