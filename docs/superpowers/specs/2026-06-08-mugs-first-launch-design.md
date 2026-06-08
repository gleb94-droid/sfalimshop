# Mugs-First Launch — Design Spec

- **Date:** 2026-06-08
- **Owner:** Gleb · **Branch:** `launch-prep` (NEVER `main` without explicit approval)
- **Status:** Approved in principle (2026-06-08). Implementation in waves, **behind the maintenance gate**. Launch = flip the 3 flags (separate, Gleb's command).

## Goal

Cut pre-launch overwhelm by **narrowing the offer to what Gleb can fulfill solo**: mugs as the hero (no inventory, he prints in-house), shirts limited to the two he loves (Oversize + Stonewash) held as a small ~30-piece buffer. Sharpen conversion and gift-positioning. Ship a focused launch — measured by focus, not feature count.

## Decisions (locked)

### Offer
- **MUGS = hero product.** `/mugs` page + `HomeMugsBanner` already exist; strengthen prominence. Mugs = brand core ("ספלים" = mugs), instant fulfillment, prints in-house.
- **SHIRTS = Oversize + Stonewash ONLY.** Hide Basic, Lycra, Look, Dryfit from the customer-facing wizard (code retained, **display-filtered** — reversible via one list/flag).
- **BLOOM characters on shirts → Oversize only** (drop the Basic toggle).

### Pricing
| Item | Decision | Market grounding (IL, 2026) |
|---|---|---|
| Mug — BLOOM / custom | ₪59 / ₪69 — **unchanged** | retail single mug ₪45–74 (WOW ₪74, migvan ₪55, classic ₪45) |
| Custom shirt (Oversize/Stonewash) | ₪149 — **unchanged** | single designed oversize ₪100–229 (Petly ₪229, Jaco ₪100); cheap ₪35–69 = bulk B2B MOQ 10–20, not our model |
| BLOOM-on-shirt | ₪99 (basic) → **₪119** (oversized) | already in DB (`price_shirt_oversized=119`); no migration |
| Commission-mug | **LOWERED**: custom ₪89 / pet-portrait ₪119 (was ₪109 / ₪149) | stood out next to a ₪59 retail mug |
| Commission-shirt | ₪149 / ₪189 — unchanged | design-service pricing, justified |

### Logistics — **no on-site inventory system** (YAGNI)
- Held ~30 shirts = fulfillment **buffer**, not tracked on-site → no "out of stock" UI, no overselling, no extra code.
- Copy: mugs **"ships in 2–3 days"**; shirts **"ships in ~5–7 days"**.
- Recommended first capsule order (Gleb's procurement, adjustable): Oversize black + cream/white ~18; Stonewash black + navy ~12; weight M/L (≈60% of demand), skip XXL/XS in batch 1.

## v1 Enhancements (all approved 2026-06-08)
1. **Mug = default product in BLOOM PetModal** — cheapest, sizeless entry → lower first-purchase barrier.
2. **"Start here" — curated ~10 bestsellers** section on `/pets` to fight 70-character choice overload. Uses `is_bestseller`; **open item:** confirm the 10 (dog+cat mix) during build — default = existing `is_bestseller` rows, top up to 10 with a proposed list if fewer.
3. **Gift framing for mugs** — badge/line "perfect gift · ready in 2–3 days · add a name or date" (he/en/ru).
4. **Mug pairs/sets** — v1 = **safe upsell only** ("add a matching mug" / "great as a set of 4"), **full price per mug, NO discount** (see Payment note). Discounted bundle SKU = phase 2.

## Tactic (no code)
- **Soft launch:** open to the waitlist first (small order flow → test real money / print / ship), then public push.

## ⚠️ Payment safety note (hard constraint)
`create-payment` (live, **v20**) recomputes each line's price server-side from the catalog (`pid → price_mug / price_shirt_oversized / …`), then sums. **Any client-side discount (bundle, coupon) is ignored by the server** unless the edge function is changed. Therefore v1 bundles MUST NOT rely on a discount. Touching `create-payment` = a separate, careful, explicitly-approved session (real money).

## Change list (App.jsx unless noted) — all behind the maintenance gate
- `getCustomProducts()` (~2459): filter customer wizard to `oversized` + `stonewash` (display layer; full `PRODUCTS` untouched for internal lookups).
- BLOOM `PetModal` shirt logic (~12280 / ~13356): default `previewProduct = "mug"`; fix `shirtType = "oversized"` (remove Basic toggle); price shows ₪119.
- `FABRIC_GUIDE` / "Our Fabrics": trim to the 2 fabrics (Oversize + Stonewash).
- `COMMISSION_PRICE` (~1640): mug tiers → `{ pet: { mug: 119 }, custom: { mug: 89 } }` (shirt tiers unchanged).
- Home: strengthen mugs prominence (`HomeMugsBanner` weight/placement).
- `/pets` (`PetsPage` ~7721): add "Start here" bestsellers strip.
- Mug **gift badge** + **"ships in N days"** copy (he/en/ru) — mugs page + product strip.
- Mug **pair/set upsell** UI (no discount).
- `index.html` JSON-LD: products / prices / `priceRange` → mugs + oversize/stonewash only, BLOOM shirt ₪119 (remove stale Basic/Lycra/Look/Dryfit + old ₪99/₪89/₪119 mix).
- DB: commission-mug is a **code constant** (no DB change). BLOOM ₪119 already in DB. "Start here" may need `is_bestseller` edits (admin/SQL) — confirm list.

## Out of scope (deferred)
- Discounted bundle SKU (needs a payment-safe `create-payment` session).
- On-site inventory / stock tracking.
- Real photoshoot, more testimonials (owner-side, already tracked).
- BLOOM on Stonewash (+₪20) — later.
- Re-enabling hidden shirt models.

## Rollout
Behind the maintenance gate, **in waves with Gleb's OK per wave**. No commit to `main` / no deploy without explicit approval. Report in plain Russian. Launch = flip the 3 launch flags (separate step, Gleb's command).
