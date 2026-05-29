# CLAUDE.md — Sfalim Shop Project Context

Every project agent should read this file before acting. It is the **shared brain** for all subagents in `.claude/agents/`.

---

## 🏪 Project at a glance

**Sfalim Shop** (sfalimshop.com) — Hebrew-first print-on-demand shop (t-shirts, mugs, stickers + the 70-character BLOOM pet portrait collection).

- Owner: Gleb (admin email: `gleb2009@gmail.com`)
- Israeli exempt dealer (עוסק פטור) #321630279
- HaSportaim 28, Be'er Sheva, Israel
- Customer email: `hello@sfalimshop.com`
- Instagram: `@sfalimshop`
- Status: **PRE-LAUNCH.** `MAINTENANCE_MODE = true` in App.jsx until the Tranzila payment integration is live.

---

## 🛠️ Tech stack

- **React 18 + Vite 4.5** (esbuild 0.18 — **template literals only, no `+` string concat**)
- **Supabase** (DB + Auth + Storage + Edge Functions), project ref `ubvgrxlxtelulwjtfudd`, **Pro tier** (daily backups, no pausing)
- **Vercel hosting**, **Pro tier** (WAF available)
- **GitHub:** `gleb94-droid/sfalimshop` (private)

Local working dir on owner's machine: `C:/Users/Gleb/Documents/GitHub/sfalimshop`

---

## 📁 Repo structure

```
sfalimshop/
├── App.jsx                        # THE ENTIRE APP (~9350 lines). At repo ROOT, NOT in src/.
├── public/
│   └── quiz/index.html            # Standalone BLOOM personality quiz, vanilla JS
├── api/                           # Vercel serverless functions
│   ├── og.js                      # OG meta image generation
│   └── p/[handle].js              # /p/<slug> share URL handler
├── supabase/functions/            # Edge Functions (Tranzila stubs in here)
│   ├── create-payment/            # stub
│   └── tranzila-webhook/          # stub
├── vercel.json                    # Routes + CSP + security headers
├── .claude/agents/                # Subagent library (TRACKED in git as of 2026-05-28)
└── CLAUDE.md                      # THIS FILE
```

---

## ⚠️ Critical conventions (NEVER violate)

1. **Template literals only** — `` `text ${var}` ``. Never `"text " + var`. (esbuild 0.18 limit.)
2. **Hebrew RTL primary**, English/Russian secondary.
3. **Single-file React app** — all UI/logic lives in `App.jsx` at the repo root.
4. **BLOOM slug numbering**: `01-47` = dogs, `48-70` = cats.
5. **Windows ImageMagick**: use `magick identify` / `magick convert`. **Bare `convert` is a Windows disk tool** — it will NOT call ImageMagick.
6. **Pixel Agents (VS Code ext.)** is unreliable for actual work — use the regular Claude Code terminal.

---

## 🗄️ Database schema (Supabase: `ubvgrxlxtelulwjtfudd`)

### Tables

| Table | Rows | Notes |
|---|---|---|
| `pet_designs` | 82 (70 active + 12 obsolete drafts) | 33 columns. Core catalog. |
| `orders` | varies | RLS enabled |
| `order_status_history` | audit log | RLS enabled |
| `payment_events` | webhook audit log | RLS enabled |
| `admins` | 1 (`gleb2009@gmail.com`) | Self-select RLS only |
| `sticker_packs` | 2 | BLOOM sticker bundles |

### `pet_designs` key columns

