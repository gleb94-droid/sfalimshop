# MY CREW Flagship — Collage-Focus Phase (Design Spec)

> **Status:** approved by owner (Gleb) 2026-06-26. Research-first → flagship + brand-lean pivot.
> **Scope of THIS spec:** site code only (Workstreams A + B + D). The content engine (Workstream C) is handled separately as marketing docs, not code.

**Goal:** Make **MY CREW** (the custom pet **photo-collage tee**, ₪169) the unmistakable flagship of sfalimshop — strengthen its presence across the brand surfaces and deepen the `/collage` page for conversion, **without** weakening the proven mug / BLOOM products and **without** touching any payment code.

**Architecture:** Single-file React app (`App.jsx`, inline styles, template literals only). All changes are additive UI/copy/layout edits to existing components (`CollagePage`, `HomeMyCrewHero`, `Nav`, home SEO) plus new trilingual keys under `LANGS[lang].myCrew`. No DB changes, no edge-function changes, no price changes. The collage product already exists end-to-end (commission `collage` type, server price live in `create-payment` v25: shirt ₪169 / set-mug ₪49).

**Tech Stack:** React 18 + Vite 4.5 (esbuild 0.18 — template literals only). Verification = `npm run build` + live-browser checks (he/en/ru, RTL, console, broken-image, CLS). No unit-test harness exists in this project.

---

## Research summary (what drove the decisions)

- **Proven market:** custom pet products = **$8.5B (2025), +8.4%/yr, 60%+ owners prefer personalized**. The exact "your pets photo-collage on a tee" is sold by many players (Threadheads, Chic Kitty, Pawshaped, Petfiestas, Pop Your Pup, Etsy).
- **Price position:** main direct competitor **Threadheads = $29 (~₪110)** but it's a **self-serve auto-builder** (upload → auto background-removal → live preview → buy). West & Willow = $59–159. **Our ₪169 is a premium-bespoke position** (hand-designed, human designer, revisions, 1-of-1, local/Israel, no customs, Hebrew, WhatsApp). **We do not compete on price or automation — our moat is hand-crafted bespoke + personal touch.**
- **#1 conversion barrier = blind prepay.** Competitors that win let the buyer SEE their pets on the shirt before paying. Building an auto-builder is **out of scope** (huge effort, kills the bespoke model, doesn't scale for a solo founder). **Owner-chosen solution = a LOUD guarantee** (approve the mockup before we print · revisions until you're happy · money-back before print). The approval-before-print step already exists in the commission flow — this phase makes it **visible and persuasive**.
- **Strongest emotional/gift angle = "In Memory"** (pet-memorial gifts is a large, low-price-sensitivity category). The `in-memory` mode already exists in `CollageOptions` but is buried — surface it as a featured, tasteful occasion.
- **Gift occasions** broadly: birthday · "gotcha day" (adoption anniversary) · in-memory · gift for the pet-obsessed friend.
- **What converts on competitor pages:** video proof + many real examples, large review counts, made-to-order + fast shipping, fabric quality.

---

## Locked decisions

1. **Funnel:** keep **pay-first**; solve blind-prepay with a **loud guarantee** (no auto-builder, no free-mockup-before-pay, no deposit split).
2. **Brand pivot depth:** **"strong flagship," not a destructive rebrand.** MY CREW becomes clearly #1 where it matters (home hero, nav primacy, home SEO/OG lead). Mug / BLOOM products keep their own pages and home presence below MY CREW.
3. **Price:** ₪169 unchanged. No `create-payment` / pricing changes.
4. **Assets owner-supplied, code degrades gracefully:** reveal video + extra example photos + extra testimonials are provided by the owner later; every component that uses them must render cleanly (and hide the relevant element) when the asset is absent, so we can ship code before the assets land.

---

## Surfaces touched

