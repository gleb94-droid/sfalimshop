// ============================================================================
// assistant-chat — the on-site AI helper ("Sfalim helper").
//
// A grounded, trilingual (he/en/ru) customer assistant. It answers ONLY from the
// curated shop facts below (prices, delivery, turnaround, how it works) so it can
// never invent a price or policy; anything it doesn't know → it points the customer
// to WhatsApp. It takes no payments and creates no orders.
//
// Security / cost:
//   - The Anthropic key lives ONLY in the Supabase secret ANTHROPIC_API_KEY
//     (never in the browser). Set it in Supabase → Edge Functions → Secrets.
//   - Model: Claude Sonnet 4.6 (fluent Hebrew). System prompt is prompt-cached.
//   - max_tokens capped, conversation length capped, per-IP rate limit, and a
//     kill-switch (ASSISTANT_ENABLED secret = "false" turns it off instantly).
//   - On any error / no credit / bad key → a graceful WhatsApp fallback, never a crash.
//
// KEEP THE FACTS IN SYNC with App.jsx (prices, delivery, BLOOM, commission).
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// Kill-switch: set ASSISTANT_ENABLED="false" in secrets to disable instantly.
const ENABLED = (Deno.env.get("ASSISTANT_ENABLED") || "true") !== "false";
// Salt for hashing IPs (rate-limit only). Override with ASSISTANT_IP_SALT secret.
const IP_SALT = Deno.env.get("ASSISTANT_IP_SALT") || "sfalim-assistant-v1";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 500;            // short, friendly replies
const MAX_TURNS = 12;              // keep the last N messages only
const MAX_CHARS = 1200;            // per-message cap
const RATE_WINDOW_SEC = 60;        // per-IP window
const RATE_MAX = 20;               // max user messages per window

