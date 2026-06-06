# BLOOM Commission feature — build plan (from code-architect 2026-06-06)

**Feature:** pay-first custom service — customer picks a shirt, pays ₪189 upfront, then sends 2–4 pet photos via WhatsApp; owner hand-draws a BLOOM design, sends watermarked preview, up to 3 revisions, no cash refund (made-to-order). Reuses ~85% of the existing custom-shirt checkout.

## Key pieces
- New cart item `isCommission: true` → order row `extra_prints.src = "commission"`, `design_url=null`, `requires_design_approval=false`, `design_approval_status="not_required"`. NO upload, NO mockup pipeline, NO pre-pay approval gate.
- Client constant `COMMISSION_SHIRT_PRICE = 189` (near `WHATSAPP_NUMBER`). Feature flag `BLOOM_COMMISSION_ENABLED` (near `STONEWASH_ENABLED`), start `false`.
- `create-payment/index.ts`: add pricing-loop branch `else if (meta.src === "commission") { unit = 189 + (row.pet_name ? PET_SURCHARGE : 0); }` — KEEP IN SYNC with client. Makes B1 fail-closed pass.
- `OrderPage` Step 1: after a SHIRT is selected, show 2-card choice — "I have a design (upload)" vs "Create from my pet's photos" (gated by flag, shirt-only). Commission path shows colour/size pickers + microcopy + (maybe) pet-name, then `addCommissionToCart()` → `setStep(3)`.
- `addCommissionToCart()`: own push-to-cart (do NOT call `commitCurrentItem` — its guard needs uploadedImage). Sets isCommission, unitPrice, no image.
- `handleSubmit`: commission INSERT branch BEFORE the `isCustomUpload` check, uses `continue` (so `groupNeedsApproval` never set true).
- `TrackPage` payReturn success: extend the orders `.select` to include `extra_prints`; if any `src==="commission"` and succeeded → render big WhatsApp CTA (uses `WHATSAPP_NUMBER`, prefill text w/ order number, new tab).
- `AdminPage`: commission badge on order card header + per-item detail (read `o.extra_prints?.src === "commission"`, optional-chain — old rows may have null).

## Build sequence (front-load low risk; isolate the live-payment change)
1. Constants + flag(false) + `LANGS.commission` skeleton (placeholder copy). Invisible.
2. `addCommissionToCart()` (no UI). 
3. `handleSubmit` commission branch (behind flag).
4. `create-payment` commission pricing branch → deploy (THE live-payment change; must land before flag-on).
5. Step-1 UI choice + commission config (still flag=false).
6. TrackPage post-pay WhatsApp CTA.
7. Admin badge (+ optional `send-admin-order-alert` commission note).
8. Flip `BLOOM_COMMISSION_ENABLED=true`, fill final trilingual copy, optional home CTA, full `?staff=1` test.

## Gotchas
- B1: commission branch MUST be in create-payment before flag-on, else `unresolved_pricing` blocks payment.
- Approval gate must NOT fire: row has `requires_design_approval=false` + commission branch `continue`s before the isCustomUpload line.
- Webhook amount check: create-payment persists corrected totals → SUM(total) matches. No webhook change.
- Template literals only; trilingual he/en/ru; RTL.

## Owner decisions still open
1. Mug commission? (v1 = shirt-only ₪189; mug = v2 + a price). 
2. Revision count (default 3).
3. Delivery time wording (days from photos → preview) — needed for microcopy.
4. CTA placement (in-flow only vs + home section).
5. Pet-name on commission: fold into WhatsApp brief (free, simpler) vs +₪20 add-on.
6. `send-admin-order-alert` commission highlight (nice-to-have).
