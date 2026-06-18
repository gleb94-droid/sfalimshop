import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "hello@sfalimshop.com";
const TRACK_URL = "https://sfalimshop.com";

// ─── Status definitions ───────────────────────────────────────────────────────
const STATUS_INFO = {
  received:  { emoji: "📥", color: "#FF6B35" },
  design:    { emoji: "🎨", color: "#a78bfa" },
  printing:  { emoji: "🖨️", color: "#60a5fa" },
  ready:     { emoji: "📦", color: "#facc15" },
  shipped:   { emoji: "🚚", color: "#fb923c" },
  delivered: { emoji: "✅", color: "#4ade80" },
};

// ─── Multilingual content ─────────────────────────────────────────────────────
const content = {
  he: {
    subject: (status: string, product: string) => `${STATUS_INFO[status as keyof typeof STATUS_INFO]?.emoji || "📦"} עדכון הזמנה: ${statusLabels.he[status as keyof typeof statusLabels.he] || status}`,
    greeting: (name: string) => `שלום ${name}!`,
    title: "עדכון סטטוס הזמנה",
    subtitle: (product: string) => `הזמנתך עבור <strong>${product}</strong> עודכנה.`,
    statusLabel: "הסטטוס הנוכחי",
    trackBtn: "עקוב אחרי ההזמנה",
    footer: "שאלות? פנה אלינו: hello@sfalimshop.com",
    orderLabel: "מספר הזמנה",
    dir: "rtl",
  },
  en: {
    subject: (status: string, product: string) => `${STATUS_INFO[status as keyof typeof STATUS_INFO]?.emoji || "📦"} Order Update: ${statusLabels.en[status as keyof typeof statusLabels.en] || status}`,
    greeting: (name: string) => `Hello ${name}!`,
    title: "Order Status Update",
    subtitle: (product: string) => `Your order for <strong>${product}</strong> has been updated.`,
    statusLabel: "Current Status",
    trackBtn: "Track Your Order",
    footer: "Questions? Contact us: hello@sfalimshop.com",
    orderLabel: "Order ID",
    dir: "ltr",
  },
  ru: {
    subject: (status: string, product: string) => `${STATUS_INFO[status as keyof typeof STATUS_INFO]?.emoji || "📦"} Обновление заказа: ${statusLabels.ru[status as keyof typeof statusLabels.ru] || status}`,
    greeting: (name: string) => `Здравствуйте, ${name}!`,
    title: "Обновление статуса заказа",
    subtitle: (product: string) => `Статус вашего заказа для <strong>${product}</strong> обновлён.`,
    statusLabel: "Текущий статус",
    trackBtn: "Отследить заказ",
    footer: "Вопросы? Напишите нам: hello@sfalimshop.com",
    orderLabel: "Номер заказа",
    dir: "ltr",
  },
};

const statusLabels = {
  he: { received: "התקבלה הזמנה", design: "בעיצוב", printing: "בהדפסה", ready: "מוכן למשלוח", shipped: "נשלח", delivered: "נמסר" },
  en: { received: "Order Received", design: "In Design", printing: "Printing", ready: "Ready to Ship", shipped: "Shipped", delivered: "Delivered" },
  ru: { received: "Заказ получен", design: "В дизайне", printing: "В печати", ready: "Готов к отправке", shipped: "Отправлен", delivered: "Доставлен" },
};

// Status-specific messages per language
const statusMessages = {
  he: {
    received:  "קיבלנו את ההזמנה שלך! נחזור אליך בקרוב.",
    design:    "המעצב שלנו כבר עובד על העיצוב שלך. מחכה לאישורך!",
    printing:  "ההדפסה בעיצומה! עוד מעט המוצר שלך יהיה מוכן.",
    ready:     "המוצר שלך מוכן ומחכה למשלוח. תוך זמן קצר יצא לדרך!",
    shipped:   "ההזמנה שלך בדרך! שים לב לעדכוני המשלוח.",
    delivered: "ההזמנה נמסרה! נשמח לשמוע ממך.",
  },
  en: {
    received:  "We've received your order and will be in touch shortly.",
    design:    "Our designer is working on your design. We'll share a preview soon!",
    printing:  "Your order is being printed! It'll be ready very soon.",
    ready:     "Your order is packed and ready to ship — it's heading out soon!",
    shipped:   "Your order is on its way! Keep an eye out for delivery.",
    delivered: "Your order has been delivered! We hope you love it.",
  },
  ru: {
    received:  "Мы получили ваш заказ и скоро свяжемся с вами.",
    design:    "Наш дизайнер уже работает над вашим дизайном. Скоро покажем!",
    printing:  "Ваш заказ в печати! Скоро будет готов.",
    ready:     "Ваш заказ упакован и готов к отправке!",
    shipped:   "Ваш заказ в пути! Следите за доставкой.",
    delivered: "Ваш заказ доставлен! Надеемся, вам понравилось.",
  },
};

const ORDER_STAGES = ["received", "design", "printing", "ready", "shipped", "delivered"];