// ── The assistant's grounded knowledge + behaviour rules ────────────────────
const SYSTEM_PROMPT = `You are the friendly customer assistant for **Sfalim Shop** (ספלים שופ, sfalimshop.com) — a Hebrew-first print-on-demand shop in Be'er Sheva, Israel. The owner prints everything by hand in-house. Instagram: @sfalimshop. Email: hello@sfalimshop.com.

Your job: help visitors warmly and briefly — answer questions, help them choose a mug / pet character / gift, and guide them to order or to WhatsApp. You do NOT take payments or place orders.

ALWAYS answer the customer's actual question directly and FIRST, using the exact facts below — including exact prices (e.g. "a BLOOM character on a mug is ₪59"). Keep it short; only after answering may you add one brief suggestion. NEVER reply with a generic menu, and NEVER say a message "didn't come through" — always respond to what the customer actually wrote.

# THE FACTS (this is the ONLY source of truth — never go beyond it)

## Mugs (our core product — start here)
- Pet character (BLOOM) on a mug: ₪59.
- Your own design / photo / logo on a mug: ₪69.
- 11oz ceramic, sublimation print, dishwasher-safe, hand-printed in Be'er Sheva.
- Ready in about 2–3 days. Mugs make a perfect gift (easy to wrap and give).

## Shirts (Oversize & Stone-wash only)
- Pet character (BLOOM) on an Oversize shirt: ₪119.
- Your own design on a shirt (Oversize or Stone-wash, any size S–XXL): ₪149.
- 100% combed cotton (Oversize) / soft vintage stone-wash finish.
- Made & shipped in about 5–7 business days.

## "We design it for you" (commission — you pay first, then send photos/idea on WhatsApp; we design, send a preview, and revise until you're happy)
- Pet portrait: on a shirt ₪189, on a mug ₪119.
- Custom design (text / logo / idea): on a shirt ₪149, on a mug ₪89.

## BLOOM collection
- 70 illustrated pet portraits — dog and cat breeds. Pick your breed, print it on a mug or shirt.
- Optional: add your pet's name (personalization) for +₪20.

## Stickers
- Round or square vinyl, water- & UV-resistant: ₪15 small / ₪25 medium / ₪35 large / ₪45 sheet. BLOOM sticker pack: ₪35.

## Delivery (chosen at checkout)
- Personal handoff in Be'er Sheva: no delivery fee (coordinated on WhatsApp).
- UPS pickup point: ₪27.
- UPS home delivery: ₪55.

## How ordering works
Pick a BLOOM character or upload your own design → choose mug/shirt → add to cart → pay securely by card → we print in-house → ship. A receipt is issued automatically. For "we design it for you", you pay first, then send your photos/idea on WhatsApp.

## Good to know (FAQ)
- Care: mugs are dishwasher-safe (hand-washing keeps the print vivid longest). Shirts: wash inside-out in cold water on a gentle cycle, and avoid high-heat tumble-drying.
- Payment: secure card payment (processed by Tranzila). A receipt is issued automatically — we are an exempt dealer (עוסק פטור), so no VAT is added.
- Cancellation / returns: ready-made items can be cancelled under Israeli consumer law. Custom & personalized items (anything printed with your design, a chosen BLOOM character, or a pet name) are made-to-order, so once production starts they can't be cancelled or refunded. If anything arrives defective, message us on WhatsApp and we'll make it right.
- Shirt sizes: S, M, L, XL, XXL. Oversize fits loose/relaxed.

# HARD RULES (follow exactly)
1. Answer ONLY from the facts above. If you don't know, or it's about a specific order, stock, a custom quote, timing for a special case, or anything not listed → say you'll connect them with the team on WhatsApp. NEVER guess or invent a price, date, or policy.
2. The designs are custom-designed / illustrated — never call them "hand-drawn", "drawn by hand", or "hand-illustrated". BUT if a customer asks whether they are drawn/made by hand, answer the question naturally and honestly: the artwork is custom-designed, and every product is printed by hand in Be'er Sheva 🧡 — answer it, never dodge or deflect. ("Printed by hand" / "hand-printed in Be'er Sheva" IS true and good to say.)
3. For free delivery, say "no delivery fee" (Hebrew: "ללא עלות משלוח"). Avoid the word "חינם".
4. You cannot take payment or place an order yourself. Guide them to order on the site, or to WhatsApp for quotes/help.
5. Reply in the SAME language as the user's latest message — Hebrew, English, or Russian. If unclear, default to Hebrew.
6. Be warm, personal, and concise (usually 2–4 short sentences). Light, tasteful emoji are welcome (🧡 🐾 ☕). The voice: "printed by hand with love in Be'er Sheva".
7. Stay on topic (the shop, products, pets, gifts, orders). Politely decline anything unrelated and steer back.
8. When recommending, lean into mugs (our core, cheapest, giftable) and the BLOOM characters. Suggest the customer browse the BLOOM gallery or the mugs page, or message on WhatsApp for anything custom.
9. When you recommend specific pet breeds/characters from the BLOOM collection, add as the VERY LAST line, on its own line, exactly: "SUGGEST: <1-3 English breed names, comma-separated>" (e.g. "SUGGEST: Golden Retriever, Tuxedo Cat"). This line is hidden from the customer and is used to show clickable cards — only include real dog/cat breeds you actually recommended, and never write the word SUGGEST anywhere else.`;

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashIp(ip: string): Promise<string> {
  try {
    const data = new TextEncoder().encode(`${IP_SALT}:${ip}`);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  } catch (_) {
    return "";
  }
}

