# Emotional Hero Redesign — Sfalim Shop (2026-06-11)

## Goal
Make the first 3 seconds on the home page feel **warm and emotional** (the pet bond) instead of opening with a busy floating carousel of 70 illustrated characters, which reads as "a lot / 70!" rather than a "wow / this is special." Lead with FEELING; reveal the 70-collection's richness as a second-screen reward. Owner-approved direction (option A headline). Research-backed (West & Willow "calm gallery" model; lead-with-feeling 3-sec rule; choice-overload → "lead with one, reveal the rest").

## Approved design — new `EmotionalHero` (first screen, mobile-first)
Top → bottom:
1. **Eyebrow** — quiet label (e.g. `דיוקנאות חיות מאוירים`).
2. **Emotional H1** — `הם ממלאים את כל הבית. עכשיו גם את הספל.` (warm + playful; serif). One strong fixed line (not rotating, for clarity/SEO).
3. **Sub-line** — feeling→product, e.g. "turn the pet you love into a keepsake — on a mug, shirt or print" (content-writer to polish he/en/ru).
4. **ONE living portrait** — large, calm BLOOM portrait with the warm radial glow + a gentle "breathing"/float (compositor-only). Slow cross-fade through 3–4 **bestseller** portraits (one at a time, ~5s); the **breed name** shows elegantly below and changes with it. Respect `prefers-reduced-motion` (static, no fade/float).
5. **Inline breed search CTA** — `מצאו את החיה שלכם` input → on submit, hand the query to `/pets` and open the gallery filtered (the personal/interactive hook). Handoff via `sessionStorage` key the PetsPage reads + clears on mount (low coupling). A plain "see all 70 →" secondary link beneath.
6. **Thin trust strip** — `70 גזעים · מודפס אצלי, בבאר שבע` (the "70 = belonging" framing + the solo-maker angle).
7. **Quiet review** — Ella's ★5 as a single small line (top active testimonial), hides if none.

## Restructure (home order)
- NEW: `<EmotionalHero/>` at the very top.
- MOVE BELOW the fold (screen 2 — abundance as reward): the existing `HomeFloatingBloomCarousel` (the 70-card float), the `Hero` "design-it-yourself" product cards, `HomeMugsBanner`. The `/pets` "Start here" bestseller band already lives on /pets.
- Keep the aurora background + the phrase band; keep motion slow.

## Photo-ready
The portrait slot + the line under it are built so a **real product photo** (a printed mug in a cozy home) can slot in later with a one-line swap, or as a thin "see it in real life" photo strip. (Owner will provide real mug photos later.)

## Behavior / tech
- Single-file React (App.jsx), inline styles, template literals only, RTL-first, trilingual he/en/ru.
- `EmotionalHero` fetches 3–4 `pet_designs` where `is_bestseller` (mockup_url) for the rotation; graceful if <1.
- Reduced-motion: no fade/float, show one static portrait.
- BLOOM portraits already carry the orange frame — no double-frame; `object-fit: contain` + whitespace.

## Out of scope (now)
- Real product photos (later — design is photo-ready).
- The `/pets` page internals (only add the sessionStorage query read).

## Success
On mobile, the first screen evokes the pet bond (warm H1 + one beautiful living portrait + a personal "find your pet"), feels premium/calm, and hands off to the collection on scroll. No busy 70-card float above the fold.
