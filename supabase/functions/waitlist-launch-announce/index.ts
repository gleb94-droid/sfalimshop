// waitlist-launch-announce — the one-time "we're live 🎉" launch email to the
// whole waitlist, in each subscriber's own language (he / en / ru).
//
// Visual design mirrors waitlist-welcome / send-order-confirmation exactly:
//   dark #0f0f0f header/footer with the Playfair "Sfalim Shop" wordmark +
//   orange #FF6B35 divider, white card on #f5f3ef, Heebo body, orange CTA.
//   Only difference vs the welcome mail: the copy + the CTA points to the live
//   BLOOM gallery instead of Instagram.
//
// ⛔ MANUAL-TRIGGER / DISABLED BY DEFAULT — this NEVER auto-fires. There is no
//    DB webhook, trigger, or cron. It only does anything when YOU explicitly
//    POST to it with the secret. A real mass-send is TRIPLE-gated:
//      1. x-webhook-secret header must match            (else 401, no work)
//      2. LAUNCH_ANNOUNCE_ENABLED secret must === "true"  (default OFF)
//      3. the request body must be exactly { "confirm": "SEND" }
//    Missing any one → a harmless DRY-RUN that only reports how many rows WOULD
//    be emailed (sends nothing, stamps nothing).
//
// Request contract (every call needs the x-webhook-secret header):
//   • TEST     { "test": true, "to": "you@example.com", "lang": "he" }
//       → sends ONE email to `to` only. No list read, no DB stamping.
//         Works with NO enable flag (so you can preview safely).
//   • DRY-RUN  {}  (or anything that isn't a confirmed real send)
//       → returns { dryRun:true, wouldEmail:N }. Sends nothing.
//   • REAL     { "confirm": "SEND" }  AND  LAUNCH_ANNOUNCE_ENABLED="true"
//       → emails every public.waitlist row WHERE launch_notified_at IS NULL,
//         then stamps launch_notified_at=now() per row on a successful send so
//         nobody is emailed twice. Batched + idempotent: re-running only picks
//         up rows still NULL (safe to re-run to retry failures).
//
// Deploy (does NOT send anything by itself):
//   supabase functions deploy waitlist-launch-announce --no-verify-jwt
//
// Secrets in Supabase → Edge Functions → Secrets:
//   RESEND_API_KEY             (required to send — already set)
//   SUPABASE_URL               (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY  (auto-injected — read all rows + stamp, bypasses RLS)
//   WAITLIST_FROM              (optional, default "BLOOM <hello@sfalimshop.com>")
//   LAUNCH_ANNOUNCE_ENABLED    ("true" to arm the REAL send; default OFF)
//   LAUNCH_ANNOUNCE_SECRET     (overrides the in-code webhook-secret fallback —
//                               set in prod + rotate the fallback; same TODO as
//                               waitlist-welcome)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// ── Brand (matches waitlist-welcome) ─────────────────────────────────────────
const ORANGE = `#FF6B35`;
const DARK = `#0f0f0f`;
const PAGE = `#f5f3ef`;
const SITE_URL = `https://www.sfalimshop.com`;
const SHOP_URL = `https://www.sfalimshop.com/#pets`; // CTA → the live BLOOM gallery
const INSTAGRAM = `https://www.instagram.com/sfalimshop/`;

// Webhook shared secret — REQUIRED from the LAUNCH_ANNOUNCE_SECRET Edge Function
// secret. No in-code fallback (fail-closed): if it isn't set, every request is
// rejected rather than authorized by a value committed to the repo.

// Batched sending — respect Resend's default ~2 req/s and the Edge Function
// wall-clock limit. If the list is large, the function returns after sending
// what it could; re-running resumes from the remaining NULL rows (idempotent).
const BATCH_SIZE = 20;
const BATCH_PAUSE_MS = 1100;

type Lang = "he" | "en" | "ru";

