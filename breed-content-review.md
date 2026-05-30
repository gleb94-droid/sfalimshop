# BLOOM Breed Content QA Review

**Date:** 2026-05-29
**Scope:** All 70 active BLOOM breeds (47 dogs + 23 cats), columns `breed_origin_he/en/ru` + `breed_facts_he/en/ru`, table `pet_designs` (project `ubvgrxlxtelulwjtfudd`).
**Mode:** REPORT ONLY — no DB writes performed.
**Data confirmed pulled:** 70/70 breeds, all 3 languages, fully read.

---

## 1. Summary

Overall quality is **high**. Origins are consistently 1 sentence, facts are consistently 3 per breed in every language, tone is warm/playful/concise, and HE↔EN↔RU stay aligned with very little drift. The five "not-a-breed" pattern entries (48, 55, 57, 58, 60) are correctly framed as coat patterns/colors, not breeds. The two Israel entries (16 Canaan dog vs 63 Kanaani cat) are correctly distinguished.

| Status | Count |
|---|---|
| Clean (no action) | 63 |
| Needs attention | 7 |

Severity breakdown:
- **ACCURACY (must fix):** 1 — `04_american_pit_bull` (debunked "nanny dog" myth).
- **WEAK-FACT / superlative:** 2 — `20_border_collie` (redundant "smartest"), `51_russian_blue` (long fact + soft superlative).
- **LANGUAGE / consistency drift:** 1 — `27_beagle` (RU fact drops "detection").
- **STYLE / optional polish:** 3 — `48_tuxedo` (fact length), `13_husky` (soften figure), `01_golden_retriever` (HE/RU "Scotland" vs EN "Highlands").
- **VERIFIED CLEAN after double-check:** `34_basset_hound`, `42_whippet`, `54_ragdoll`.

No typos that break meaning were found. No medical claims present. No missing origins or missing 3rd facts — **zero GAPS**.

---

## 2. Per-breed issues — DOGS

### 04_american_pit_bull · ACCURACY (must fix)
The origin presents the **"nanny dog" nickname as historical fact**. This is a well-documented modern myth with no primary-source basis (the only related print reference is a 1971 NYT piece about Staffordshire Bull Terriers, not pit bulls). Brand rules explicitly forbid debunked claims. Recommend dropping the nanny-dog clause entirely.

- **HE — current:** `פותח במאה ה-19 מהכלאות של בולדוגים וטרייארים שהובאו לאמריקה. בעבר זכה לכינוי "כלב המטפלת" בזכות נאמנותו למשפחה.`
- **HE — proposed:** `פותח במאה ה-19 מהכלאות של בולדוגים וטרייארים שהובאו לאמריקה, ולאורך השנים הפך לכלב משפחה נאמן ואהוב.`
- **EN — current:** `Developed in the 1800s from bulldog-and-terrier crosses brought to America; once nicknamed the "nanny dog" for its devotion to family.`
- **EN — proposed:** `Developed in the 1800s from bulldog-and-terrier crosses brought to America, and over time became a loyal, much-loved family dog.`
- **RU — current:** `Выведен в XIX веке из помесей бульдогов и терьеров, привезённых в Америку; когда-то его звали "няня" за преданность семье.`
- **RU — proposed:** `Выведен в XIX веке из помесей бульдогов и терьеров, привезённых в Америку, и со временем стал преданным и любимым семейным псом.`

### 01_golden_retriever · LANGUAGE (minor drift)
HE origin says "בסקוטלנד" (Scotland); EN says "Scottish Highlands"; RU says "Шотландии" (Scotland). All accurate (the breed was developed at Guisachan in the Highlands), but EN is slightly more specific than HE/RU. Optional: align EN to plain "Scotland" or add "Highlands" to HE/RU. Low priority — all three are factually correct.

- **HE — optional tweak:** change `בסקוטלנד` → `ברמות סקוטלנד` to match EN. (Optional only.)