- `slug` (e.g., `01_golden_retriever`, `48_tuxedo`)
- `name_he` / `name_en` / `name_ru`
- `animal_he` / `animal_en` / `animal_ru`
- `tagline_he` / `tagline_en` / `tagline_ru`
- `mockup_url` — BLOOM portrait (populated for all 82 rows)
- `mockup_mug_url` — sofa-style mug photo (populated for 70 active rows)
- `mockup_shirt_url` — legacy single shirt mockup (**NULL for all 70** — superseded by the per-color columns below)
- `mockup_shirt_white_url` / `mockup_shirt_black_url` — per-color shirt mockups; **populated for all 70**. PetModal is color-aware (white/black) and falls back to the portrait only if a URL is ever missing.
- `design_url` — raw transparent design
- `mockup_bg` — fallback background color
- `price_shirt`, `price_shirt_basic`, `price_shirt_oversized`, `price_mug`, `price_sticker`, `price_sticker_pack`
- `is_active`, `is_bestseller`, `is_new`, `sort_order`
- `species` (`dog` / `cat` / `NULL` — NULL for the 12 obsolete drafts)
- `breed_he` / `breed_en` / `breed_ru`, `breed_aliases`

### Storage buckets (all public)

- **`mockups/`**
  - `bloom/<slug>-clean.webp` — 1414×2000 BLOOM portrait (70 active files)
  - `bloom/<slug>-mug.webp` — sofa lifestyle mug photo (70 files, ~355 KB avg)
  - `mug.png`, `t shirt basic.png`, `oversize.png`, `dri fit t shirt.png`, `round sticker.png`, `square sticker.png` — generic product templates
- **`pet-designs/`**
  - `bloom/<slug>.webp` — raw transparent design (82 files)
- **`designs/`**
  - User-uploaded custom designs for orders

### Useful queries

```sql
-- Active characters with mockup URLs
SELECT slug, name_he, mockup_url, mockup_mug_url 
FROM pet_designs WHERE is_active=true ORDER BY slug;

-- Obsolete drafts (12)
SELECT slug, name_he, species 
FROM pet_designs WHERE is_active=false ORDER BY slug;

-- Storage file stats
SELECT bucket_id, name, metadata->>'size' AS bytes 
FROM storage.objects 
WHERE bucket_id='mockups' AND name LIKE 'bloom/%';
```

---

## 🧭 Key code locations in `App.jsx`

| Feature | Approx Line | Notes |
|---|---|---|
| `LANGS` dict (i18n he/en/ru) | 1394 – 1500 | The translations |
| `PRODUCTS` array | 1757 | mug/shirt/sticker with prices + printArea |
| `MOCKUP_URLS` const | 1855 | Generic product templates |
| `MugMockup` component | 1998 | Wraps `ProductMockupBase` for mug |
| `pet_designs` SELECT | 945 | Fetches catalog columns |
| `handleViewActiveCharacter` | ~1000 | BLOOM card → `/pets/` |
| `FloatingProductCard` | 1101 | Home carousel card |
| `BloomCardLite` | 1091 | Carousel variant |
| `DesignEditor` (admin) | 3494 | Admin `pet_designs` editor |
| `OrderPage` | 3814 | Order/checkout flow |
| `PetsPage` | 7721 | BLOOM gallery |
| `PetModal` | 8571 | Per-character detail modal |
| `handleOrder` | 8661 | Adds BLOOM character to cart |
| `ProductOption` | 9128 | Mug/shirt/sticker buttons |
| `previewProduct` state | ~8581 | Drives mug/shirt preview swap (added 2026-05-28) |

---

## 🐾 Quiz (`public/quiz/index.html`)

- **11 questions**: Q0 = species filter (🐶 / 🐱 / 🐾 both), Q1–Q10 = personality
- **6 personality dimensions**: `en` (energy), `so` (social), `el` (elegance), `bo` (bold), `br` (brains), `wa` (warmth)
- Weighted distance-matching against `PETS` array (70 items)
- Q0 filters the `PETS` pool by `sp: 'dog' | 'cat' | 'any'`
- ~300 lines vanilla JS, dark theme, back-to-shop button, WhatsApp share
- Routed by Vercel: `/quiz` has **RELAXED** CSP (inline scripts allowed); rest of site has **STRICT** CSP

---

## 🚀 Vercel configuration

- `vercel.json` — routes + security headers
- Strict CSP everywhere EXCEPT `/quiz` (negative lookahead in path patterns to avoid CSP intersection)
- HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin
- Domain: `sfalimshop.com` (Vercel-managed)
- Pro tier: **WAF rate limiting available** (use for Tranzila webhook rate limit / order-submit anti-bot)

