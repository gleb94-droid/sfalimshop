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
const FROM_NAME = "Sfalim Shop System";
const ADMIN_EMAIL = "hello@sfalimshop.com";
const ADMIN_URL = "https://www.sfalimshop.com/?staff=1#admin";

// Shipping fee is derived from the order's delivery_method (NOT a flat rate).
// Mirrors SHIPPING_OPTIONS in App.jsx. The first order row's `total` already
// includes this fee. Unknown/legacy methods fall back to 0.
const SHIPPING_BY_METHOD: Record<string, number> = {
  personal_beersheva: 0,
  ups_home: 55,
  ups_point: 27,
};
const SHIPPING_FALLBACK = 0;

interface OrderRow {
  id: string;
  product: string;
  variant: string;
  color: string | null;
  quantity: number;
  total: number | string;
  notes: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_postal_code: string | null;
  delivery_method: string | null;
  design_url: string | null;
  mockup_url: string | null;
  back_print: boolean | null;
  second_front_url: string | null;
  sleeve_left_url: string | null;
  sleeve_right_url: string | null;
  created_at: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  return ` · <span style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${safe};border:1px solid #777;vertical-align:middle;"></span> <span style="color:#aaa;">${escapeHtml(name)}</span>`;
}

function buildAdminEmailHtml(p: {
  orderGroup: string;
  grandTotal: number;
  shippingFee: number;
  orders: OrderRow[];
  timestamp: string;
}) {
  const displayOrderId = `SXP-${p.orderGroup.slice(-8).toUpperCase()}`;
  const first = p.orders[0];
  const itemCount = p.orders.length;

  const addressText = [first.customer_street, first.customer_city, first.customer_postal_code]
    .filter(Boolean)
    .join(", ");
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addressText + ", Israel")}`;

  const rawPhone = (first.customer_phone || "").replace(/[^0-9]/g, "");
  const phoneIntl = rawPhone.startsWith("0") ? `+972${rawPhone.slice(1)}` : rawPhone;
  const phoneDisplay = first.customer_phone || "—";
  const shippingValue = p.shippingFee > 0 ? `₪${p.shippingFee}` : "ללא עלות";

  const orderRowsHtml = p.orders.map((o, i) => {
    const itemOnlyPrice = parseFloat(String(o.total)) - (i === 0 ? p.shippingFee : 0);
    const extras: string[] = [];
    if (o.back_print) extras.push("🖨️ אחורי");
    if (o.second_front_url) extras.push("➕ נוסף");
    if (o.sleeve_left_url) extras.push("👕 שרוול שמ׳");
    if (o.sleeve_right_url) extras.push("👕 שרוול ימ׳");

    const previewUrl = o.mockup_url || o.design_url;
    const designImg = previewUrl
      ? `<img src="${escapeHtml(previewUrl)}" alt="mockup" width="68" height="68" style="display:block;width:68px;height:68px;object-fit:cover;border-radius:8px;background:#fff;border:1px solid #333;" />`
      : `<div style="width:68px;height:68px;border-radius:8px;background:#2a2a2a;border:1px solid #333;display:inline-block;line-height:68px;text-align:center;color:#666;font-size:24px;">🎨</div>`;

    return `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:10px;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:10px;">
<tr>
<td width="92" valign="top" style="padding:14px 14px 14px 14px;">
${designImg}
</td>
<td valign="top" style="padding:14px 0;">
<p style="margin:0 0 4px;color:#ffffff;font-family:'Heebo',sans-serif;font-size:15px;font-weight:600;">
${escapeHtml(o.product)} <span style="color:#888;font-weight:400;font-size:13px;">× ${o.quantity}</span>
</p>
<p style="margin:0;color:#888;font-family:'Heebo',sans-serif;font-size:12px;line-height:1.5;">
${escapeHtml(o.variant)}${colorChip(o.color, "he")}
${extras.length ? `<br/><span style="color:#FF6B35;">${extras.join(" · ")}</span>` : ""}
</p>
</td>
<td valign="top" style="padding:14px 16px 14px 0;text-align:left;width:80px;">
<p style="margin:0;color:#FF6B35;font-family:'Heebo',sans-serif;font-size:16px;font-weight:700;">₪${itemOnlyPrice}</p>
</td>
</tr>
</table>`;
  }).join("");

  const notesHtml = first.notes
    ? `<div style="margin-top:14px;padding:12px 14px;background:rgba(255,107,53,0.08);border-right:3px solid #FF6B35;border-radius:8px;">