const COPY: Record<Lang, {
  subject: string;
  dir: "rtl" | "ltr";
  preheader: string;
  eyebrow: string;
  heading: string;
  body1: string;
  body2: string;
  cta: string;
  signoff: string;
  footerNote: string;
}> = {
  he: {
    subject: `אנחנו באוויר! 🎉 הגישה המוקדמת שלכם מחכה`,
    dir: `rtl`,
    preheader: `החנות נפתחה — ואתם מהראשונים להיכנס. בואו לפגוש את BLOOM.`,
    eyebrow: `— הרגע הזה הגיע —`,
    heading: `אנחנו חיים! 🎉`,
    body1: `חיכיתם — והנה זה קרה: חנות ספלים שופ נפתחה רשמית, ואתם, כחברי משפחת BLOOM, נכנסים ראשונים. כל הקולקציה כבר כאן.`,
    body2: `דיוקנאות כלבים וחתולים על חולצות, ספלים ומדבקות — מודפסים אצלנו בבית, באהבה. אפשר גם להוסיף את שם החיה שלכם. קפצו לבחור את האהובים עליכם לפני כולם.`,
    cta: `כניסה לחנות`,
    signoff: `תהנו,\nצוות ספלים שופ`,
    footerNote: `קיבלתם את המייל הזה כי נרשמתם לרשימת ההמתנה של ספלים שופ.`,
  },
  en: {
    subject: `We're live! 🎉 Your early access is here`,
    dir: `ltr`,
    preheader: `The shop just opened — and you're first through the door. Come meet BLOOM.`,
    eyebrow: `— The moment is here —`,
    heading: `We're live! 🎉`,
    body1: `You waited — and here it is: the Sfalim Shop is officially open, and as part of the BLOOM family, you're in first. The whole collection is ready and waiting.`,
    body2: `Dog & cat portraits on tees, mugs and stickers — printed by us, at home, with love. You can even add your pet's name. Come pick your favourites before everyone else.`,
    cta: `Enter the shop`,
    signoff: `Enjoy,\nThe Sfalim Shop team`,
    footerNote: `You received this email because you joined the Sfalim Shop waitlist.`,
  },
  ru: {
    subject: `Мы открылись! 🎉 Ваш ранний доступ уже здесь`,
    dir: `ltr`,
    preheader: `Магазин только что открылся — и вы заходите первыми. Знакомьтесь с BLOOM.`,
    eyebrow: `— Этот момент настал —`,
    heading: `Мы открылись! 🎉`,
    body1: `Вы ждали — и вот оно: магазин Sfalim Shop официально открыт, и вы, как часть семьи BLOOM, заходите первыми. Вся коллекция уже готова.`,
    body2: `Портреты собак и кошек на футболках, кружках и наклейках — мы печатаем их сами, дома, с любовью. Можно даже добавить имя вашего питомца. Заходите выбрать любимцев раньше всех.`,
    cta: `В магазин`,
    signoff: `Приятных покупок,\nКоманда Sfalim Shop`,
    footerNote: `Вы получили это письмо, потому что записались в лист ожидания Sfalim Shop.`,
  },
};

const pickLang = (raw: unknown): Lang => {
  const v = String(raw || ``).toLowerCase().slice(0, 2);
  return v === `en` || v === `ru` ? v : `he`;
};

const renderEmail = (lang: Lang): string => {
  const c = COPY[lang];
  const signoffHtml = c.signoff.split(`\n`).join(`<br>`);
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${c.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.subject}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};font-family:'Heebo','Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;direction:${c.dir};color:#1a1a1a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${c.preheader}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:${PAGE};">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.1);overflow:hidden;">

<tr><td style="background:${DARK};padding:56px 32px 48px;text-align:center;">
<h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:46px;font-weight:700;color:#ffffff;letter-spacing:0.5px;line-height:1.1;">Sfalim Shop</h1>
<div style="width:56px;height:3px;background:${ORANGE};margin:18px auto 14px;border-radius:2px;"></div>
<p style="margin:0;font-family:'Heebo',sans-serif;color:${ORANGE};font-size:13px;font-weight:500;letter-spacing:3px;text-transform:uppercase;">ספלים שופ</p>
</td></tr>

<tr><td style="padding:48px 40px 8px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0 0 10px;font-family:'Playfair Display',Georgia,serif;font-size:15px;color:${ORANGE};font-style:italic;letter-spacing:1px;">${c.eyebrow}</p>
<h2 style="margin:0;font-family:'Heebo',sans-serif;font-size:30px;color:#1a1a1a;font-weight:700;line-height:1.3;">${c.heading}</h2>
</td></tr>

<tr><td style="padding:20px 44px 8px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0 0 16px;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body1}</p>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body2}</p>
</td></tr>

<tr><td style="padding:28px 40px 8px;background:#ffffff;text-align:center;">
<a href="${SHOP_URL}" style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:50px;font-family:'Heebo',sans-serif;font-weight:600;font-size:15px;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(255,107,53,0.4);">
${c.cta} →
</a>
</td></tr>

<tr><td style="padding:28px 40px 44px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:15px;line-height:1.7;">${signoffHtml}</p>
</td></tr>

<tr><td style="background:${DARK};padding:32px 40px;">
<p style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:18px;color:#ffffff;text-align:center;font-weight:500;letter-spacing:0.5px;">Sfalim Shop</p>
<div style="width:32px;height:2px;background:${ORANGE};margin:0 auto 16px;border-radius:2px;"></div>
<p style="margin:0 0 14px;font-family:'Heebo',sans-serif;color:#888;font-size:12px;text-align:center;line-height:1.8;font-weight:300;">
<a href="${SITE_URL}" style="color:${ORANGE};text-decoration:none;">sfalimshop.com</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="mailto:hello@sfalimshop.com" style="color:#bbb;text-decoration:none;">hello@sfalimshop.com</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="${INSTAGRAM}" style="color:#bbb;text-decoration:none;">@sfalimshop</a>
</p>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#666;font-size:11px;text-align:center;line-height:1.6;font-weight:300;">${c.footerNote}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

