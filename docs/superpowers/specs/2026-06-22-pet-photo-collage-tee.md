# Pet Photo-Collage Tee ("MY CREW") — Product Design Spec

**Date:** 2026-06-22 · **Status:** design finalized + name LOCKED (MY CREW); pending owner assets (example photos + final price) before build · **Branch:** to be built on `launch-prep`

> Name: **MY CREW** — FINAL (confirmed by owner 2026-06-22). Kept English across all languages (like BLOOM); local subtitle — he `החבורה שלך על חולצה`, ru `твоя банда на футболке`, en `your crew on a tee`.

## 1. Concept
An oversize tee with a **streetwear collage of the customer's REAL pet photos** (up to 12) on the back + a small phrase on the front. Sibling to BLOOM: **BLOOM = illustrated portraits (70 ready characters); MY CREW = the customer's own photos.** Made "we design it" style: pay-first → customer sends photos via WhatsApp → owner builds the collage → design-approval preview → print → ship. Owner prints in-house (DTF) in Be'er Sheva.

**Unifying idea:** one pet-collage *design*, made once, lives everywhere — wear it, gift it, add it to a mug/tote/socks, in "celebrate" or "in memory" mode, **always 1 of 1.**

## 2. Anatomy (DTF → front + back + sleeve all included)
- **Back** = the big collage + the pet's name (hero / statement).
- **Front** = small left-chest print — a phrase the customer picks.
- **Sleeve** = optional micro-print (name / `1 OF 1` / `EST. '21`).

## 3. Customization
- **Tee color:** white / black (B&W collage pops on both).
- **Collage style:** black & white (streetwear, default) / colour.
- **Front phrase menu:** `[NAME]` · `DOG/CAT MOM/DAD` · `POWERED BY [NAME]` · `[NAME] EST. '21` · paw + `[NAME]`.
- **Multi-pet naming rule (by count):** 1 → `LUNA`; 2 → `MAX & LUNA`; 3+ → collective `THE [SURNAME] PACK` / `[SURNAME] CREW` (he: `החבורה של [שם]`; ru: `БАНДА [фамилии]`). Owner applies the rule from one "pet name(s)" field.

## 4. Included (selling points)
Front + back + sleeve · up to **12 photos** · pet name(s) · **design-approval preview before print** (reuse existing commission approval) · hand-printed in Be'er Sheva.

## 5. Three extensions (integrated, not bolted-on)
1. **`1 OF 1`** — a brand *promise*, not a paid option. Subtle micro-print (sleeve/label) + on the showcase + in Reels; becomes the line's tagline; justifies the ₪149-169 price. Zero extra work.
2. **The Set (bundle / upsell)** — the design is already made, so applying it to a **mug/tote (later socks)** is near-zero extra work → high margin. Simple "+ same design on a mug? +₪49" checkbox. Name: **"Full Crew Set."** Retention lever: **"we keep your design"** → customer re-orders other items later with no redesign.
3. **"In memory" mode** — one toggle ("This is a tribute 🤍") swaps the phrase set to gentle ones (`בלב לנצח` / `Forever in my heart` / `Always with me`) + optional years field (`[NAME] · 2015–2024`). Handle warmly; offer quietly, do NOT market aggressively. Same collage engine, different emotional mode. Same price (a mode, not a surcharge).

## 6. Pricing
- **Base tee:** ₪149 (all sides, up to 12 photos, name, approval included). Optional premium positioning ₪169.
- **+ same-design mug:** +₪49 (vs ₪59 standalone) → "Full Crew Set."
- **In-memory mode:** no surcharge.
- Server re-prices via the existing `create-payment` commission path (a new commission/collage type) — **deploy the edge fn before exposing it** (server-first rule).

## 7. Customer journey (kept simple)
Tee → colour → collage style → **mode (Celebrate / In memory)** → front phrase → sleeve (opt) → pet name(s) → **"+ mug with the same design?"** → pay → WhatsApp photos (up to 12) → **approval preview** → print → ship.

## 8. Site implementation — phased (the "best way to upload it")
**Phase 1 (ship now, minimal code):**
- A **showcase block** (home + a `/collage` mini-page) with 2-3 REAL example photos + the 3-step "how it works" + CTA.
- Entry = the **existing "we design it" commission flow** with a new option **"📸 Pet photo collage"** (priced server-side).
- Rich customization (colour/style/phrase/mode/sleeve) handled in the **WhatsApp conversation** + an order note initially — NOT a complex on-site selector. A photo/choice checklist goes in the post-pay WhatsApp prefill.
- SEO: `/collage` page + **internal links from the already-published gift blog posts** (`custom-pet-photo-gift-guide`, `gifts-for-dog-lovers`) → ready-made funnel.
- Cross-link from BLOOM (/pets + PetModal): a small "want your REAL pet? → photo collage" link.

**Phase 2 (after demand proves out):**
- On-site selectors for colour / collage style / front phrase / mode; the "+ mug same design" upsell checkbox; optional gallery of examples.

## 9. Marketing / how we offer it
- **Reel reveal** (turn around → the pet collage on the back) = the viral shot.
- **Giveaway:** "drop a photo of your pet in the comments → we'll print one for someone."
- **Photo guide** ("which photos to send"): clear, face close-up, varied angles → fewer redos.
- **Trust pair everywhere:** "you approve the design before we print" + "1 of 1."
- Copy rules: original designs/wordmarks (own style, not a copy of any other brand); never "free" (→ "included"); never claim the artwork is "hand-drawn" ("printed by hand" is true and fine).

## 10. Blockers before build
1. **2-3 photos of real finished collage tees** (back) for the showcase.
2. Owner confirms **price** (₪149 / ₪169). *(Name locked: MY CREW.)*
Then: build Phase 1 on `launch-prep` (showcase + commission option + server pricing) → review → deploy (server-first) → merge.
