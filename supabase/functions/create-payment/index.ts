// ============================================================
// Sfalim Shop — create-payment edge function
//
// Builds a Tranzila Hosted Page URL for a Sfalim order (or cart of
// orders sharing the same order_group) and returns it as redirect_url.
//
// SECURITY:
//  - The charge amount is ALWAYS recomputed server-side from orders.total.
//    The client-supplied amount is informational only (never trusted).
//  - Payment is REFUSED if any order in the group still requires design
//    approval and is not yet approved (design_not_approved).
//
// Contract:
//   IN  { order_id?: uuid, order_group?: string, amount?: number,
//         currency?: 'ILS', customer: { name, email, phone? },
//         items_summary?: string }
//   OUT { redirect_url: string, order_group: string, amount: number }
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

type CreatePaymentBody = {
  order_id?: string;
  order_group?: string;
  amount?: number;
  currency?: string;
  customer?: { name?: string; email?: string; phone?: string };
  items_summary?: string;
};

function encodeParam(v: string): string {
  return encodeURIComponent(String(v).replace(/[\r\n]+/g, " "));
}

function buildTranzilaUrl(opts: {
  supplier: string;
  amount: number;
  orderGroup: string;
  description: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  language: string;
  notifyUrl: string;
  successUrl: string;
  failUrl: string;
}): string {
  const langMap: Record<string, string> = { he: "il", en: "us", ru: "ru" };
  const langCode = langMap[opts.language] ?? "il";
  const params: Array<[string, string]> = [
    ["sum", opts.amount.toFixed(2)],
    ["currency", "1"],
    ["cred_type", "1"],
    ["tranmode", "A"],
    ["myid", opts.orderGroup],
    ["u71", opts.orderGroup],
    ["pdesc", opts.description],
    ["contact", opts.customerName],
    ["email", opts.customerEmail],
    ["lang", langCode],
    ["trBgColor", "0f0f0f"],
    ["trTextColor", "ffffff"],
    ["trButtonColor", "FF6B35"],
  ];
  if (opts.customerPhone) params.push(["phone", opts.customerPhone]);
  if (opts.notifyUrl) params.push(["notify_url_address", opts.notifyUrl]);
  if (opts.successUrl) params.push(["success_url_address", opts.successUrl]);
  if (opts.failUrl) params.push(["fail_url_address", opts.failUrl]);

  const qs = params.map(([k, v]) => `${k}=${encodeParam(v)}`).join("&");
  return `https://direct.tranzila.com/${encodeURIComponent(opts.supplier)}/iframenew.php?${qs}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Server misconfigured" }, 500);
  }

  const supplier = (Deno.env.get("TRANZILA_SUPPLIER") ?? "").trim();
  const supplierIsLive = supplier !== "" && supplier.toUpperCase() !== "PLACEHOLDER";
  if (!supplierIsLive) {
    return json(
      { ok: false, error: "payments_disabled", message: "TRANZILA_SUPPLIER is not set. Payments are not live yet." },
      503,
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: CreatePaymentBody;
  try {
    body = (await req.json()) as CreatePaymentBody;
  } catch (_) {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientAmount = Number(body?.amount); // informational only — never trusted
  if (body?.currency && body.currency.toUpperCase() !== "ILS") {
    return json({ ok: false, error: "unsupported_currency" }, 400);
  }

  let orderGroup = (body.order_group ?? "").trim();
  let firstOrderId: string | null = null;
  let language = "he";

  if (!orderGroup && body.order_id) {
    const { data: lookup, error: lookupErr } = await supabase
      .from("orders")
      .select("id, order_group, language")
      .eq("id", body.order_id)
      .maybeSingle();
    if (lookupErr) return json({ ok: false, error: "db_lookup_failed" }, 500);
    if (!lookup) return json({ ok: false, error: "order_not_found" }, 404);
    orderGroup = lookup.order_group ?? lookup.id;
    firstOrderId = lookup.id;
    language = lookup.language ?? "he";
  }

  if (!orderGroup) {
    return json({ ok: false, error: "missing_order_reference" }, 400);
  }

  if (!firstOrderId || !body.customer?.name || !body.customer?.email) {
    const { data: row } = await supabase
      .from("orders")
      .select("id, customer_name, customer_email, customer_phone, language")
      .eq("order_group", orderGroup)
      .limit(1)
      .maybeSingle();
    if (row) {
      firstOrderId = firstOrderId ?? row.id;
      language = row.language ?? language;
      body.customer = {
        name: body.customer?.name || row.customer_name || "",
        email: body.customer?.email || row.customer_email || "",
        phone: body.customer?.phone || row.customer_phone || "",
      };
    }
  }

  const customerName = (body.customer?.name ?? "").trim();
  const customerEmail = (body.customer?.email ?? "").trim();
  const customerPhone = (body.customer?.phone ?? "").trim();
  if (!customerName || !customerEmail) {
    return json({ ok: false, error: "missing_customer_details" }, 400);
  }

  // Load every order in the group: used for idempotency, the authoritative
  // amount, AND the design-approval gate.
  const { data: existing } = await supabase
    .from("orders")
    .select("id, payment_status, total, requires_design_approval, design_approval_status")
    .eq("order_group", orderGroup);

  if (!existing || existing.length === 0) {
    return json({ ok: false, error: "order_not_found" }, 404);
  }
  if (existing.some((o) => o.payment_status === "succeeded")) {
    return json({ ok: false, error: "already_paid" }, 409);
  }

  // GATE: every custom-design order in the group must be approved before payment.
  const needsApproval = existing.some(
    (o) => o.requires_design_approval === true && o.design_approval_status !== "approved",
  );
  if (needsApproval) {
    return json(
      { ok: false, error: "design_not_approved", message: "This design must be approved by the shop before payment." },
      403,
    );
  }

  // AUTHORITATIVE amount: always the sum of the orders' totals in the DB.
  const amount = existing.reduce((s, o) => s + (Number(o.total) || 0), 0);
  if (!isFinite(amount) || amount <= 0) {
    return json({ ok: false, error: "invalid_server_amount" }, 400);
  }

  await supabase
    .from("orders")
    .update({ payment_status: "pending", payment_method: "tranzila" })
    .eq("order_group", orderGroup);

  const siteUrl = (Deno.env.get("SITE_URL") ?? "https://www.sfalimshop.com").replace(/\/+$/, "");
  const successUrl = `${siteUrl}/#track?order_group=${encodeURIComponent(orderGroup)}&paid=1`;
  const failUrl = `${siteUrl}/#order?paid=0`;
  const notifyUrl = `${supabaseUrl}/functions/v1/tranzila-webhook`;

  const description = (body.items_summary ?? "Sfalim Shop").slice(0, 60);

  const redirectUrl = buildTranzilaUrl({
    supplier, amount, orderGroup, description,
    customerName, customerEmail, customerPhone, language,
    notifyUrl, successUrl, failUrl,
  });

  await supabase.from("payment_events").insert({
    order_id: firstOrderId,
    order_group: orderGroup,
    event_type: "payment_intent_created",
    raw_payload: {
      amount,
      amount_source: "server_recomputed",
      client_amount: isFinite(clientAmount) ? clientAmount : null,
      client_amount_mismatch: isFinite(clientAmount) && Math.abs(clientAmount - amount) > 0.001,
      currency: "ILS",
      description,
      items_summary: body.items_summary ?? null,
      redirect_url: redirectUrl,
    },
    amount,
    ip_address: req.headers.get("x-forwarded-for") ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
  });

  return json({ ok: true, redirect_url: redirectUrl, order_group: orderGroup, amount });
});