// Single Resend send. Returns {ok} so the caller decides whether to stamp.
async function sendOne(email: string, lang: Lang, apiKey: string, from: string) {
  const c = COPY[lang];
  const res = await fetch(`https://api.resend.com/emails`, {
    method: `POST`,
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": `application/json` },
    body: JSON.stringify({ from, to: [email], subject: c.subject, html: renderEmail(lang) }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error(`[resend-error] ${res.status}: ${detail}`);
    return { ok: false as const, status: res.status };
  }
  const data = await res.json();
  return { ok: true as const, id: data?.id ?? null };
}

Deno.serve(async (req: Request) => {
  if (req.method === `OPTIONS`) return new Response(`ok`, { headers: cors });
  if (req.method !== `POST`) return json({ error: `method_not_allowed` }, 405);

  // ── Secret gate — ALWAYS enforced ──
  const expectedSecret = Deno.env.get(`LAUNCH_ANNOUNCE_SECRET`) ?? ``;
  if (!expectedSecret || req.headers.get(`x-webhook-secret`) !== expectedSecret) {
    return json({ error: `unauthorized`, skipped: true }, 401);
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; } // empty body → dry-run

  const apiKey = Deno.env.get(`RESEND_API_KEY`);
  const from = Deno.env.get(`WAITLIST_FROM`) || `BLOOM <hello@sfalimshop.com>`;

  // ── (a) TEST MODE — one email, no list, no stamping. Needs NO enable flag. ──
  if (payload?.test === true) {
    const to = String(payload?.to || ``).trim();
    if (!to) return json({ error: `test_requires_to` }, 400);
    const lang = pickLang(payload?.lang);
    if (!apiKey) return json({ dryRun: true, test: true, note: `no RESEND_API_KEY`, lang, to });
    const r = await sendOne(to, lang, apiKey, from);
    return r.ok
      ? json({ test: true, sent: true, lang, to, id: r.id })
      : json({ test: true, error: `send_failed`, status: r.status }, 502);
  }

  // ── Service-role client (bypasses RLS → read all rows + stamp) ──
  const supabaseUrl = Deno.env.get(`SUPABASE_URL`) ?? ``;
  const serviceRoleKey = Deno.env.get(`SUPABASE_SERVICE_ROLE_KEY`) ?? ``;
  if (!supabaseUrl || !serviceRoleKey) return json({ error: `server_misconfig` }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Real send needs BOTH the enable flag AND an explicit confirm AND a key ──
  const enabled = Deno.env.get(`LAUNCH_ANNOUNCE_ENABLED`) === `true`; // default OFF
  const confirmed = payload?.confirm === `SEND`;
  const realSend = enabled && confirmed && !!apiKey;

  if (!realSend) {
    // ── (b) DRY-RUN — count rows that WOULD be emailed. Sends nothing. ──
    const { count, error } = await supabase
      .from(`waitlist`)
      .select(`id`, { count: `exact`, head: true })
      .is(`launch_notified_at`, null);
    if (error) return json({ error: `db_read_failed`, detail: error.message }, 500);
    return json({
      dryRun: true,
      wouldEmail: count ?? 0,
      reason: { enabled, confirmed, hasKey: !!apiKey },
      note: `To really send: set LAUNCH_ANNOUNCE_ENABLED="true" AND POST {"confirm":"SEND"}.`,
    });
  }

  // ── (c) REAL SEND — batched, idempotent, stamp-on-success ──
  let totalSent = 0, totalFailed = 0;
  const failures: Array<{ id: string; status?: number }> = [];

  for (;;) {
    // Always page from the top of the still-NULL set; each successful stamp
    // removes a row, so the window advances and a re-run only retries NULLs.
    const { data: rows, error } = await supabase
      .from(`waitlist`)
      .select(`id, email, lang`)
      .is(`launch_notified_at`, null)
      .order(`created_at`, { ascending: true })
      .limit(BATCH_SIZE);
    if (error) return json({ error: `db_read_failed`, detail: error.message, totalSent, totalFailed }, 500);
    if (!rows || rows.length === 0) break;

    let progressed = false;
    for (const row of rows) {
      const email = String(row.email || ``).trim();
      if (!email) {
        // Stamp malformed rows so they don't wedge the loop forever.
        await supabase.from(`waitlist`).update({ launch_notified_at: new Date().toISOString() }).eq(`id`, row.id);
        progressed = true;
        continue;
      }
      const r = await sendOne(email, pickLang(row.lang), apiKey!, from);
      if (r.ok) {
        const { error: upErr } = await supabase
          .from(`waitlist`)
          .update({ launch_notified_at: new Date().toISOString() })
          .eq(`id`, row.id)
          .is(`launch_notified_at`, null); // guard against a concurrent double-stamp
        if (!upErr) { totalSent++; progressed = true; }
        else { totalFailed++; failures.push({ id: row.id }); }
      } else {
        // Leave launch_notified_at NULL → a later re-run retries this row.
        totalFailed++;
        failures.push({ id: row.id, status: r.status });
      }
    }

    // If a whole batch made no progress (all failing + unstamped), stop rather
    // than spin forever on the same rows (e.g. a Resend outage).
    if (!progressed) break;
    if (rows.length < BATCH_SIZE) break;
    await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
  }

  console.log(`[launch-announce] done sent=${totalSent} failed=${totalFailed}`);
  return json({ done: true, sent: totalSent, failed: totalFailed, failures });
});
