import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = "hello@sfalimshop.com";
const FROM_NAME = "Sfalim Shop";
const SITE_URL = "https://www.sfalimshop.com";
const TRACK_URL = "https://www.sfalimshop.com/#track";

// Shipping fee is derived from the order's delivery_method (NOT a flat rate).
// Must mirror SHIPPING_OPTIONS in App.jsx. The first order row's `total`
// already includes this fee, so the email subtracts it from the first item
// and shows it as a separate line. Unknown/legacy methods fall back to 0.
const SHIPPING_BY_METHOD: Record<string, number> = {
  personal_beersheva: 0,
  ups_home: 55,
  ups_point: 27,
};
const SHIPPING_FALLBACK = 0;

const content = {
  he: {
    dir: "rtl", lang: "he",
    subject: (product: string) => `ההזמנה שלך אצלנו · ${product} — Sfalim Shop`,
    eyebrow: "— ההזמנה התקבלה —",
    title: "ההזמנה שלך אצלנו",
    subtitle: (name: string) => `תודה ${name}!<br>אנחנו כבר על העניין.`,
    summaryTitle: "סיכום ההזמנה",
    shipping: "משלוח", total: "סה״כ", freeShip: "ללא עלות",
    nextStepsTitle: "מה קורה עכשיו",
    step1Title: "אנחנו מתחילים בייצור", step1Sub: "ההזמנה שלך נכנסת לסבב הייצור הקרוב",
    step2Title: "ייצור: 2-4 ימי עסקים", step2Sub: "הדפסה איכותית של העיצוב שבחרת",
    step3Title: "משלוח: 1-3 ימי עסקים", step3Sub: "תקבל מספר מעקב באימייל",
    step4Title: "עדכון על כל שלב", step4Sub: "ניצור איתך קשר בכל שינוי",
    trackBtn: "מעקב אחר ההזמנה", orderIdLabel: "מספר הזמנה",
    needHelp: "צריך עזרה?", contactUs: "כתוב לנו ל-", items: "פריטים",
  },
  en: {
    dir: "ltr", lang: "en",
    subject: (product: string) => `Your order is received · ${product} — Sfalim Shop`,
    eyebrow: "— Order Received —",
    title: "We've got your order",
    subtitle: (name: string) => `Thanks ${name}!<br>We're on it.`,
    summaryTitle: "Order Summary",
    shipping: "Shipping", total: "Total", freeShip: "No fee",
    nextStepsTitle: "What happens next",
    step1Title: "We start production", step1Sub: "Your order enters the next production batch",
    step2Title: "Production: 2-4 business days", step2Sub: "Quality printing of your chosen design",
    step3Title: "Shipping: 1-3 business days", step3Sub: "You'll receive tracking info by email",
    step4Title: "Updates at every step", step4Sub: "We'll contact you with any changes",
    trackBtn: "Track Your Order", orderIdLabel: "Order Number",
    needHelp: "Need help?", contactUs: "Contact us at ", items: "items",
  },
  ru: {
    dir: "ltr", lang: "ru",
    subject: (product: string) => `Ваш заказ принят · ${product} — Sfalim Shop`,
    eyebrow: "— Заказ получен —",
    title: "Ваш заказ принят",
    subtitle: (name: string) => `Спасибо, ${name}!<br>Мы уже занимаемся им.`,
    summaryTitle: "Детали заказа",
    shipping: "Доставка", total: "Итого", freeShip: "Без платы",
    nextStepsTitle: "Что дальше",
    step1Title: "Начинаем производство", step1Sub: "Ваш заказ попадает в ближайшую партию",
    step2Title: "Производство: 2-4 рабочих дня", step2Sub: "Качественная печать вашего дизайна",
    step3Title: "Доставка: 1-3 рабочих дня", step3Sub: "Вы получите трек-номер на email",
    step4Title: "Обновления на каждом этапе", step4Sub: "Мы свяжемся при любых изменениях",
    trackBtn: "Отследить заказ", orderIdLabel: "Номер заказа",
    needHelp: "Нужна помощь?", contactUs: "Напишите нам: ", items: "позиций",
  },
};

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const COLORS_MAP: Record<string, { he: string; en: string; ru: string }> = {
  "#ffffff": { he: "לבן", en: "White", ru: "Белый" },
  "#1a1a1a": { he: "שחור", en: "Black", ru: "Чёрный" },
  "#000000": { he: "שחור", en: "Black", ru: "Чёрный" },
  "#9ca3af": { he: "אפור", en: "Gray", ru: "Серый" },
  "#1e3a5f": { he: "נייבי", en: "Navy", ru: "Тёмно-синий" },
  "#d4c5a9": { he: "חול", en: "Sand", ru: "Песочный" },
  "#f9a8d4": { he: "ורוד", en: "Pink", ru: "Розовый" },
};
function safeColor(hex: string | null): string | null {
  return hex && /^#[0-9a-fA-F]{3,8}$/.test(hex) ? hex : null;
}
function colorName(hex: string | null, lang: "he" | "en" | "ru"): string {
  const k = (hex || "").toLowerCase();
  return COLORS_MAP[k]?.[lang] || COLORS_MAP[k]?.en || (hex || "");
}
function colorChip(hex: string | null, lang: "he" | "en" | "ru"): string {
  const safe = safeColor(hex);
  if (!safe) return "";
  const name = colorName(hex, lang);
  return ` · <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${safe};border:1px solid #ccc;vertical-align:middle;"></span> <span style="color:#888;">${escapeHtml(name)}</span>`;
}