---

## ✅ Current status (snapshot 2026-05-28)

- ✅ MAINTENANCE_MODE = true (visitors see maintenance screen)
- ⏳ Tranzila registered, awaiting supplier number
- ✅ 70 BLOOM active in DB (47 dogs + 23 cats)
- ✅ 70 BLOOM portraits + 70 mug mockups in Supabase storage
- ✅ 70 / 70 BLOOM shirt mockups live (Mokey AI, white+black per slug, uploaded + DB URLs set, 140 files).
  - 4 slugs use 2000×1600 landscape mockups (08_great_dane, 14_doberman, 61_bengal, 70_devon_rex); the other 66 are 1600×2000 portrait. Optional future polish: regenerate those 4 as portrait.
- ✅ Sticker print workflow ready (Roland PerfCutContour CMYK FOGRA39), awaiting Dima
- ✅ Security baseline: H1 + M1 + M6 + M7 done; C1/C2/H2/H3 deferred to Tranzila integration
- ✅ Quiz fully refreshed: Q0 species filter, dark theme, back button, WhatsApp share fix, OG image fix
- ✅ BLOOM mug mockup wired into PetModal (preview swap + product-specific cart thumbnail)
- ✅ PetsPage browse: sticky dog/cat/all emoji filter tabs (🐾/🐶/🐱, pinned at top:72 under the navbar) + breed search

---

## 🎓 Lessons learned (read before relevant tasks)

- **Windows ImageMagick**: Use `magick identify` / `magick convert`. Bare `convert` is a Windows disk tool that will NOT do what you want.
- **`.claude/` partial gitignore**: Only `.claude/agents/` is tracked. The rest (cache, projects, etc.) stays ignored.
- **Supabase storage URLs are public** — no auth needed for `curl` / `HEAD`.
- **BLOOM image standard**: 1414×2000, WebP, sRGB, target <500 KB.
- **Mockup paths**: `mockups/bloom/<slug>-clean.webp`, `mockups/bloom/<slug>-mug.webp`, `pet-designs/bloom/<slug>.webp`.
- **Pixel Agents** (VS Code ext.): unreliable for actual code work. Stick to regular Claude Code terminal.
- **CSP**: Two CSP headers on the same path → browser intersects → most-restrictive applied. Use negative-lookahead in path patterns to avoid this.
- **Staff bypass**: `?staff=1` query param bypasses MAINTENANCE_MODE for testing.
- **Sticker spot color**: must be EXACTLY `PerfCutContour` (perforated cut, Roland convention), NOT `CutContour` or other spellings.

---

## 💬 Communication style

- **Conversation language**: Hebrew (Gleb is Hebrew-first).
- **Agent output**: English (consistent across all subagents).
- **Style**: Concise, action-oriented, code-ready-to-paste, tables for comparisons, emoji for visual scanning, no excessive caveats.

---

## 💳 Tranzila integration (pending)

- Files in `supabase/functions/`:
  - `create-payment/` (stub)
  - `tranzila-webhook/` (stub)
- Env vars needed in Vercel:
  - `TRANZILA_SUPPLIER` (pending from Tranzila)
  - `TRANZILA_TK` (transaction key)
  - `SUPABASE_SERVICE_ROLE_KEY` (Supabase admin key)
- Open security tasks: C1, C2 (payment integrity), H2 (webhook HMAC), H3 (rate limit / WAF rules)

---

## 🤖 Agent roster (`.claude/agents/`)

Pre-existing: `explorer`, `code-finder`, `supabase-helper`, `rtl-auditor`, `ramkol`
Added 2026-05-27: `tranzila-specialist`, `i18n-translator`, `whatsapp-responder`, `seo-auditor`, `a11y-auditor`, `legal-content-checker`, `security-auditor`
Added 2026-05-28: `mockup-qa`, `pre-deploy-orchestrator`, `order-helper`, `bloom-curator`, `canva-pipeline`, `sticker-print-helper`
