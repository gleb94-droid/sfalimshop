# Design Polish Log — `design-polish` branch

A running record of visual fixes made during the front-end design pass.
Each page was checked at desktop (1280px) and mobile (390px) width, in Hebrew (RTL), English and Russian.

> Note: `MAINTENANCE_MODE` was temporarily flipped to `false` locally for inspection.
> It is reverted to `true` before finishing — the site stays in maintenance.

---

## Home page (Hero + product strip)

**Problems found**
- On desktop the 6 product cards wrapped unevenly — 5 cards on the first row and a
  single lonely card centered on the second row. It looked unbalanced and broken.
- Card widths were driven by `minWidth` + flex-wrap, so the layout depended on text
  length and looked different in each language.

**Fixes**
- Replaced the flex-wrap row with a proper responsive CSS grid:
  - 3 columns on desktop (clean 3×2 layout),
  - 2 columns on small tablets,
  - 1 column on mobile.
- Added a window-width listener so the grid reflows correctly on resize.
- Gave the grid a `maxWidth` so the cards stay a comfortable size and centered.
- Slightly reduced card padding and the hero-to-grid gap on mobile.

Result: balanced, identical layout in Hebrew, English and Russian on both sizes.

---

## Order wizard (5-step checkout)

Checked steps 1-3 live (desktop + mobile, all three languages). Steps 4-5 were
reviewed from the code only — driving the browser through them would create real
test orders in the live database, which must not happen pre-launch.

**Problems found**
- Step 3 (Details): the orange "payment on the next step" note box had
  `padding: 0`, so its two lines of text sat flush against the box border —
  it looked cramped and unfinished.

**Fixes**
- Gave the payment-note box proper inner padding (`12px 14px`) and made the
  first line semi-bold so it reads as a heading.

Everything else in the wizard (step indicator, product list, the customize
two-column layout, the details form, summary cards) held up correctly at both
sizes and in all three languages — no other changes needed.

---

## BLOOM / Pets page

Checked the collection page and the character detail modal at desktop and
mobile in all three languages.

**Result: no changes needed.** This page is already well built:
- The 12-character grid reflows correctly (4 columns on desktop, 2 on mobile).
- The detail modal switches from a two-column to a stacked layout on mobile,
  scrolls when the content is tall, and already mirrors its close button to the
  correct side in Hebrew (RTL).

(One pre-existing detail — the floating accessibility button can overlap the
modal's lower-left corner on mobile — is a site-wide element and is addressed in
the globals section.)
