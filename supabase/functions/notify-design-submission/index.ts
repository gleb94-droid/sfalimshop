// ============================================================
// Sfalim Shop — notify-design-submission (v1)
//
// Sends the BUSINESS (admin) an alert when a customer submits a
// CUSTOM DESIGN for approval. This is a workflow notification, not a
// payment email — custom designs are created as pending-approval
// BEFORE payment, so the admin needs to know to review/approve.
//
// Endpoint: POST /functions/v1/notify-design-submission
// Body: { orderGroup: string }
// Auth: public (verify_jwt=false). Abuse-limited: only emails when the
//   order_group actually exists AND requires_design_approval = true.
// ============================================================

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

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(p: {
  displayOrderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  product: string;
  notes: string;
  imageUrl: string | null;
  itemCount: number;
  timestamp: string;
}) {
  const rawPhone = (p.customerPhone || "").replace(/[^0-9]/g, "");
  const phoneIntl = rawPhone.startsWith("0") ? `+972${rawPhone.slice(1)}` : rawPhone;

  const imageBlock = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" alt="design" width="120" height="120" style="display:block;width:120px;height:120px;object-fit:cover;border-radius:12px;background:#fff;border:1px solid #333;margin:0 auto;" />`
    : `<div style="width:120px;height:120px;border-radius:12px;background:#2a2a2a;border:1px solid #333;display:inline-block;line-height:120px;text-align:center;color:#666;font-size:40px;">\u{1F3A8}</div>`;

  const notesHtml = p.notes
    ? `<div style="margin-top:14px;padding:12px 14px;background:rgba(255,107,53,0.08);border-right:3px solid #FF6B35;border-radius:8px;">
<p style="margin:0 0 4px;color:#888;font-family:'Heebo',sans-serif;font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">\u{1F4AC} הערות לקוח</p>
<p style="margin:0;color:#e0e0e0;font-family:'Heebo',sans-serif;font-size:14px;line-height:1.5;">${escapeHtml(p.notes)}</p>
</div>`
    : "";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>\u{1F3A8} עיצוב חדש לאישור — ${p.displayOrderId}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Heebo',-apple-system,BlinkMacSystemFont,Arial,sans-serif;direction:rtl;color:#ffffff;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background:#0f0f0f;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

<tr><td style="background:linear-gradient(135deg,#FF6B35 0%,#E54E1E 100%);padding:24px 28px;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr>
<td style="color:#ffffff;font-family:'Heebo',sans-serif;font-size:13px;font-weight:700;letter-spacing:0.15em;">\u{1F3A8} עיצוב חדש לאישור</td>
<td style="color:#ffffff;font-family:'Heebo',sans-serif;font-size:12px;font-weight:400;opacity:0.92;text-align:left;direction:ltr;">${escapeHtml(p.timestamp)}</td>
</tr>
<tr>
<td colspan="2" style="padding-top:12px;color:#ffffff;font-family:'Heebo',sans-serif;font-size:22px;font-weight:800;line-height:1.2;">ממתין לאישור שלך</td>
</tr>
<tr>
<td colspan="2" style="padding-top:6px;color:#ffffff;font-family:'Heebo',sans-serif;font-size:13px;font-weight:500;opacity:0.95;direction:ltr;text-align:right;">${escapeHtml(p.displayOrderId)} · ${p.itemCount} ${p.itemCount === 1 ? "פריט" : "פריטים"}</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:26px 28px 10px;text-align:center;">
${imageBlock}
</td></tr>

<tr><td style="padding:6px 28px 8px;">
<p style="margin:0 0 14px;color:#888;font-family:'Heebo',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">\u{1F464} פרטי לקוח</p>
<p style="margin:0 0 6px;color:#ffffff;font-family:'Heebo',sans-serif;font-size:19px;font-weight:700;">${escapeHtml(p.customerName)}</p>
<p style="margin:0 0 12px;color:#aaa;font-family:'Heebo',sans-serif;font-size:14px;">${escapeHtml(p.product)}</p>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td style="padding:10px 0;border-top:1px solid #2a2a2a;">
<a href="tel:${phoneIntl}" style="display:block;color:#FF6B35;text-decoration:none;font-family:'Heebo',sans-serif;font-size:15px;font-weight:500;direction:ltr;text-align:right;">\u{1F4DE} ${escapeHtml(p.customerPhone || "—")}</a>
</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid #2a2a2a;">
<a href="mailto:${escapeHtml(p.customerEmail)}" style="display:block;color:#FF6B35;text-decoration:none;font-family:'Heebo',sans-serif;font-size:14px;font-weight:500;direction:ltr;text-align:right;">✉️ ${escapeHtml(p.customerEmail)}</a>
</td></tr>
</table>
${notesHtml}
</td></tr>

<tr><td style="padding:18px 28px 28px;text-align:center;">
<a href="${ADMIN_URL}" style="display:inline-block;width:100%;max-width:320px;background:#FF6B35;color:#ffffff;text-decoration:none;padding:16px 24px;border-radius:10px;font-family:'Heebo',sans-serif;font-size:15px;font-weight:700;letter-spacing:0.3px;box-shadow:0 6px 20px rgba(255,107,53,0.35);">
פתח לאישור בפאנל אדמין ←
</a>
</td></tr>

<tr><td style="padding:18px 28px;border-top:1px solid #2a2a2a;background:#0f0f0f;text-align:center;">
<p style="margin:0;color:#555;font-family:'Heebo',sans-serif;font-size:11px;font-weight:300;">
Sfalim Shop · Design Approval · <a href="https://www.sfalimshop.com" style="color:#777;text-decoration:none;">sfalimshop.com</a>
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
        "product, notes, customer_name, customer_email, customer_phone, design_url, mockup_url, requires_design_approval, created_at",
      )
      .eq("order_group", orderGroup)
      .order("created_at", { ascending: true });

    if (dbError || !orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ error: dbError?.message || "No orders found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Abuse limit: only alert for real custom-design submissions.
    const designOrders = orders.filter((o: any) => o.requires_design_approval === true);
    if (designOrders.length === 0) {
      return new Response(
        JSON.stringify({ skipped: "no_design_approval_orders" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const first = designOrders[0] as any;
    const displayOrderId = `SXP-${String(orderGroup).slice(-8).toUpperCase()}`;
    const timestamp = new Date().toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const html = buildHtml({
      displayOrderId,
      customerName: first.customer_name || "",
      customerEmail: first.customer_email || "",
      customerPhone: first.customer_phone || "",
      product: first.product || "",
      notes: first.notes || "",
      imageUrl: first.mockup_url || first.design_url || null,
      itemCount: designOrders.length,
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
        subject: `\u{1F3A8} עיצוב חדש לאישור · ${displayOrderId}`,
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
      JSON.stringify({ success: true, id: result.id, designOrders: designOrders.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