<p style="margin:0 0 4px;color:#888;font-family:'Heebo',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">💬 הערות לקוח</p>
<p style="margin:0;color:#e0e0e0;font-family:'Heebo',sans-serif;font-size:14px;line-height:1.5;">${escapeHtml(first.notes)}</p>
</div>`
    : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>🚨 הזמנה חדשה — ${displayOrderId}</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Heebo',-apple-system,BlinkMacSystemFont,Arial,sans-serif;direction:rtl;color:#ffffff;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:#0f0f0f;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

<tr><td style="background:linear-gradient(135deg,#FF6B35 0%,#E54E1E 100%);padding:24px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td style="color:#ffffff;font-family:'Heebo',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">🚨 הזמנה חדשה</td>
<td style="color:#ffffff;font-family:'Heebo',sans-serif;font-size:12px;font-weight:400;opacity:0.92;text-align:left;direction:ltr;">${escapeHtml(p.timestamp)}</td>
</tr>
<tr>
<td colspan="2" style="padding-top:14px;color:#ffffff;font-family:'Heebo',sans-serif;font-size:38px;font-weight:800;line-height:1.1;letter-spacing:-0.5px;">₪${p.grandTotal}</td>
</tr>
<tr>
<td colspan="2" style="padding-top:6px;color:#ffffff;font-family:'Heebo',sans-serif;font-size:13px;font-weight:500;opacity:0.95;letter-spacing:0.05em;direction:ltr;text-align:right;">${displayOrderId} · ${itemCount} ${itemCount === 1 ? "פריט" : "פריטים"}</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:24px 28px 8px;">
<p style="margin:0 0 14px;color:#888;font-family:'Heebo',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">👤 פרטי לקוח</p>
<p style="margin:0 0 12px;color:#ffffff;font-family:'Heebo',sans-serif;font-size:19px;font-weight:700;">${escapeHtml(first.customer_name)}</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td style="padding:10px 0;border-top:1px solid #2a2a2a;">
<a href="tel:${phoneIntl}" style="display:block;color:#FF6B35;text-decoration:none;font-family:'Heebo',sans-serif;font-size:15px;font-weight:500;direction:ltr;text-align:right;">📞 ${escapeHtml(phoneDisplay)}</a>
</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid #2a2a2a;">
<a href="mailto:${escapeHtml(first.customer_email)}" style="display:block;color:#FF6B35;text-decoration:none;font-family:'Heebo',sans-serif;font-size:14px;font-weight:500;direction:ltr;text-align:right;">✉️ ${escapeHtml(first.customer_email)}</a>
</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid #2a2a2a;">
<a href="${mapsUrl}" style="display:block;color:#FF6B35;text-decoration:none;font-family:'Heebo',sans-serif;font-size:14px;font-weight:500;">📍 ${escapeHtml(addressText || "לא צויינה")}</a>
</td></tr>
</table>
${notesHtml}
</td></tr>

<tr><td style="padding:24px 28px 8px;">
<p style="margin:0 0 14px;color:#888;font-family:'Heebo',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">🛍️ פריטים</p>
${orderRowsHtml}
</td></tr>

<tr><td style="padding:0 28px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0f0f0f;border:1px solid #2a2a2a;border-radius:10px;">
<tr>
<td style="padding:12px 16px;color:#888;font-family:'Heebo',sans-serif;font-size:13px;">משלוח</td>
<td style="padding:12px 16px;color:#fff;font-family:'Heebo',sans-serif;font-size:13px;text-align:left;font-weight:500;">${shippingValue}</td>
</tr>
<tr>
<td style="padding:12px 16px;color:#fff;font-family:'Heebo',sans-serif;font-size:15px;font-weight:700;border-top:2px solid #FF6B35;">סה״כ לגביה</td>
<td style="padding:12px 16px;color:#FF6B35;font-family:'Heebo',sans-serif;font-size:22px;font-weight:800;text-align:left;border-top:2px solid #FF6B35;">₪${p.grandTotal}</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:8px 28px 28px;text-align:center;">
<a href="${ADMIN_URL}" style="display:inline-block;width:100%;max-width:320px;background:#FF6B35;color:#ffffff;text-decoration:none;padding:16px 24px;border-radius:10px;font-family:'Heebo',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 6px 20px rgba(255,107,53,0.35);">
פתח בפאנל אדמין ←
</a>
</td></tr>

<tr><td style="padding:18px 28px;border-top:1px solid #2a2a2a;background:#0f0f0f;text-align:center;">
<p style="margin:0;color:#555;font-family:'Heebo',sans-serif;font-size:11px;font-weight:300;letter-spacing:0.05em;">
Sfalim Shop · Admin Notification · <a href="https://www.sfalimshop.com" style="color:#777;text-decoration:none;">sfalimshop.com</a>
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
    const { orderGroup } = body;

    if (!orderGroup) {
      return new Response(JSON.stringify({ error: "Missing orderGroup" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: orders, error: dbError } = await supabase
      .from("orders")
      .select(
        "id, product, variant, color, quantity, total, notes, customer_name, customer_email, customer_phone, customer_street, customer_city, customer_postal_code, delivery_method, design_url, mockup_url, back_print, second_front_url, sleeve_left_url, sleeve_right_url, created_at"
      )
      .eq("order_group", orderGroup)
      .order("created_at", { ascending: true });

    if (dbError || !orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ error: dbError?.message || "No orders found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const grandTotal = orders.reduce(
      (sum: number, o: OrderRow) => sum + parseFloat(String(o.total) || "0"),
      0
    );
    const shippingFee = SHIPPING_BY_METHOD[(orders[0] as OrderRow).delivery_method as string] ?? SHIPPING_FALLBACK;

    const displayOrderId = `SXP-${orderGroup.slice(-8).toUpperCase()}`;
    const timestamp = new Date().toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = buildAdminEmailHtml({
      orderGroup,
      grandTotal,
      shippingFee,
      orders: orders as OrderRow[],
      timestamp,
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [ADMIN_EMAIL],
        subject: `🚨 הזמנה חדשה ₪${grandTotal} · ${displayOrderId}`,
        html,
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

    return new Response(
      JSON.stringify({ success: true, id: result.id, ordersFound: orders.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
