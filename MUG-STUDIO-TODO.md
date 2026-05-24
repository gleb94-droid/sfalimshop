# Mug Studio — Open TODOs

Branch: `mug-studio` · Reachable at `#mug-studio` (staff only while `MAINTENANCE_MODE = true`).

This branch carries the full Phase 1 + Phase 2 mug customizer work: the 3D
studio, multi-layer support, order integration (`design_url`, `mockup_url`,
`extra_prints`, `print_pdf_url`, `design_rotation`), admin 3D reconstruction,
and the A4 print PDF. **Not yet merged to `main`** — owner reviews on the
preview deploy before launch.

## Still open

1. **Print file size must match the on-mug studio size 1:1.**
   The exported print PNG / PDF currently comes out a touch larger relative
   to the print area than what's shown on the 3D mug. We removed the
   composite's `SAFETY_MM = 2` inset so editor / 3D / export all share one
   coordinate system, but the real-world print still doesn't measure quite
   the same as the studio preview. Investigate end-to-end (browser canvas
   → 300 dpi PNG → A4 PDF → printer driver → heat press) and re-validate
   with a calibration ruler on the actual mug.

2. **Confirm the real physical print dimensions and unify the constant.**
   Today: `PRINT_W_MM = 230`, `PRINT_H_MM = 102` in both `MugStudio.jsx`
   and the defaults of `MugPreview.jsx`. These were chosen from typical
   sublimation-mug specs, not measured against the real mug blank + heat
   press. To-do:
   - Measure the actual printable area on the supplier's mug blank.
   - Validate against the EPSON SC-F100 + heat-press combo.
   - Promote the result to **one shared constant** (e.g. a `MUG_PRINT.js`
     module exporting `PRINT_W_MM` + `PRINT_H_MM` + `PRINT_ARC_FRAC`)
     consumed by the studio, the print PNG, the print PDF, and the admin
     3D preview. Today they're duplicated across `MugStudio.jsx` and
     `MugPreview.jsx`.

3. **Finalize A4 placement per the owner's example.**
   Current `renderPrintPDF` produces A4 PORTRAIT with the artwork centered
   horizontally and `TOP_MARGIN_MM = 10` from the top edge. Two caveats
   the owner needs to confirm against the heat-press workflow:
   - If `PRINT_W_MM > 210`, the band overhangs A4 portrait width and
     jsPDF clips. With today's `PRINT_W_MM = 230`, only the middle 210mm
     prints. Reduce `PRINT_W_MM` to ≤ 210 OR switch the page back to A4
     landscape.
   - Confirm the top margin (10mm) matches how the operator loads the
     sheet into the SC-F100 and aligns it to the press platen.

4. **(Optional) Admin 3D reconstruction polish + `design_rotation` use.**
   The `design_rotation NUMERIC` column is already added (migration
   `add_design_rotation_to_orders`) and populated from the primary layer's
   `rotDeg` at order time. `MugPreview` reconstructs the mug from the
   baked print PNG so rotation is already visually correct via the
   texture. The column is currently a metadata reference only — wire it
   into the admin placement-text block if a numeric rotation readout is
   useful, and consider exposing per-layer transforms (already saved in
   `extra_prints.mug_studio.layers`) as a richer admin view.

## Things NOT to break when continuing

- `MAINTENANCE_MODE = true` stays. The studio is gated to admin /
  `?staff=1`, same as the rest of the store.
- The `#mug-studio` route exception in `App.jsx` (maintenance gate skip)
  is intentional — leave it.
- Lazy splits stay: `MugStudio` + `MugPreview` + `three` + `jspdf` are
  all dynamic-imported. Adding any of them to the main bundle re-bloats
  every visitor's first load.
- `mug_studio` cart line carries: `uploadedImage` (print PNG data URL),
  `mockupUrl` (composite mockup PNG data URL), `printPdfData` (PDF data
  URL), `mugStudio: { layers, printArea }`, `imagePos` (first layer's
  primary transform for legacy fields), and `designRotation` (first
  layer's rotation). Checkout submit uploads the PNG/PDF and persists
  to `orders.design_url` / `mockup_url` / `print_pdf_url` /
  `extra_prints` / `design_rotation`. Don't drop any of those without
  also patching the admin order view.

## Files owned by this branch

- `MugStudio.jsx` — the studio component (lazy-loaded by `App.jsx`).
- `MugPreview.jsx` — read-only 3D mug for admin order detail.
- `App.jsx` — small additions: lazy imports, `addMugStudioToCart`,
  `OrderPage.handleSubmit` mug-specific upload + extra fields, admin
  item card mug-specific render block, mug-CTA on the product picker.
- `package.json` — added `three` and `jspdf`.
- Supabase migrations applied to live project `ubvgrxlxtelulwjtfudd`:
  `add_print_pdf_url_to_orders` and `add_design_rotation_to_orders`
  (both add nullable columns; no destructive changes).

## How to test on this branch

1. Set `MAINTENANCE_MODE = true` (it is). Visit `/?staff=1#order`.
2. Pick the mug card → studio loads.
3. Upload artwork, optionally add a second design, position both.
4. **הוסף לסל · ₪69** → cart toast + auto-advance to checkout step 3.
5. Place a test order. Log in as admin, open the order:
   - 3D mug reconstruction (drag to rotate).
   - Mockup thumbnail (composite with orange print-area boundary).
   - Placement text block (per-layer X mm · Y mm · scale × · rotation °).
   - **Print file (300dpi)** — flat PNG download.
   - **הורד קובץ הדפסה (PDF)** — A4 portrait PDF download.