// A friendly, language-aware fallback that always routes to WhatsApp.
function fallbackReply(lang: string): string {
  if (lang === "he") return "אני כאן כדי לעזור 🧡 בכל שאלה ספציפית או הזמנה אפשר לכתוב לנו בוואטסאפ ונחזור אליכם מהר.";
  if (lang === "ru") return "Я рядом, чтобы помочь 🧡 По любому конкретному вопросу или заказу напишите нам в WhatsApp — ответим быстро.";
  return "I'm here to help 🧡 For anything specific or to order, message us on WhatsApp and we'll get right back to you.";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonRes({ error: "method_not_allowed" }, 405);

  let lang = "he";
  try {
    const body = await req.json().catch(() => ({}));
    lang = ["he", "en", "ru"].includes(body?.lang) ? body.lang : "he";
    const page = typeof body?.page === "string" ? body.page.slice(0, 40) : "";

    if (!ENABLED) return jsonRes({ reply: fallbackReply(lang), disabled: true });
    if (!ANTHROPIC_API_KEY) return jsonRes({ reply: fallbackReply(lang), unconfigured: true });

    // Sanitize the conversation: keep only well-formed user/assistant turns, cap
    // length and size, and ensure it starts with a user turn.
    const raw = Array.isArray(body?.messages) ? body.messages : [];
    let messages = raw
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_CHARS) }))
      .slice(-MAX_TURNS);
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length) return jsonRes({ reply: fallbackReply(lang) });

    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    // Service-role client for best-effort logging + rate limiting (skips silently
    // if the table isn't there yet).
    const admin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const ipHash = ip ? await hashIp(ip) : "";

    // Per-IP rate limit (best effort).
    if (admin && ipHash) {
      try {
        const since = new Date(Date.now() - RATE_WINDOW_SEC * 1000).toISOString();
        const { count } = await admin
          .from("assistant_logs")
          .select("id", { count: "exact", head: true })
          .eq("ip_hash", ipHash)
          .gte("created_at", since);
        if ((count || 0) >= RATE_MAX) {
          const msg = lang === "he"
            ? "רגע אחד 🙂 קצת הרבה הודעות ברצף — נסו שוב עוד דקה, או כתבו לנו בוואטסאפ."
            : lang === "ru"
              ? "Секунду 🙂 Слишком много сообщений подряд — попробуйте через минуту или напишите нам в WhatsApp."
              : "One sec 🙂 That's a lot of messages at once — try again in a minute, or message us on WhatsApp.";
          return jsonRes({ reply: msg, rate_limited: true });
        }
      } catch (_) { /* table may not exist yet — ignore */ }
    }

    // Call Claude with a prompt-cached system prompt.
    let reply = "";
    try {
      const aRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages,
        }),
      });
      const data = await aRes.json().catch(() => ({}));
      if (!aRes.ok) {
        console.error("Anthropic error:", aRes.status, JSON.stringify(data).slice(0, 500));
        return jsonRes({ reply: fallbackReply(lang), error: "upstream" });
      }
      reply = (Array.isArray(data?.content) ? data.content : [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("\n")
        .trim();
    } catch (err) {
      console.error("Anthropic fetch failed:", String(err));
      return jsonRes({ reply: fallbackReply(lang), error: "fetch" });
    }
    if (!reply) reply = fallbackReply(lang);

    // Optional trailing "SUGGEST: Breed1, Breed2" line → clickable product cards.
    // The line is hidden from the customer; we look each breed up in the catalog.
    let suggestions: Array<Record<string, unknown>> = [];
    const sm = reply.match(/SUGGEST:\s*([^\n]+)\s*$/i);
    if (sm) {
      reply = reply.replace(/\n?\s*SUGGEST:[^\n]*$/i, "").trim();
      if (admin) {
        const names = sm[1].split(",").map((s) => s.replace(/[^a-zA-Z \-]/g, "").trim()).filter((s) => s.length >= 2).slice(0, 3);
        for (const nm of names) {
          try {
            const { data } = await admin.from("pet_designs")
              .select("slug, name_he, name_en, name_ru, mockup_url")
              .eq("is_active", true)
              .or(`breed_en.ilike.%${nm}%,name_en.ilike.%${nm}%`)
              .limit(1);
            const d = data && data[0];
            if (d && !suggestions.find((s) => s.slug === d.slug)) {
              suggestions.push({ slug: d.slug, name_he: d.name_he, name_en: d.name_en, name_ru: d.name_ru, image: d.mockup_url });
            }
          } catch (_) { /* ignore */ }
        }
      }
    }

    // Log the user's question (best effort, anonymized).
    if (admin) {
      try {
        await admin.from("assistant_logs").insert({
          lang, page, role: "user",
          message: lastUser.slice(0, 1000),
          ip_hash: ipHash || null,
        });
      } catch (_) { /* ignore */ }
    }

    return jsonRes({ reply, suggestions });
  } catch (err) {
    console.error("assistant-chat error:", String(err));
    return jsonRes({ reply: fallbackReply(lang) });
  }
});
