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
