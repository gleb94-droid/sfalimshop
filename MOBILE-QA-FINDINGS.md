# Sfalim Shop — Mobile & RTL QA Findings

_Date: 2026-05-25 · Audit of `App.jsx` focused on phones (`window.innerWidth < 768`) and Hebrew right-to-left layout._

## Summary

Good news first: the app is in solid shape on mobile. The cart drawer, order summary, accessibility menu, trust row, mobile customizer controls, and the freshly-polished BLOOM carousel swipe all handle RTL and small screens correctly — they use logical inset properties (`insetInlineStart/End`), `isMobile` branches, and comfortably large tap targets.

The remaining issues are mostly **RTL symmetry and polish**, not layout breaks. Listed below by real priority (some severities were down-graded after verifying against the actual code — none of these make the site unusable).

---

## Priority 1 — Real, user-facing

### 1. Mobile nav menu: Hebrew labels are left-aligned
- **Component:** `Nav` mobile dropdown (~lines 5358–5363)
- **Problem:** Every menu button uses `textAlign: "left"`, and the dropdown has no `direction` while the nav bar is forced LTR. In Hebrew, the menu labels hug the **left** edge instead of the right (start) edge.
- **Fix:** Set the dropdown container `direction: lang === "he" ? "rtl" : "ltr"` and change the buttons to `textAlign: "start"` (or conditional right/left).
- **Why it matters:** This is the main navigation, seen by every Hebrew visitor on a phone.

### 2. PetModal prev/next arrows are not RTL-aware
- **Component:** `PetModal` (~lines 7549–7608)
- **Problem:** The prev button is hard-pinned with physical `left:`, the next button with `right:`, and the chevron glyphs are fixed (`‹` / `›`). The modal flips to `direction: rtl` for Hebrew, but the arrows do not — so "previous" and "next" sit against the natural reading direction for the primary (Hebrew) audience.
- **Fix:** Switch to `insetInlineStart/End` and flip the chevron direction by `isRTL`, OR consciously keep them LTR and document the choice. Key point: the on-screen arrow direction should agree with what the swipe does.
- **Why it matters:** This is the primary BLOOM browsing flow.

---

## Priority 2 — Polish (fits the modern-animation direction)

### 3. No tap feedback on cards/buttons (mobile)
- **Components:** Hero cards (~5217), `PetCard` (~7204), `Reviews` cards (~5121) animate only on **mouse hover** (`onMouseOver/Out`). On a touch screen, a tap jumps straight to the next page with no visual "press".
- **Fix:** Add a brief active/touch scale-down (e.g. `scale(0.97)` on `:active` / `onTouchStart`) for tactile confirmation.

### 4. OrderPage controls get cramped under ~360px
- **Component:** `OrderPage`
- **Problem:** The city/postal input row (~4207) doesn't collapse to a single column on very narrow phones, and the 5 step labels (~3754) at `fontSize: 11` can clip/wrap awkwardly.
- **Fix:** Add `flexWrap: "wrap"` to the city/postal row so each field can take full width; shrink or hide the step text labels under ~360px (keep the numbered circles).

---

## Priority 3 — Low / admin-only

### 5. MaintenancePage language switcher uses physical `right: 20`
- **Component:** `MaintenancePage` (~line 7866)
- **Problem:** Pinned top-right regardless of direction; the parent is RTL for Hebrew. Low visual impact, but this is the **only currently-public page** (`MAINTENANCE_MODE = true`).
- **Fix:** Use `insetInlineEnd: 20` so it flips with direction.

### 6. AdminPage order row doesn't wrap + uses physical props
- **Component:** `AdminPage` (~lines 2732–2747)
- **Problem:** The customer/product block and the price/status block sit side-by-side with no `flexWrap`; a long product string crushes the price column on a phone. `textAlign: "right"` and `marginLeft` are physical, not RTL-aware.
- **Fix:** Add `flexWrap: "wrap"` / `gap`, switch `textAlign: "right"` → `"end"` and `marginLeft` → `marginInlineStart`. Admin-only, lowest priority.

---

## Solid — no action needed
`CartDrawer`, `CartToast`, `AccessibilityMenu`, `OrderSummary`, `TrustRow`, the BLOOM carousel touch-swipe, and the mobile customizer fine-tune/size controls all handle RTL + mobile correctly.
