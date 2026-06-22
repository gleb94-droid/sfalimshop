# Pet Photo-Collage Tee ("MY CREW") — Product Design Spec

**Date:** 2026-06-22 · **Status:** design finalized; name (MY CREW) + price (₪169) LOCKED; scope = **ALL-IN** (on-site selectors + smart WhatsApp brief + mug set-upsell +₪49 + photo guide + "in memory" mode; NO live collage constructor — owner builds the collage manually); ONLY blocker to ship = owner example photos for the showcase (code is not blocked — uses placeholders) · **Branch:** to be built on `launch-prep`

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
- **Base tee:** **₪169** (LOCKED — all sides, up to 12 photos, name, approval included).
- **+ same-design mug:** +₪49 (vs ₪59 standalone) → "Full Crew Set."
- **In-memory mode:** no surcharge.
- Server re-prices via the existing `create-payment` commission path (a new commission/collage type) — **deploy the edge fn before exposing it** (server-first rule).

## 7. Customer journey (kept simple)
Tee → colour → collage style → **mode (Celebrate / In memory)** → front phrase → sleeve (opt) → pet name(s) → **"+ mug with the same design?"** → pay → WhatsApp photos (up to 12) → **approval preview** → print → ship.

## 8. Site implementation — ALL-IN (one cohesive flow, no phasing)
Owner decision 2026-06-22: build the full experience now. The guiding principle — **every on-site choice is cheap metadata that makes the product feel premium AND auto-builds a complete order brief**, so the owner gets everything upfront (fewer redos, faster turnaround). We do NOT build a live collage constructor (photo upload + layout render): the owner designs the collage by hand from WhatsApp photos, so an on-site render adds huge build cost with no payoff.

**Build (all of it):**
- **Entry** = the existing "we design it" commission flow + a new option **"📸 Pet photo collage"** (a new `collage` commission type), priced server-side at ₪169 (deploy create-payment FIRST).
- **On-site selectors** (all just captured as order metadata): tee colour (white/black) · collage style (B&W streetwear default / colour) · **mode (Celebrate / In memory 🤍)** · front phrase (from the menu) · sleeve micro-print (opt) · pet name(s) + count (drives the naming rule 1/2/3+).
- **Smart brief (the standout feature):** as the customer chooses, build a structured summary that is auto-injected into the **post-pay WhatsApp prefill** — the owner receives a ready order-naryad ("Black · B&W · phrase POWERED BY LUNA · 2 pets: MAX & LUNA · mode: Celebrate · +mug") instead of a blank "send photos".
- **Photo guide** inline in the flow ("which photos to send" — clear, face close-up, varied angles) → fewer bad submissions / redos.
- **Mug set-upsell** — a "+ same design on a mug? +₪49" checkbox on the collage step → a second server-priced cart line ("Full Crew Set"). (Owner pick: mug only for now; tote later.)
- **"In memory" mode** — a gentle toggle that swaps the phrase set to tributes (`בלב לנצח` / `Forever in my heart` / `Always with me`) + an optional years field (`[NAME] · 2015–2024`). Offered quietly, never marketed aggressively. Same price (a mode, not a surcharge).
- **`1 OF 1` promise** surfaced as a brand seal on the showcase + flow + cart note.
- **Showcase:** home band + a `/collage` mini-page (placeholder imagery until owner supplies real collage-tee photos; swap later — does NOT block the build).
- **SEO:** `/collage` in both sitemaps + internal links from the published gift blog posts (`custom-pet-photo-gift-guide`, `gifts-for-dog-lovers`).
- **Cross-link from BLOOM** (/pets + PetModal): a subtle "want your REAL pet? → photo collage" link.

**Explicitly OUT of scope (deferred / not built):** live on-site collage constructor with photo upload + layout preview (Phase 3 if ever — owner designs manually); tote/socks set variants (mug-only for now).

## 9. Marketing / how we offer it
- **Reel reveal** (turn around → the pet collage on the back) = the viral shot.
- **Giveaway:** "drop a photo of your pet in the comments → we'll print one for someone."
- **Photo guide** ("which photos to send"): clear, face close-up, varied angles → fewer redos.
- **Trust pair everywhere:** "you approve the design before we print" + "1 of 1."
- Copy rules: original designs/wordmarks (own style, not a copy of any other brand); never "free" (→ "included"); never claim the artwork is "hand-drawn" ("printed by hand" is true and fine).

## 10. Blockers before build
1. **2-3 photos of real finished collage tees** (back) for the showcase.
2. ~~Price + name~~ — DONE: **MY CREW · ₪169** (+₪49 same-design mug). Only the example photos remain.
Then: build Phase 1 on `launch-prep` (showcase + commission option + server pricing) → review → deploy (server-first) → merge.