// ─── HTML Email Template ──────────────────────────────────────────────────────
function buildEmailHtml(params: {
  name: string;
  product: string;
  newStatus: string;
  orderId: string;
  language: string;
}) {
  const lang = (params.language || "he") as keyof typeof content;
  const c = content[lang] || content.he;
  const labels = statusLabels[lang] || statusLabels.en;
  const messages = statusMessages[lang] || statusMessages.en;
  const statusInfo = STATUS_INFO[params.newStatus as keyof typeof STATUS_INFO] || { emoji: "📦", color: "#FF6B35" };
  const currentStageIdx = ORDER_STAGES.indexOf(params.newStatus);
  const isRtl = lang === "he";

  const stageItems = ORDER_STAGES.map((stage, i) => {
    const done = i <= currentStageIdx;
    const active = i === currentStageIdx;
    const info = STATUS_INFO[stage as keyof typeof STATUS_INFO] || { emoji: "📦", color: "#FF6B35" };
    const label = labels[stage as keyof typeof labels] || stage;

    return `
      <tr>
        <td style="padding:8px 0;vertical-align:middle;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:36px;text-align:center;vertical-align:middle;">
                <div style="width:32px;height:32px;border-radius:50%;background:${done ? info.color : "#eee"};display:inline-flex;align-items:center;justify-content:center;font-size:14px;line-height:32px;text-align:center;">
                  ${done ? (active ? info.emoji : "✓") : ""}
                </div>
              </td>
              <td style="padding-${isRtl ? "right" : "left"}:12px;vertical-align:middle;">
                <span style="font-size:14px;color:${done ? "#111" : "#bbb"};font-weight:${active ? "700" : "400"};">${label}</span>
                ${active ? `<span style="display:inline-block;margin-${isRtl ? "right" : "left"}:8px;background:${info.color}22;color:${info.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">${lang === "he" ? "עכשיו" : lang === "ru" ? "сейчас" : "now"}</span>` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${i < ORDER_STAGES.length - 1 ? `<tr><td style="padding:0;"><div style="width:2px;height:16px;background:${i < currentStageIdx ? statusInfo.color : "#eee"};margin-left:17px;margin-right:17px;"></div></td></tr>` : ""}
    `;
  }).join("");

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${c.dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${c.subject(params.newStatus, params.product)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;" dir="${c.dir}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f0f0f;padding:28px 40px;text-align:center;">
            <div style="font-size:26px;font-weight:900;color:#FF6B35;">
              Sfalim<span style="color:#ffffff;">Shop</span>
            </div>
          </td>
        </tr>

        <!-- Status Banner -->
        <tr>
          <td style="background:${statusInfo.color}18;border-bottom:3px solid ${statusInfo.color};padding:28px 40px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">${statusInfo.emoji}</div>
            <h1 style="margin:0 0 8px;font-size:24px;color:#111;font-weight:800;">${c.title}</h1>
            <p style="margin:0 0 8px;color:#666;font-size:15px;">${c.subtitle(params.product)}</p>
            <p style="margin:0;color:${statusInfo.color};font-size:16px;font-weight:700;">
              ${labels[params.newStatus as keyof typeof labels] || params.newStatus}
            </p>
          </td>
        </tr>

        <!-- Message -->
        <tr>
          <td style="padding:28px 40px 0;" dir="${c.dir}">
            <p style="margin:0;color:#444;font-size:15px;line-height:1.7;background:${statusInfo.color}11;border-${isRtl ? "right" : "left"}:3px solid ${statusInfo.color};padding:14px 18px;border-radius:0 8px 8px 0;">
              ${messages[params.newStatus as keyof typeof messages] || ""}
            </p>
          </td>
        </tr>

        <!-- Progress Timeline -->
        <tr>
          <td style="padding:28px 40px 8px;" dir="${c.dir}">
            <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">
              ${lang === "he" ? "התקדמות ההזמנה" : lang === "ru" ? "Прогресс заказа" : "Order Progress"}
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${stageItems}
            </table>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:28px 40px 36px;text-align:center;">
            <a href="${TRACK_URL}" style="display:inline-block;background:#FF6B35;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:700;">
              ${c.trackBtn} →
            </a>
            <p style="margin:14px 0 0;color:#aaa;font-size:12px;">
              ${c.orderLabel}: <span style="font-family:monospace;color:#666;">#${params.orderId.slice(0, 8).toUpperCase()}</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#aaa;font-size:13px;">${c.footer}</p>
            <p style="margin:6px 0 0;color:#ccc;font-size:12px;">© 2025 SfalimShop · Israel 🇮🇱</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || "").trim();
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Missing orderId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SECURITY: never trust the recipient / status / content from the caller.
    // Look the order up server-side and email ONLY that order's real customer,
    // with that order's REAL current status. This makes the endpoint useless for
    // sending arbitrary "order update" emails to attacker-chosen addresses.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: order, error: lookupErr } = await supabase
      .from("orders")
      .select("customer_name, customer_email, product, status, language")
      .eq("id", orderId)
      .maybeSingle();
    if (lookupErr) {
      return new Response(JSON.stringify({ error: "db_lookup_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!order || !order.customer_email || !order.status) {
      return new Response(JSON.stringify({ error: "order_not_found_or_incomplete" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerEmail = order.customer_email;
    const customerName = order.customer_name || "";
    const product = order.product || "";
    const newStatus = order.status;
    const language = order.language || "he";
    const lang = (language || "he") as keyof typeof content;
    const c = content[lang] || content.he;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `SfalimShop <${FROM_EMAIL}>`,
        to: [customerEmail],
        subject: c.subject(newStatus, product),
        html: buildEmailHtml({ name: customerName, product, newStatus, orderId, language }),
      }),
    });

    const result = await emailRes.json();

    if (!emailRes.ok) {
      console.error("Resend error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});