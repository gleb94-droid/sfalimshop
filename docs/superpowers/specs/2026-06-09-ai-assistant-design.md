# AI Assistant ("Sfalim helper") — Design Spec

- **Date:** 2026-06-09
- **Owner:** Gleb · **Branch:** `launch-prep` (NEVER `main` without explicit approval)
- **Status:** Design approved (2026-06-09). **Build before launch**, shipped behind a feature flag (`ASSISTANT_ENABLED`) and behind the maintenance gate. Live answers need an Anthropic API key (owner task).

## Goal

A friendly, trilingual (he/en/ru) on-site AI assistant that helps customers — answers FAQ, helps pick a mug / breed / gift, and hands off to WhatsApp for orders & quotes — **grounded strictly in the real shop facts so it NEVER invents prices or policies.** Mug-first, conversion-leaning, warm brand voice. Cost-controlled (Haiku + prompt caching + caps + the prepaid-credit hard ceiling).

## Locked decisions

- **Surface:** floating chat widget on the site (near the WhatsApp FAB).
- **Scope:** helper + concierge. The bot takes **no payments and creates no orders** — it routes to the order flow / WhatsApp.
- **Timing:** build before launch; ship behind `ASSISTANT_ENABLED` so it can be toggled instantly.
- **Model:** Claude **Haiku 4.5** (`claude-haiku-4-5`) — cost-efficient, plenty capable for grounded support.
- **Languages:** he/en/ru; replies in the site language and matches the user's language if they switch.
- **Persona:** a **BLOOM mascot** (friendly pet) with a name + avatar.
- **Billing:** owner **prepaid credits** (hard ceiling); auto-reload OFF; monthly spend limit set in the Anthropic console. No usage → no cost.

## v1 features

Base: grounded chat (FAQ + concierge) + WhatsApp handoff. Plus the approved upgrades:
1. **Quick-reply chips** (common intents) — less typing, guides the chat, cheaper tokens.
2. **Gift-finder mode** — occasion/recipient → recommend a mug / character / set.
3. **Mascot persona** — name + BLOOM avatar; warm voice.
4. **Smart product links** — the bot can suggest a specific character/mug → the widget renders a clickable card that opens the `/pets` modal or `/mugs`.
5. **Anonymized question log** — store `(lang, message, page, timestamp)` in a new Supabase table (RLS: admin-read only) so the owner sees what people ask.
6. **Subtle proactive opener** on `/mugs` & `/pets` (after ~6s, dismissible, once per session).

## Phase 2 (post-launch)
- Order-status lookup (read-only; careful, order-scoped access).
- Live DB prices/breeds via tool-calling (never stale even if a price changes).
- Commission brief intake → structured WhatsApp handoff.
- 👍/👎 answer feedback.

## Architecture

- **Backend — Supabase Edge Function `assistant-chat`** (`verify_jwt=false`, public). Input: `{messages, lang, page}`. Calls Claude Haiku 4.5 via the Anthropic API; **key = Supabase secret `ANTHROPIC_API_KEY`** (never in the browser). System prompt = the curated grounding below, with **prompt caching** on the system block. Returns `{reply, suggestions?}` — `suggestions` = optional structured product links the widget renders as cards.
- **Grounding (system prompt)** — the real shop facts: prices (mug ₪59 BLOOM / ₪69 custom; shirt Oversize+Stone-wash ₪149, BLOOM-on-shirt ₪119; commission shirt ₪149/₪189, mug ₪89/₪119; stickers); delivery (personal Be'er Sheva ₪0 = "ללא עלות", UPS point ₪27, UPS home ₪55); turnaround (mugs 2–3 days, shirts 5–7); how BLOOM works (70 characters → pick breed → print on mug/shirt); custom/commission flow (pay-first, send photos on WhatsApp); policy summary; WhatsApp number; brand voice ("printed by hand with love in Be'er Sheva 🧡"). **HARD RULES:** answer only from this; never invent a price or policy; **never say "hand-drawn / by hand / hand-illustrated"** (designs are AI+Canva — owner's choice not to mention that; "printed by hand" IS fine); use **"ללא עלות"** not "חינם"; for orders / quotes / anything unsure → **hand off to WhatsApp**; politely refuse off-topic / abuse.
- **Frontend — chat widget in `App.jsx`** (floating button + panel), trilingual, warm brand styling, quick-reply chips, renders product-link cards, proactive opener on `/mugs` & `/pets`. Talks to the edge function (same-origin Supabase → CSP `connect-src *.supabase.co` already allows it).
- **Safety / cost** — Haiku + system-prompt caching + `max_tokens` cap (~400) + conversation-length cap (~12 turns then suggest WhatsApp) + per-session/IP rate limit + **`ASSISTANT_ENABLED` kill-switch** + the prepaid-credit hard ceiling. Log token usage.

## Owner task (1)

Create an **Anthropic API key** (console.anthropic.com), set a **monthly spend limit** (e.g. $20) and load a small **prepaid credit** (~$10), then it goes into the Supabase secret `ANTHROPIC_API_KEY`. Build proceeds without it; the final **live test** needs it.

## Build waves
- **A.** Edge function `assistant-chat` (Claude + grounding + safety) + the question-log table/migration.
- **B.** Chat widget (button + panel + chips + product cards), trilingual, behind `ASSISTANT_ENABLED`.
- **C.** Gift-finder flow + proactive opener + smart-product-link wiring.
- **D.** Tests he/en/ru + a "doesn't lie about prices" check + cost-control verification; all behind the gate.

## Constraints (must honor)
Template literals only; trilingual he/en/ru; the honesty rule (no "hand-drawn"); the delivery-copy rule ("ללא עלות"); **never touch live payment code**; secrets only in Supabase secrets/env; don't weaken RLS; ship behind `ASSISTANT_ENABLED` + behind the maintenance gate; no public launch without the owner's command.

## Out of scope (v1)
Payments/orders by the bot; order-status lookup; live DB tool-calling; commission intake; cross-session memory; voice.
