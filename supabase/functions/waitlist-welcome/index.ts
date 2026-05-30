// waitlist-welcome — sends a BLOOM-branded welcome email to a new waitlist
// signup, in the subscriber's own language (he / en / ru).
//
// Trigger: Supabase Database Webhook on INSERT into public.waitlist.
//   (Dashboard → Database → Webhooks → "Create a new hook" → table=waitlist,
//    events=INSERT, type=HTTP Request, method=POST, URL = this function.)
//
// SAFETY — this function will NOT send any real email until BOTH are true:
//   1. WAITLIST_WELCOME_ENABLED = "true"   (master flag, default OFF)
//   2. RESEND_API_KEY is set               (the provider key)
// While the flag is off it logs "[dry-run]" and returns 200 — so you can deploy
// and wire the webhook safely, then flip the flag only when you're ready.
//
// Deploy (does NOT send anything by itself):
//   supabase functions deploy waitlist-welcome --no-verify-jwt
//
// Secrets to set in Supabase → Edge Functions → Secrets (see README.md):
//   RESEND_API_KEY           (required to actually send)
//   WAITLIST_WELCOME_ENABLED ("true" to arm; anything else = dry-run)
//   WAITLIST_FROM            (optional, default "BLOOM <hello@sfalimshop.com>")
//   WAITLIST_WEBHOOK_SECRET  (optional; if set, the webhook must send a
//                             matching "x-webhook-secret" header)

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

// ── Brand ───────────────────────────────────────────────────────────────────
const BROWN = `#3A2E28`;
const ORANGE = `#E8743B`;
const CREAM = `#FBF6F0`;
const LOGO_URL = `https://sfalimshop.com/logo.jpg`;
const INSTAGRAM = `https://instagram.com/sfalimshop`;

type Lang = "he" | "en" | "ru";

// Per-language copy. The email is sent in the subscriber's own language only.
const COPY: Record<Lang, {
  subject: string;
  dir: "rtl" | "ltr";
  preheader: string;
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
  const align = c.dir === `rtl` ? `right` : `left`;
  const signoffHtml = c.signoff.split(`\n`).join(`<br/>`);
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${c.dir}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${c.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 0;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(58,46,40,0.12);">
      <tr>
        <td style="background:${BROWN};padding:36px 32px;text-align:center;">
          <img src="${LOGO_URL}" alt="Sfalim Shop" width="72" height="72" style="border-radius:16px;display:inline-block;" />
          <div style="margin-top:14px;font-family:Pacifico,cursive;font-size:34px;color:${ORANGE};">Bloom.</div>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;direction:${c.dir};text-align:${align};color:${BROWN};">
          <h1 style="margin:0 0 16px;font-size:23px;line-height:1.3;color:${BROWN};">${c.heading}</h1>
          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#4a3d35;">${c.body1}</p>
          <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#4a3d35;">${c.body2}</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr><td style="border-radius:999px;background:${ORANGE};">
            <a href="${INSTAGRAM}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${c.cta} →</a>
          </td></tr></table>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#4a3d35;">${signoffHtml}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:${BROWN};text-align:center;">
          <div style="font-family:Pacifico,cursive;font-size:15px;color:${ORANGE};margin-bottom:6px;">Bloom.</div>
          <div style="font-size:12px;color:#cdbcae;line-height:1.6;">@sfalimshop · sfalimshop.com<br/>${c.footerNote}</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
};

Deno.serve(async (req: Request) => {
  if (req.method === `OPTIONS`) return new Response(`ok`, { headers: cors });
  if (req.method !== `POST`) return json({ error: `method_not_allowed` }, 405);

  // Optional shared-secret check (set WAITLIST_WEBHOOK_SECRET + matching header
  // on the DB webhook to block anyone who finds the public function URL).
  const expectedSecret = Deno.env.get(`WAITLIST_WEBHOOK_SECRET`);
  if (expectedSecret) {
    const got = req.headers.get(`x-webhook-secret`);
    if (got !== expectedSecret) return json({ error: `unauthorized` }, 401);
  }

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

  const enabled = Deno.env.get(`WAITLIST_WELCOME_ENABLED`) === `true`;
  const apiKey = Deno.env.get(`RESEND_API_KEY`);
  const from = Deno.env.get(`WAITLIST_FROM`) || `BLOOM <hello@sfalimshop.com>`;

  // Dry-run unless fully armed. Deploying alone never sends.
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
