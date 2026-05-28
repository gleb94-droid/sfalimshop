// supabase/functions/create-payment/index.ts
//
// Deno Edge Function — builds and returns a Tranzila hosted-payment-page
// redirect URL for a given order_group. Does NOT change orders.payment_status.
// Logs a "payment_initiated" row to payment_events.
//
// Invoked by the client as:
//   supabase.functions.invoke("create-payment", {
//     body: { order_group, amount, currency, customer: { name, email, phone }, items_summary }
//   })
//
// Returns: { redirect_url: string } or { error: string } with appropriate status.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ───────────────────────────────────────────────────────────────────
// Only the production origin and localhost dev are allowed.
// TODO: verify against Tranzila docs — Tranzila's notify_url POST will NOT
// hit this function, so no need to allow Tranzila's origin here.
const ALLOWED_ORIGINS = [
  `https://www.sfalimshop.com`,
  `https://sfalimshop.com`,
  `http://localhost:5173`,
  `http://localhost:3000`,
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ─── Tranzila config ─────────────────────────────────────────────────────────
// TODO: swap to production at go-live ↓↓↓
// TRANZILA_SUPPLIER: the terminal/supplier name assigned by Tranzila.
//   Sandbox value:    "sfalimtest"   (or whatever sandbox name Tranzila assigns)
//   Production value: the real supplier name received from Tranzila
// Set in Supabase Dashboard → Edge Functions → Secrets → TRANZILA_SUPPLIER
//
// TODO: verify against Tranzila docs — confirm the sandbox base URL and
// the exact query-parameter names for their hosted payment page.
const TRANZILA_BASE_URL = `https://direct.tranzila.com`; // same for sandbox + production; supplier name determines environment

// ─── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: `Method not allowed` }), {
      status: 405,
      headers: { ...headers, "Content-Type": `application/json` },
    });
  }

  // ── 1. Check that payments are enabled (supplier name is set) ──────────────
  const supplierName = Deno.env.get(`TRANZILA_SUPPLIER`);
  if (!supplierName) {
    // Graceful degradation: client checks for "payments_disabled" in the error
    // message and falls back to the "coming soon" modal (App.jsx line 5211).
    return new Response(
      JSON.stringify({ error: `payments_disabled: TRANZILA_SUPPLIER not set` }),
      {
        status: 503,
        headers: { ...headers, "Content-Type": `application/json` },
      }
    );
  }

  // TODO: swap to production at go-live ↓↓↓
  // TRANZILA_TK: the terminal password (TranzilaTK / notify password).
  //   Sandbox value:    sandbox password from Tranzila test account
  //   Production value: real terminal password from Tranzila
  // Set in Supabase Dashboard → Edge Functions → Secrets → TRANZILA_TK
  const tranzilaTK = Deno.env.get(`TRANZILA_TK`) ?? ``;

  // ── 2. Build Supabase admin client (service-role, bypasses RLS) ───────────
  const supabaseUrl = Deno.env.get(`SUPABASE_URL`) ?? ``;
  const serviceRoleKey = Deno.env.get(`SUPABASE_SERVICE_ROLE_KEY`) ?? ``;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`[create-payment] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
    return new Response(JSON.stringify({ error: `Server misconfiguration` }), {
      status: 500,
      headers: { ...headers, "Content-Type": `application/json` },
    });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── 3. Parse and validate request body ───────────────────────────────────
  let body: {
    order_group?: string;
    amount?: number;
    currency?: string;
    customer?: { name?: string; email?: string; phone?: string };
    items_summary?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: `Invalid JSON body` }), {
      status: 400,
      headers: { ...headers, "Content-Type": `application/json` },
    });
  }

  const { order_group, amount, currency = `ILS`, customer, items_summary } =
    body;

  if (!order_group || typeof amount !== `number` || amount <= 0) {
    return new Response(
      JSON.stringify({ error: `order_group and a positive amount are required` }),
      { status: 400, headers: { ...headers, "Content-Type": `application/json` } }
    );
  }

  // ── 4. Verify that the order_group exists in DB and is in a payable state ─
  const { data: orders, error: dbError } = await supabase
    .from(`orders`)
    .select(`id, payment_status, total`)
    .eq(`order_group`, order_group);

  if (dbError) {
    console.error(`[create-payment] DB error fetching orders:`, dbError);
    return new Response(JSON.stringify({ error: `Database error` }), {
      status: 500,
      headers: { ...headers, "Content-Type": `application/json` },
    });
  }

  if (!orders || orders.length === 0) {
    return new Response(JSON.stringify({ error: `Order group not found` }), {
      status: 404,
      headers: { ...headers, "Content-Type": `application/json` },
    });
  }

  // Reject if any row is already paid or cancelled
  const nonPayable = orders.find(
    (o: { payment_status: string }) =>
      o.payment_status === `paid` || o.payment_status === `cancelled`
  );
  if (nonPayable) {
    return new Response(
      JSON.stringify({
        error: `Order is not in a payable state: ${nonPayable.payment_status}`,
      }),
      { status: 409, headers: { ...headers, "Content-Type": `application/json` } }
    );
  }

  // ── 5. Build the Tranzila hosted-page URL ─────────────────────────────────
  // TODO: verify against Tranzila docs — confirm exact parameter names,
  // the notify_url mechanism, and the currency code for ILS.
  // Tranzila hosted page docs: https://www.tranzila.com/developers/
  const siteOrigin = `https://www.sfalimshop.com`;
  const notifyUrl = `${supabaseUrl}/functions/v1/tranzila-webhook`;
  const successUrl = `${siteOrigin}/#pay-success?og=${encodeURIComponent(order_group)}`;
  const failUrl = `${siteOrigin}/#pay-fail?og=${encodeURIComponent(order_group)}`;

  // Truncate product description to 60 characters (Tranzila limit)
  // TODO: verify against Tranzila docs — confirm max length for pdesc field
  const pdesc = String(items_summary ?? `Sfalim order`).slice(0, 60);

  const params = new URLSearchParams({
    // TODO: verify against Tranzila docs — confirm field names exactly
    sum: String(amount),
    currency: `1`, // 1 = ILS. TODO: verify currency code in Tranzila docs
    cred_type: `1`, // 1 = regular credit. TODO: verify against Tranzila docs
    tranmode: `A`, // A = authorize+capture. TODO: verify against Tranzila docs
    contact: customer?.name ?? ``,
    email: customer?.email ?? ``,
    phone: customer?.phone ?? ``,
    pdesc,
    notify_url: notifyUrl,
    success_url: successUrl,
    fail_url: failUrl,
    TranzilaTK: tranzilaTK,
    // Pass order_group so the webhook can identify which order was paid
    // TODO: verify against Tranzila docs — confirm Tranzila echoes a custom
    // "order" or "user_data" field back in the webhook notification
    order: order_group,
  });

  // TODO: swap to production at go-live ↓↓↓
  // The sandbox uses the same domain but a test supplier name.
  // Production uses the same URL structure with the real supplier name.
  const redirectUrl = `${TRANZILA_BASE_URL}/${encodeURIComponent(supplierName)}/iframenew.php?${params.toString()}`;
  // TODO: verify against Tranzila docs — confirm the hosted-page path
  // (/iframenew.php vs /iframe.php vs another path)

  // ── 6. Log payment_initiated to payment_events ───────────────────────────
  const ipAddress =
    req.headers.get(`x-forwarded-for`) ??
    req.headers.get(`cf-connecting-ip`) ??
    null;
  const userAgent = req.headers.get(`user-agent`) ?? null;

  const { error: logError } = await supabase.from(`payment_events`).insert({
    order_group,
    event_type: `payment_initiated`,
    raw_payload: {
      order_group,
      amount,
      currency,
      customer_email: customer?.email ?? null,
      items_summary: pdesc,
    },
    amount,
    currency: currency ?? `ILS`,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (logError) {
    // Non-fatal: log the error but continue — the customer must not be blocked
    // from paying just because the audit log insert failed.
    console.error(`[create-payment] Failed to log payment_initiated:`, logError);
  }

  // ── 7. Return redirect URL to client ──────────────────────────────────────
  return new Response(JSON.stringify({ redirect_url: redirectUrl }), {
    status: 200,
    headers: { ...headers, "Content-Type": `application/json` },
  });
});
