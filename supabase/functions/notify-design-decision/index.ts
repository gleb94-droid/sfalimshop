// notify-design-decision — emails the customer when the shop APPROVES or asks for
// CHANGES on a custom design. BLOOM-branded, in the customer's own language.
//
// Trigger: Supabase Database Webhook on UPDATE of public.orders.
//   Dashboard → Database → Webhooks → Create a new hook:
//     table = orders, events = UPDATE, type = HTTP Request, method = POST,
//     URL = this function's URL,
//     HTTP Header: x-webhook-secret = <the secret below>.
//
// Fires a real email ONLY when ALL are true:
//   1. design_approval_status actually CHANGED, and the new value is
//      'approved' or 'rejected' (so resubmits / unrelated edits send nothing).
//   2. requires_design_approval = true (custom-upload orders only).
//   3. DESIGN_NOTIFY_ENABLED secret === "true"   (DEFAULT: OFF / dry-run).
//   4. RESEND_API_KEY is set.
// Kill-switch: leave DESIGN_NOTIFY_ENABLED unset (or != "true") to stay in
// dry-run — the function logs what it WOULD send and sends nothing.
//
// AUTH: every request must carry x-webhook-secret matching DESIGN_NOTIFY_WEBHOOK_SECRET
// (or the in-code fallback). Without it → 401, nothing sent.
//
// Deploy: supabase functions deploy notify-design-decision --no-verify-jwt