### 13_husky · VERIFY (one figure)
Fact: "can run hundreds of kilometers in temperatures of -50°C." The -50°C cold tolerance and long-distance hauling are well established (Chukchi sled dogs / Iditarod heritage). "Hundreds of kilometers" is broadly defensible over multi-day runs but is a soft figure. **Keep, but consider softening** to avoid an implied single-day claim.

- **EN — optional:** `Bred to haul loads over long distances in temperatures as low as -50°C` (drops the precise "hundreds of km").
- HE/RU mirror the same; apply the same softening if changed.

Low priority — not an error, just a precision hedge.

### 20_border_collie · WEAK-FACT / superlative
Both the origin AND fact 1 assert "the most intelligent dog breed in the world." This is the widely-cited claim (Stanley Coren's ranking) so it's defensible, but **stating it twice** (origin + fact) is redundant. Recommend keeping it in the origin and replacing fact 1 with a fresh, still-accurate fact.

- **HE fact 1 — current:** `נחשב לגזע הכלבים החכם ביותר בעולם`
- **HE fact 1 — proposed:** `מסוגל ללמוד מאות מילים ופקודות שונות`
- **EN fact 1 — current:** `Widely regarded as the smartest dog breed on earth`
- **EN fact 1 — proposed:** `Can learn hundreds of distinct words and commands`
- **RU fact 1 — current:** `Считается самой умной породой собак на свете`
- **RU fact 1 — proposed:** `Способен выучить сотни слов и команд`

(The famous Border Collie "Chaser" learned 1,000+ object names — this fact is solid and more engaging than repeating "smartest.")

### 27_beagle · LANGUAGE (RU drift) + consistency
RU fact 1 is truncated in meaning vs HE/EN. HE/EN say the nose is used "at customs and detection"; RU says only "используется на таможне" (used at customs), dropping the detection half. Minor — align RU.

- **RU fact 1 — current:** `Один из сильнейших нюхов среди собак — используется на таможне`
- **RU fact 1 — proposed:** `Один из сильнейших нюхов среди собак — используется на таможне и в поиске`

### 42_whippet · VERIFY (speed figure)
Fact: "up to about 60 km/h." Whippets are commonly cited at ~55–60 km/h (35–37 mph), so this is accurate and the hedge "about" is good. **No change needed — CLEAN.** (Flagged only for verification; verified OK.)

---

## 3. Per-breed issues — CATS

### 54_ragdoll · VERIFY / superlative (weight)
Fact: "males reaching up to nine kilograms" (HE/EN/RU all say 9 kg). Ragdoll males are typically 5.4–9 kg per breed standards, so 9 kg as a top-end is **defensible but at the very top of the range**. Acceptable. Optional softening to "up to about nine kilograms" / "כמעט תשעה קילו" — the HE already says "עד תשעה קילו". Low priority, keep.

### 51_russian_blue · STYLE (fact length) + superlative
Fact 1 is the **longest fact in the whole dataset** and carries a soft superlative ("among the softest in the cat world"). Over the ~15-word guideline in all three languages. Recommend trimming.

- **HE — current:** `הפרווה הכפולה הכסופה-כחולה מנצנצת באור ונחשבת לאחת הרכות בעולם החתולים`
- **HE — proposed:** `הפרווה הכפולה הכסופה-כחולה מנצנצת באור ורכה במיוחד למגע`
- **EN — current:** `The silvery-blue double coat shimmers in light and is among the softest in the cat world`
- **EN — proposed:** `The silvery-blue double coat shimmers in light and is exceptionally soft to the touch`
- **RU — current:** `Серебристо-голубая двойная шерсть мерцает на свету и считается одной из самых мягких среди кошек`
- **RU — proposed:** `Серебристо-голубая двойная шерсть мерцает на свету и очень мягкая на ощупь`

### 48_tuxedo · STYLE (fact length, optional)
Fact 1 ("white chest and paws form when pigment cells don't cover the whole body in the embryo") is accurate and a nice fact, but it's long (over the 15-word guide in all three langs). Optional trim for at-a-glance reading.

- **EN — proposed:** `The white chest and paws form when pigment cells don't cover the whole embryo`
- HE/RU mirror.

### Pattern-entry framing check (48, 55, 57, 58, 60) — CLEAN
All five explicitly open with "isn't a breed but a coat pattern/color" (or HE/RU equivalents) and write about genetics/culture, not fake breed history. Correctly handled.

- `55_orange_tabby`: ~80% male — accurate. CLEAN.
- `57_calico`: almost all female, Maneki-neko link — accurate. CLEAN.
- `60_black_cat`: West vs Britain/Japan luck, rusting in sun, golden eyes — accurate. CLEAN.
- `58_domestic_shorthair`: hybrid-vigor framing — accurate, no medical claim. CLEAN.

### Israel entries (16 + 63) — CLEAN
- `16_canaan_dog`: correctly the national **dog**; Dr. Rudolphina Menzel 1930s re-domestication is accurate.
- `63_kanaani`: correctly an Israeli **cat** breed by Doris Pollatschek. No confusion between the two. Local-pride framing intact.

### Other cat accuracy spot-checks — CLEAN
- `49_sphynx` 1966 Toronto, `52_scottish_fold` Susie 1961, `64_egyptian_mau` 48 km/h (Guinness), `56_maine_coon` ~1 m length, `67_norwegian_forest` Freya legend, `69_birman` always blue eyes — all verified accurate.

---

## 4. Notes / non-issues

- **No GAPS:** every breed has an origin + exactly 3 facts in HE, EN, and RU.
- **No meaning-breaking typos** found across 210 origin fields + 210 fact blocks.
- **34_basset_hound, 42_whippet:** flagged for verification, confirmed CLEAN — not in the apply list.
- **Egyptian Mau "originated in Egypt":** DNA studies suggest European/N. American lineage, but the traditional/mainstream framing is acceptable per brand rules ("originated in"). No change.

---

## 5. READY TO APPLY

Ordered by priority. Each is a drop-in replacement; origins stay 1 sentence, facts stay 3 newline-separated, no emoji.

**P1 — ACCURACY (debunked myth, fix before launch)**

1. `04_american_pit_bull` — remove "nanny dog" claim from origin (all 3 langs):
   - HE: `פותח במאה ה-19 מהכלאות של בולדוגים וטרייארים שהובאו לאמריקה, ולאורך השנים הפך לכלב משפחה נאמן ואהוב.`
   - EN: `Developed in the 1800s from bulldog-and-terrier crosses brought to America, and over time became a loyal, much-loved family dog.`
   - RU: `Выведен в XIX веке из помесей бульдогов и терьеров, привезённых в Америку, и со временем стал преданным и любимым семейным псом.`

**P2 — WEAK-FACT / drift (quality + consistency)**

2. `20_border_collie` — replace fact 1 (stop repeating "smartest"; use the words/commands fact):
   - HE: `מסוגל ללמוד מאות מילים ופקודות שונות`
   - EN: `Can learn hundreds of distinct words and commands`
   - RU: `Способен выучить сотни слов и команд`

3. `27_beagle` — fix RU fact 1 to match HE/EN (add detection):
   - RU: `Один из сильнейших нюхов среди собак — используется на таможне и в поиске`

4. `51_russian_blue` — trim fact 1 (length + soften superlative):
   - HE: `הפרווה הכפולה הכסופה-כחולה מנצנצת באור ורכה במיוחד למגע`
   - EN: `The silvery-blue double coat shimmers in light and is exceptionally soft to the touch`
   - RU: `Серебристо-голубая двойная шерсть мерцает на свету и очень мягкая на ощупь`

**P3 — STYLE / optional (do if doing a pass anyway)**

5. `48_tuxedo` — trim fact 1 for at-a-glance length (EN shown; mirror HE/RU):
   - EN: `The white chest and paws form when pigment cells don't cover the whole embryo`

6. `13_husky` — optional: soften the "-50°C / hundreds of km" fact to a single distance/cold claim.

7. `01_golden_retriever` — optional: align HE/RU "Scotland" with EN "Scottish Highlands" (cosmetic, all currently correct).

Everything not listed above is CLEAN and needs no change.