| Surface | File / location | Change |
|---|---|---|
| Home hero | `HomeMyCrewHero` (App.jsx ~9794) | Strengthen as the flagship: sharper headline, optional reveal-video slot, flagship feel. |
| Home SEO/OG | home route SEO setter (investigate: `setGenericSeo` / index.html default) | Lead home title + description (+ og) with the MY CREW promise; keep mugs/portraits for breadth. Must not break per-route canonicals/titles on other pages. |
| Nav | `Nav` (App.jsx ~10394) | Move **MY CREW** to the first primary content slot; subtle visual primacy. Desktop + mobile. |
| Collage page | `CollagePage` (App.jsx ~10098) | Add: reveal-video hero slot (graceful), loud **Guarantee** section + CTA trust line, **In Memory** featured occasion, **gift-occasions** strip, room for more examples / 2nd–3rd testimonial. |
| Copy | `LANGS[lang].myCrew` (he ~2273 / en ~2411 / ru ~2549) | New trilingual keys for guarantee, in-memory, occasions, video caption, etc. |
| Collage OG (optional) | `api/og.js` `buildCollageHtml` | Only if the home/OG positioning changes the crawler copy; otherwise untouched. |

---

## Workstream A — Brand pivot (strong flagship)

**A1. Home hero emphasis.** `HomeMyCrewHero` is already the first home block. Strengthen it: a sharper flagship headline/subhead, a clear "₪169 · 1 OF 1 · designed by us from your photos" promise, primary CTA to `/collage`. Add a **reveal-video slot** in the hero (see B1) that gracefully falls back to the existing worn-tee image when no video file is present. Keep all existing home blocks (BLOOM carousel, mugs banner, events, reviews) **below**, unchanged.

**A2. Nav primacy.** In `Nav`, reorder the content links so **MY CREW** is the first item (before Mugs / Pets), in both desktop and the mobile menu. Optional subtle emphasis (e.g., accent dot / weight) — must stay accessible (current aria/landmark structure preserved). No new routes (the `#collage` route already exists).

**A3. Home SEO/OG lead.** Update the **home** route's `<title>` / meta description / `og:title` / `og:description` to lead with the MY CREW promise (e.g., "Your real crew on a tee — hand-designed from your pet photos · ספלים שופ"), while retaining mug/portrait terms for search breadth. **Constraint:** change the HOME route only; do not regress the real per-route canonical/title/og work already in place for `/mugs /pets /about /collage /order /blog` etc. Investigate how home SEO is currently set before editing.

---

## Workstream B — `/collage` page deepening (conversion)