const cors = {
  "Access-Control-Allow-Origin": `*`,
  "Access-Control-Allow-Methods": `POST, OPTIONS`,
  "Access-Control-Allow-Headers": `authorization, x-client-info, apikey, content-type, x-webhook-secret`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": `application/json` } });

// ── Brand (matches the other Sfalim emails) ───────────────────────────
const ORANGE = `#FF6B35`;
const DARK = `#0f0f0f`;
const PAGE = `#f5f3ef`;
const SITE_URL = `https://www.sfalimshop.com`;
const INSTAGRAM = `https://www.instagram.com/sfalimshop/`;

// Webhook shared secret (in-code fallback). Override in prod with the
// DESIGN_NOTIFY_WEBHOOK_SECRET Edge Function secret, then rotate this value.
const WEBHOOK_SECRET_FALLBACK = `b9d4f1a7c0e83562d1f4a9b6e2c7د08`.replace(/[^a-z0-9]/gi, ``) || `b9d4f1a7c0e83562d1f4a9b6e2c708`;

type Lang = `he` | `en` | `ru`;
type Decision = `approved` | `rejected`;

const pickLang = (raw: unknown): Lang => {
  const v = String(raw || ``).toLowerCase().slice(0, 2);
  return v === `en` || v === `ru` ? (v as Lang) : `he`;
};

const COPY: Record<Lang, Record<Decision, {
  subject: string; dir: `rtl` | `ltr`; preheader: string; eyebrow: string;
  heading: string; body1: string; body2: string; cta: string; signoff: string;
  footerNote: string; noteLabel?: string;
}>> = {
  he: {
    approved: {
      subject: `העיצוב שלך אושר — אפשר להמשיך לתשלום 🐾`,
      dir: `rtl`,
      preheader: `בדקנו את העיצוב — הוא מוכן. מעבר לתשלום ומתחילים לעבוד.`,
      eyebrow: `— העיצוב אושר —`,
      heading: `העיצוב שלך מוכן! 🐾`,
      body1: `בדקנו את העיצוב האישי שלך — והוא אושר. אפשר להמשיך לתשלום, ואז נתחיל לעבוד על הפריט שלך.`,
      body2: `הכל מחכה לך בעמוד ההזמנה — לחיצה אחת ואתם בדרך.`,
      cta: `מעבר לתשלום`,
      signoff: `תודה שבחרתם בנו,\nצוות ספלים שופ`,
      footerNote: `קיבלתם את המייל הזה בעקבות הזמנה שביצעתם בספלים שופ.`,
    },
    rejected: {
      subject: `העיצוב שלך — נדרש תיקון קטן 🐾`,
      dir: `rtl`,
      preheader: `כמעט שם — יש נקודה קטנה לתקן לפני שנמשיך.`,
      eyebrow: `— נדרש עדכון —`,
      heading: `כמעט שם! נדרש תיקון קטן`,
      body1: `עברנו על העיצוב האישי שלך, ויש נקודה קטנה לתקן לפני שנמשיך:`,
      noteLabel: `ההערה שלנו:`,
      body2: `אפשר לעדכן את העיצוב ולשלוח שוב ישירות מעמוד ההזמנה — או לבטל, אם תעדיפו.`,
      cta: `עדכון העיצוב`,
      signoff: `תודה על הסבלנות,\nצוות ספלים שופ`,
      footerNote: `קיבלתם את המייל הזה בעקבות הזמנה שביצעתם בספלים שופ.`,
    },
  },
  en: {
    approved: {
      subject: `Your design is approved — ready to pay 🐾`,
      dir: `ltr`,
      preheader: `We reviewed your design — it's approved. Continue to payment and we'll get to work.`,
      eyebrow: `— Design approved —`,
      heading: `Your design is ready! 🐾`,
      body1: `We reviewed your custom design and it's approved. You can continue to payment, and then we'll start working on your item.`,
      body2: `Everything's waiting on your order page — one click and you're on your way.`,
      cta: `Continue to payment`,
      signoff: `Thanks for choosing us,\nThe Sfalim Shop team`,
      footerNote: `You received this email regarding an order you placed at Sfalim Shop.`,
    },
    rejected: {
      subject: `Your design — a small change needed 🐾`,
      dir: `ltr`,
      preheader: `Almost there — one small thing to adjust before we continue.`,
      eyebrow: `— Update needed —`,
      heading: `Almost there! A small change needed`,
      body1: `We looked over your custom design, and there's one thing to adjust before we continue:`,
      noteLabel: `Our note:`,
      body2: `You can update the design and resubmit right from your order page — or cancel, if you prefer.`,
      cta: `Update the design`,
      signoff: `Thanks for your patience,\nThe Sfalim Shop team`,
      footerNote: `You received this email regarding an order you placed at Sfalim Shop.`,
    },
  },
  ru: {
    approved: {
      subject: `Ваш дизайн одобрен — можно оплатить 🐾`,
      dir: `ltr`,
      preheader: `Мы проверили ваш дизайн — он одобрен. Переходите к оплате.`,
      eyebrow: `— Дизайн одобрен —`,
      heading: `Ваш дизайн готов! 🐾`,
      body1: `Мы проверили ваш индивидуальный дизайн — он одобрен. Можно перейти к оплате, и затем мы начнём работу над вашим изделием.`,
      body2: `Всё ждёт вас на странице заказа — один клик, и вы в пути.`,
      cta: `Перейти к оплате`,
      signoff: `Спасибо, что выбрали нас,\nКоманда Sfalim Shop`,
      footerNote: `Вы получили это письмо в связи с заказом в Sfalim Shop.`,
    },
    rejected: {
      subject: `Ваш дизайн — нужна небольшая правка 🐾`,
      dir: `ltr`,
      preheader: `Почти готово — один момент для исправления.`,
      eyebrow: `— Требуется обновление —`,
      heading: `Почти готово! Нужна небольшая правка`,
      body1: `Мы посмотрели ваш индивидуальный дизайн, и есть один момент для исправления, прежде чем продолжить:`,
      noteLabel: `Наш комментарий:`,
      body2: `Вы можете обновить дизайн и отправить снова прямо со страницы заказа — или отменить, если хотите.`,
      cta: `Обновить дизайн`,
      signoff: `Спасибо за терпение,\nКоманда Sfalim Shop`,
      footerNote: `Вы получили это письмо в связи с заказом в Sfalim Shop.`,
    },
  },
};

const renderEmail = (lang: Lang, decision: Decision, note: string, link: string): string => {
  const c = COPY[lang][decision];
  const signoffHtml = c.signoff.split(`\n`).join(`<br>`);
  const noteBox = decision === `rejected` && note
    ? `<tr><td style="padding:8px 44px 4px;background:#ffffff;" dir="${c.dir}">
<div style="background:#fff6f1;border:1px solid #ffd9c7;border-radius:14px;padding:18px 22px;text-align:${c.dir === `rtl` ? `right` : `left`};">
<p style="margin:0 0 6px;font-family:'Heebo',sans-serif;color:${ORANGE};font-size:13px;font-weight:700;letter-spacing:0.5px;">${c.noteLabel || ``}</p>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#3a3a3a;font-size:16px;line-height:1.7;">${note}</p>
</div></td></tr>`
    : ``;
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${c.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.subject}</title>
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
<p style="margin:0;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body1}</p>
</td></tr>

${noteBox}

<tr><td style="padding:16px 44px 8px;background:#ffffff;text-align:center;" dir="${c.dir}">
<p style="margin:0;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.75;font-weight:400;">${c.body2}</p>
</td></tr>

<tr><td style="padding:28px 40px 8px;background:#ffffff;text-align:center;">
<a href="${link}" style="display:inline-block;background:${ORANGE};color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:50px;font-family:'Heebo',sans-serif;font-weight:600;font-size:15px;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(255,107,53,0.4);">
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

  const expectedSecret = Deno.env.get(`DESIGN_NOTIFY_WEBHOOK_SECRET`) || WEBHOOK_SECRET_FALLBACK;
  if (req.headers.get(`x-webhook-secret`) !== expectedSecret) {
    return json({ error: `unauthorized`, skipped: true }, 401);
  }

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: `invalid_json` }, 400); }

  const record = payload?.record ?? {};
  const oldRecord = payload?.old_record ?? {};
  const newStatus = String(record?.design_approval_status || ``);
  const oldStatus = String(oldRecord?.design_approval_status || ``);

  // Only act on a real transition INTO approved / rejected.
  if (newStatus === oldStatus) return json({ skipped: `no_status_change` }, 200);
  if (newStatus !== `approved` && newStatus !== `rejected`) return json({ skipped: `not_a_decision`, newStatus }, 200);
  if (record?.requires_design_approval !== true) return json({ skipped: `not_custom` }, 200);

  const email = String(record?.customer_email || ``).trim();
  if (!email) return json({ skipped: `no_email` }, 200);

  const decision = newStatus as Decision;
  const lang = pickLang(record?.language);
  const note = String(record?.design_review_note || ``).trim();
  const orderGroup = String(record?.order_group || record?.id || ``);
  const link = `${SITE_URL}/#track?order_group=${encodeURIComponent(orderGroup)}`;
  const c = COPY[lang][decision];

  // DEFAULT OFF: only sends when DESIGN_NOTIFY_ENABLED === "true" AND a key is set.
  const enabled = Deno.env.get(`DESIGN_NOTIFY_ENABLED`) === `true`;
  const apiKey = Deno.env.get(`RESEND_API_KEY`);
  const from = Deno.env.get(`WAITLIST_FROM`) || `BLOOM <hello@sfalimshop.com>`;

  if (!enabled || !apiKey) {
    console.log(`[dry-run] would send "${c.subject}" (lang=${lang}, decision=${decision}) to ${email} — enabled=${enabled} hasKey=${!!apiKey}`);
    return json({ dryRun: true, decision, lang, to: email });
  }

  const html = renderEmail(lang, decision, note, link);
  try {
    const res = await fetch(`https://api.resend.com/emails`, {
      method: `POST`,
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": `application/json` },
      body: JSON.stringify({ from, to: [email], subject: c.subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[resend-error] ${res.status}: ${detail}`);
      return json({ error: `send_failed`, status: res.status }, 502);
    }
    const data = await res.json();
    console.log(`[sent] ${email} (lang=${lang}, decision=${decision}) id=${data?.id ?? `?`}`);
    return json({ sent: true, decision, lang, to: email, id: data?.id ?? null });
  } catch (err) {
    console.error(`[exception] ${String(err)}`);
    return json({ error: `exception` }, 500);
  }
});
