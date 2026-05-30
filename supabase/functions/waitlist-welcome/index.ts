// waitlist-welcome — sends a BLOOM-branded welcome email to a new waitlist
// signup, in the subscriber's own language (he / en / ru).
//
// Visual design mirrors the send-order-confirmation email exactly:
//   dark #0f0f0f header/footer with the Playfair "Sfalim Shop" wordmark +
//   orange #FF6B35 divider, white card on #f5f3ef, Heebo body, orange accents.
//   No logo image (text wordmark only) — same as send-order-confirmation.
//
// Trigger: Supabase Database Webhook on INSERT into public.waitlist.
//   (Dashboard → Database → Webhooks → "Create a new hook" → table=waitlist,
//    events=INSERT, type=HTTP Request, method=POST, URL = this function.)
//
// ARMED — this function sends a real email when BOTH are true:
//   1. WAITLIST_WELCOME_ENABLED is anything other than "false"  (default ON)
//   2. RESEND_API_KEY is set                                    (provider key)
// Kill-switch: set the WAITLIST_WELCOME_ENABLED secret to "false" to drop back
// to dry-run without redeploying.
//
// AUTH — every request MUST carry an "x-webhook-secret" header matching the
// webhook secret (the WAITLIST_WEBHOOK_SECRET env, else the in-code fallback
// below). Requests without it get 401 and send nothing, so only the database
// webhook on public.waitlist can trigger a real send — not random direct calls.
//
// Deploy:
//   supabase functions deploy waitlist-welcome --no-verify-jwt
//
// Secrets in Supabase → Edge Functions → Secrets (optional overrides):
//   RESEND_API_KEY           (required to actually send)
//   WAITLIST_WELCOME_ENABLED ("false" to disarm; default = armed)
//   WAITLIST_FROM            (optional, default "BLOOM <hello@sfalimshop.com>")
//   WAITLIST_WEBHOOK_SECRET  (overrides the in-code webhook-secret fallback —
//                             set this in prod and rotate the fallback)

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

// ── Brand (matches send-order-confirmation) ──────────────────────────────────
const ORANGE = `#FF6B35`;
const DARK = `#0f0f0f`;
const PAGE = `#f5f3ef`;
const SITE_URL = `https://www.sfalimshop.com`;
const INSTAGRAM = `https://www.instagram.com/sfalimshop/`;

// Webhook shared secret (in-code fallback). The DB webhook on public.waitlist
// sends this as the "x-webhook-secret" header. Override in prod by setting the
// WAITLIST_WEBHOOK_SECRET Edge Function secret, then rotate this value.
const WEBHOOK_SECRET_FALLBACK = `7e4edf71cb1d7514b43a6def3502be33aeffede9d75928e6`;

type Lang = "he" | "en" | "ru";