**B1. Reveal-video hero slot (graceful).** A reusable inline `<video>` (muted, `autoPlay`, `loop`, `playsInline`, `preload="metadata"`, no controls, `poster` = first worn image) shown at the top of `/collage` (and reused in the home hero per A1). Source path is a known constant (e.g. `/my-crew/reveal.mp4`, optionally `.webm`). **Graceful fallback:** if the file is missing/errors (`onError`), fall back to the existing worn-tee `SmartImage`. Respect `reduceMotion` (don't autoplay; show poster) where the page already has that signal; otherwise default to muted autoplay which is allowed. Lazy/`decoding` set for performance; reserve aspect-ratio box so it **adds no CLS**.

**B2. Loud Guarantee section.** A prominent, visually distinct section near the price/CTA that states the promise in 3 beats:
- you pay → **we design** your collage from your photos,
- **you approve the mockup BEFORE we print** (revisions until you're happy),
- **money-back before print** if we can't make you love it.
Plus a compact trust line right at the CTA (the existing `trustApprove` line can be folded/expanded). **Copy rules:** trilingual; **never the word "free"** — use "included / כלול / включено"; do **not** promise refunds after a printed/approved item (scope the money-back to before-print to stay consistent with the made-to-order refund policy). Icon set via `AboutIcon` (no emoji in UI chrome; 🤍 is allowed only as part of the In-Memory mode label, matching existing usage).

**B3. "In Memory" featured occasion.** A tasteful, optional block on `/collage` that names the memorial use case ("keep them with you · a tribute tee 🤍") and links into the flow (the `in-memory` mode already exists in `CollageOptions`). Respectful tone, trilingual, muted/elegant styling (not salesy). It complements — does not replace — the celebrate angle.

**B4. Gift-occasions strip.** A small trilingual strip of occasions — birthday · gotcha day (adoption anniversary) · in-memory · gift for a pet-lover — framing MY CREW as **the** pet-person gift. Icons via `AboutIcon`. Reinforces the "send this to a friend" share mechanic.

**B5. More proof (asset-driven, graceful).** Structure the existing showcase / transformation to accept additional owner-supplied worn examples (cat + dog), and the testimonial block to show up to 2–3 real reviews when present (currently shows one). All must hide gracefully when assets/rows are absent — **no placeholders, no fake reviews.**

---

## Workstream D — Price

No change. ₪169 stays. Documented here only to prevent accidental edits to price strings or `create-payment`.

---

## Out of scope (explicitly)

- **No auto-builder / live preview tool** (off-model, huge effort).
- **No free-mockup-before-pay and no deposit-split funnel** (owner chose the loud-guarantee path).
- **No payment / pricing / edge-function / DB changes.** `create-payment` v25 and the server price are untouched.
- **No destructive rebrand** — mug / BLOOM pages and their home presence remain.
- **Content engine (Workstream C)** — reels/scripts/calendar — is a separate marketing-docs deliverable, not part of this spec.
- **Real asset production** (shooting/editing the video & photos) — owner supplies; this spec only builds the slots that consume them.

---

## Constraints (global — every task inherits these)

- **Template literals only** (esbuild 0.18) — never `"a" + b`.
- **Trilingual he/en/ru** for every user-facing string, added under `LANGS[lang].myCrew` (or the appropriate existing dict). Hebrew is RTL-primary.
- **RTL correctness:** inside a `dir="rtl"` container do **not** use `flexDirection: isRTL ? 'row-reverse' : 'row'` (double-flip bug) — use plain `row` and let `dir` handle direction; use logical props (`insetInlineStart/End`) and `←/→` arrows chosen by `isRTL`.
- **Never the word "free"** (`free / חינם / бесплатно`) — use "included / כלול / включено" or "no extra cost / ללא עלות".
- **Brand UI uses `AboutIcon` SVG icons, not emoji** (the 🤍 In-Memory label is the existing, allowed exception).
- **Never claim the artwork is hand-drawn** — "hand-designed / designed from your photos" is fine; "printed by hand / מודפס בעבודת יד" is true and allowed.
- **No CLS regressions:** every image/video gets a reserved aspect-ratio box.
- **Graceful asset fallback** everywhere owner assets are consumed (B1, B5).
- Work on branch `launch-prep`. **No commit to `main`, no deploy** without explicit owner approval (Gleb does not code — report in Russian, stop before commit/deploy).

---

## Verification (per the project's real workflow — no TDD harness)

1. `npm run build` succeeds (esbuild template-literal safe).
2. Live-browser check (local dev or prod after deploy) in **he / en / ru**:
   - `/collage` renders all new sections in order; **0 console errors**; **0 broken images**; RTL arrows correct in Hebrew.
   - Home: MY CREW hero first + strengthened; nav shows MY CREW first; other home blocks intact.
   - Reveal-video slot: with no file present → falls back to image cleanly; (later) with file → autoplays muted, no CLS.
   - Guarantee / In-Memory / gift-occasions sections legible and on-brand in all three languages.
3. No payment flow touched (grep confirms no `create-payment` / price-string edits beyond intended copy).
4. (Optional) CLS spot-check on `/collage` and home stays clean.

---

## Assets owner will supply (later, graceful until then)

- **Reveal video** of the tee turn-around → `/my-crew/reveal.mp4` (+ optional `.webm`); poster falls back to `mycrew-worn-1.webp`.
- **1–2 extra worn examples** (cat + dog) → `/my-crew/…webp`.
- **1–2 new real testimonials** → `testimonials` table rows (admin or SQL), localized.

Format/encoding guidance for the video and photos will be given when the owner is ready to upload (final step of the phase).