interface Item { product: string; variant: string; color: string | null; quantity: number; price: number; previewUrl: string | null; }

function buildEmailHtml(params: { name: string; items: Item[]; grandTotal: number; shippingFee: number; orderId: string; orderGroup?: string; language: string; }) {
  const lang = (params.language || "he") as keyof typeof content;
  const c = content[lang] || content.he;
  const isRtl = c.dir === "rtl";
  const displayOrderId = params.orderGroup ? `SXP-${params.orderGroup.slice(-8).toUpperCase()}` : `#${(params.orderId || "").slice(0, 8).toUpperCase()}`;
  const alignStart = isRtl ? "text-align:right" : "text-align:left";
  const alignEnd = isRtl ? "text-align:left" : "text-align:right";
  const padStart = isRtl ? "padding-right" : "padding-left";
  const shippingValue = params.shippingFee > 0 ? `₪${params.shippingFee}` : c.freeShip;

  const itemsHtml = params.items.map((it) => {
    const previewImg = it.previewUrl
      ? `<img src="${escapeHtml(it.previewUrl)}" alt="mockup" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #efeae3;background:#faf8f5;" />`
      : `<div style="width:64px;height:64px;border-radius:8px;background:#f0ece6;border:1px solid #efeae3;display:inline-block;line-height:64px;text-align:center;color:#bbb;font-size:22px;">🎨</div>`;
    return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:10px;background:#ffffff;border:1px solid #efeae3;border-radius:12px;">
<tr>
<td width="80" valign="top" style="padding:12px;">${previewImg}</td>
<td valign="top" style="padding:12px 6px;">
<p style="margin:0 0 3px;color:#1a1a1a;font-family:'Heebo',sans-serif;font-weight:600;font-size:14px;">${escapeHtml(it.product)} <span style="color:#999;font-weight:400;font-size:12px;">× ${it.quantity}</span></p>
<p style="margin:0;color:#888;font-family:'Heebo',sans-serif;font-size:12px;">${escapeHtml(it.variant || "")}${colorChip(it.color, lang as "he" | "en" | "ru")}</p>
</td>
<td valign="top" style="padding:12px;${alignEnd};width:72px;">
<p style="margin:0;color:#FF6B35;font-family:'Heebo',sans-serif;font-weight:700;font-size:15px;">₪${it.price}</p>
</td>
</tr>
</table>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${c.lang}" dir="${c.dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${c.subject(params.items[0]?.product || "")}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,500;0,700;0,900;1,500&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Heebo','Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif;direction:${c.dir};color:#1a1a1a;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:#f5f3ef;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.1);overflow:hidden;">

<tr><td style="background:#0f0f0f;padding:56px 32px 48px;text-align:center;">
<h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:46px;font-weight:700;color:#ffffff;letter-spacing:0.5px;line-height:1.1;">Sfalim Shop</h1>
<div style="width:56px;height:3px;background:#FF6B35;margin:18px auto 14px;border-radius:2px;"></div>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#FF6B35;font-size:13px;font-weight:500;letter-spacing:3px;text-transform:uppercase;">ספלים שופ</p>
</td></tr>

<tr><td style="padding:48px 40px 24px;background:#ffffff;text-align:center;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin-bottom:20px;">
<tr><td style="width:80px;height:80px;border-radius:50%;background:rgba(34,197,94,0.1);border:2px solid #22c55e;text-align:center;vertical-align:middle;font-size:42px;color:#22c55e;font-weight:700;line-height:80px;">✓</td></tr>
</table>
<p style="margin:0 0 8px;font-family:'Playfair Display',Georgia,serif;font-size:15px;color:#FF6B35;font-style:italic;letter-spacing:1px;">${c.eyebrow}</p>
<h2 style="margin:0 0 16px;font-family:'Heebo',sans-serif;font-size:30px;color:#1a1a1a;font-weight:700;line-height:1.3;">${c.title}</h2>
<p style="margin:0 0 24px;font-family:'Heebo',sans-serif;color:#5a5a5a;font-size:16px;line-height:1.7;font-weight:400;">${c.subtitle(params.name)}</p>
<div style="display:inline-block;background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.3);border-radius:10px;padding:10px 22px;">
<span style="font-family:'Heebo',sans-serif;color:#999;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;${isRtl ? "margin-left:10px" : "margin-right:10px"};">${c.orderIdLabel}</span>
<span style="font-family:'Heebo',sans-serif;color:#FF6B35;font-weight:700;font-size:15px;letter-spacing:0.05em;">${displayOrderId}</span>
</div>
</td></tr>

<tr><td style="padding:32px 40px 24px;background:#ffffff;">
<div style="background:#fafafa;border:1px solid #efeae3;border-radius:14px;padding:24px;" dir="${c.dir}">
<p style="margin:0 0 18px;font-family:'Heebo',sans-serif;font-size:12px;font-weight:700;color:#999;letter-spacing:0.12em;text-transform:uppercase;text-align:center;">${c.summaryTitle}</p>
${itemsHtml}
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:6px;">
<tr>
<td style="padding:10px 0;color:#888;font-family:'Heebo',sans-serif;font-size:14px;${alignStart}">${c.shipping}</td>
<td style="padding:10px 0;color:#1a1a1a;font-family:'Heebo',sans-serif;font-size:14px;font-weight:600;${alignEnd}">${shippingValue}</td>
</tr>
<tr>
<td style="padding:16px 0 0;color:#1a1a1a;font-family:'Heebo',sans-serif;font-size:15px;font-weight:700;border-top:2px solid #FF6B35;${alignStart}">${c.total}</td>
<td style="padding:16px 0 0;color:#FF6B35;font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;border-top:2px solid #FF6B35;${alignEnd}">₪${params.grandTotal}</td>
</tr>
</table>
</div>
</td></tr>

<tr><td style="padding:8px 40px 32px;background:#ffffff;" dir="${c.dir}">
<p style="margin:0 0 22px;font-family:'Heebo',sans-serif;font-size:12px;font-weight:700;color:#999;letter-spacing:0.12em;text-transform:uppercase;text-align:center;">📦 ${c.nextStepsTitle}</p>
${[{ num: "1", title: c.step1Title, sub: c.step1Sub },{ num: "2", title: c.step2Title, sub: c.step2Sub },{ num: "3", title: c.step3Title, sub: c.step3Sub },{ num: "4", title: c.step4Title, sub: c.step4Sub }].map((s, i, arr) => `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:${i === arr.length - 1 ? "0" : "14px"};">
<tr>
<td width="42" valign="top" style="padding-top:2px;">
<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,107,53,0.12);border:1.5px solid #FF6B35;color:#FF6B35;font-family:'Heebo',sans-serif;font-weight:700;font-size:14px;line-height:29px;text-align:center;">${s.num}</div>
</td>
<td valign="top" style="${padStart}:14px;">
<p style="margin:0 0 3px;font-family:'Heebo',sans-serif;color:#1a1a1a;font-weight:600;font-size:14px;">${s.title}</p>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#888;font-size:13px;line-height:1.5;">${s.sub}</p>
</td>
</tr>
</table>`).join("")}
</td></tr>

<tr><td style="padding:8px 40px 40px;background:#ffffff;text-align:center;">
<a href="${TRACK_URL}" style="display:inline-block;background:#FF6B35;color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:50px;font-family:'Heebo',sans-serif;font-weight:600;font-size:15px;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(255,107,53,0.4);">
${c.trackBtn} →
</a>
</td></tr>

<tr><td style="padding:0 40px 32px;background:#ffffff;text-align:center;">
<p style="margin:0;font-family:'Heebo',sans-serif;color:#888;font-size:13px;line-height:1.6;">
<strong style="color:#666;">${c.needHelp}</strong> ${c.contactUs}<a href="mailto:hello@sfalimshop.com" style="color:#FF6B35;text-decoration:none;font-weight:500;">hello@sfalimshop.com</a>
</p>
</td></tr>

<tr><td style="background:#0f0f0f;padding:32px 40px;">
<p style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-size:18px;color:#ffffff;text-align:center;font-weight:500;letter-spacing:0.5px;">Sfalim Shop</p>
<div style="width:32px;height:2px;background:#FF6B35;margin:0 auto 16px;border-radius:2px;"></div>
<p style="margin:0;font-family:'Heebo',sans-serif;color:#888;font-size:12px;text-align:center;line-height:1.8;font-weight:300;">
<a href="${SITE_URL}" style="color:#FF6B35;text-decoration:none;">sfalimshop.com</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="mailto:hello@sfalimshop.com" style="color:#bbb;text-decoration:none;">hello@sfalimshop.com</a>
&nbsp;&nbsp;·&nbsp;&nbsp;
<a href="https://www.instagram.com/sfalimshop/" style="color:#bbb;text-decoration:none;">@sfalimshop</a>
</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    const { customerName, customerEmail, product, variant, quantity, total, orderId, orderGroup, language } = body;

    let name = customerName || "";
    let email = customerEmail || "";
    let lang = (language || "he") as keyof typeof content;
    let items: Item[] = [];
    let grandTotal = Number(total) || 0;
    let shippingFee = SHIPPING_FALLBACK;
    let displayProduct = product || "";

    if (orderGroup) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: orders } = await supabase
        .from("orders")
        .select("product, variant, color, quantity, total, mockup_url, design_url, delivery_method, customer_name, customer_email, language, created_at")
        .eq("order_group", orderGroup)
        .order("created_at", { ascending: true });
      if (orders && orders.length) {
        const first = orders[0];
        name = first.customer_name || name;
        email = first.customer_email || email;
        lang = (first.language || lang) as keyof typeof content;
        shippingFee = SHIPPING_BY_METHOD[first.delivery_method as string] ?? SHIPPING_FALLBACK;
        grandTotal = orders.reduce((s: number, o: any) => s + parseFloat(String(o.total) || "0"), 0);
        items = orders.map((o: any, i: number) => ({
          product: o.product,
          variant: o.variant,
          color: o.color,
          quantity: o.quantity,
          price: parseFloat(String(o.total)) - (i === 0 ? shippingFee : 0),
          previewUrl: o.mockup_url || o.design_url || null,
        }));
        displayProduct = orders.length === 1 ? orders[0].product : `${orders.length} ${(content[lang] || content.he).items}`;
      }
    }

    if (items.length === 0) {
      items = [{ product: product || "", variant: variant || "", color: null, quantity: quantity || 1, price: (Number(total) || 0) - shippingFee, previewUrl: null }];
      displayProduct = product || "";
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "Missing customer email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const c = content[lang] || content.he;
    const html = buildEmailHtml({ name, items, grandTotal, shippingFee, orderId: orderId || "", orderGroup, language: lang });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [email],
        subject: c.subject(displayProduct),
        html,
      }),
    });

    const result = await emailRes.json();
    if (!emailRes.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