// Per-language copy. The email is sent in the subscriber's own language only.
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
    subject: `אתם במשפחת BLOOM 🐾`,
    dir: `rtl`,
    preheader: `נשמור לכם גישה מוקדמת — נעדכן ברגע שהדלתות נפתחות.`,
    eyebrow: `— הצטרפתם בהצלחה —`,
    heading: `ברוכים הבאים למשפחת BLOOM 🐾`,
    body1: `תודה שהצטרפתם! אתם ברשימה — וזה אומר גישה מוקדמת לקולקציית BLOOM: דיוקנאות כלבים וחתולים על חולצות, ספלים ומדבקות.`,
    body2: `אנחנו עוד מלטשים את הפרטים האחרונים. ברגע שהחנות נפתחת — אתם תהיו מהראשונים לדעת, לפני כולם.`,
    cta: `עקבו אחרינו באינסטגרם`,
    signoff: `נתראה בקרוב,\nצוות ספלים שופ`,
    footerNote: `קיבלתם את המייל הזה כי נרשמתם לרשימת ההמתנה של ספלים שופ.`,
  },
  en: {
    subject: `You're in the BLOOM Family 🐾`,
    dir: `ltr`,
    preheader: `Your early access is reserved — we'll ping you the moment doors open.`,
    eyebrow: `— You're on the list —`,
    heading: `Welcome to the BLOOM Family 🐾`,
    body1: `Thanks for joining! You're on the list — which means early access to the BLOOM collection: dog & cat portraits on tees, mugs and stickers.`,
    body2: `We're polishing the last details. The moment the shop opens, you'll be among the first to know — before everyone else.`,
    cta: `Follow us on Instagram`,
    signoff: `See you soon,\nThe Sfalim Shop team`,
    footerNote: `You received this email because you joined the Sfalim Shop waitlist.`,
  },
  ru: {
    subject: `Вы в семье BLOOM 🐾`,
    dir: `ltr`,
    preheader: `Ранний доступ за вами — сообщим, как только откроются двери.`,
    eyebrow: `— Вы в списке —`,
    heading: `Добро пожаловать в семью BLOOM 🐾`,
    body1: `Спасибо, что присоединились! Вы в списке — а значит, у вас ранний доступ к коллекции BLOOM: портреты собак и кошек на футболках, кружках и наклейках.`,
    body2: `Мы наводим последние штрихи. Как только магазин откроется, вы узнаете одними из первых — раньше всех.`,
    cta: `Подписывайтесь в Instagram`,
    signoff: `До скорого,\nКоманда Sfalim Shop`,
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
<h2 style="margin:0;font-family:'Heebo',sans-serif;font-size:28px;color:#1a1a1a;font-weight:700;line-height:1.35;">${c.heading}</h2>
</td></tr>

<tr><td style="padding:20px 44px 8px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0 0 16px;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body1}</p>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body2}</p>
</td></tr>

<tr><td style="padding:28px 40px 8px;background:#ffffff;text-align:center;">
<a href="${INSTAGRAM}" style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:50px;font-family:'Heebo',sans-serif;font-weight:600;font-size:15px;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(255,107,53,0.4);">
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

Deno.serve(async (req: Request) => {
  if (req.method === `OPTIONS`) return new Response(`ok`, { headers: cors });
  if (req.method !== `POST`) return json({ error: `method_not_allowed` }, 405);

  // Shared-secret gate — ALWAYS enforced. Only the DB webhook (which sends the
  // matching x-webhook-secret header) can reach the send path; anyone who finds
  // the public function URL and calls it without the secret gets 401, no send.
  const expectedSecret = Deno.env.get(`WAITLIST_WEBHOOK_SECRET`) || WEBHOOK_SECRET_FALLBACK;
  const got = req.headers.get(`x-webhook-secret`);
  if (got !== expectedSecret) return json({ error: `unauthorized`, skipped: true }, 401);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: `invalid_json` }, 400);
  }

  // Supabase DB webhook shape: { type, table, record, old_record }
  const record = payload?.record ?? payload;
  const email = String(record?.email || ``).trim();
  if (!email) return json({ error: `no_email`, skipped: true }, 200);

  // Guard: never email someone already flagged as launch-notified.
  if (record?.launch_notified_at) {
    console.log(`[skip] launch_notified_at set for ${email}`);
    return json({ skipped: `already_notified` }, 200);
  }

  const lang = pickLang(record?.lang);
  const c = COPY[lang];

  // Armed by default. Kill-switch: set WAITLIST_WELCOME_ENABLED="false".
  const enabled = Deno.env.get(`WAITLIST_WELCOME_ENABLED`) !== `false`;
  const apiKey = Deno.env.get(`RESEND_API_KEY`);
  const from = Deno.env.get(`WAITLIST_FROM`) || `BLOOM <hello@sfalimshop.com>`;

  // Dry-run only if explicitly disarmed or the provider key is missing.
  if (!enabled || !apiKey) {
    console.log(`[dry-run] would send "${c.subject}" (lang=${lang}) to ${email} — enabled=${enabled} hasKey=${!!apiKey}`);
    return json({ dryRun: true, lang, to: email });
  }

  const html = renderEmail(lang);
  try {
    const res = await fetch(`https://api.resend.com/emails`, {
      method: `POST`,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": `application/json`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: c.subject,
        html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[resend-error] ${res.status}: ${detail}`);
      return json({ error: `send_failed`, status: res.status }, 502);
    }
    const data = await res.json();
    console.log(`[sent] ${email} (lang=${lang}) id=${data?.id ?? `?`}`);
    return json({ sent: true, lang, to: email, id: data?.id ?? null });
  } catch (err) {
    console.error(`[exception] ${String(err)}`);
    return json({ error: `exception` }, 500);
  }
});
