// ============================================================
// Sfalim Shop — Tranzila Payment Webhook
//
// Receives payment notifications from Tranzila after a customer
// completes payment on the Tranzila Hosted Page.
//
// Endpoint: POST /functions/v1/tranzila-webhook
// Auth: Public (Tranzila has no JWT) — DO NOT enable "Verify JWT"
//
// INTEGRITY LAYERS:
//   Layer 2 (ACTIVE): the paid amount reported by Tranzila must match the
//     sum of the order_group's totals in the DB. On mismatch we do NOT mark
//     the order paid — we hold it as 'processing' for manual review and send
//     no confirmation. (Prevents "paid 1 instead of 100" / tampered notices.)
//   Layer 1 (TODO at sandbox): verify Tranzila's signature/secret once the
//     supplier account details are known (see TODO below).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ ok: false, error: "Server misconfigured" }, 500);
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const ipAddress =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  let body: Record<string, string> = {};
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }
  } catch (e) {
    return jsonResponse({ ok: false, error: "Could not parse body" }, 400);
  }

  const orderGroupId =
    body.myid ?? body.order_group ?? body.OrderID ?? body.client ?? "";
  const transactionId =
    body.Tempref ?? body.confirmation_code ?? body.transaction_id ?? "";
  const responseCode = body.Response ?? body.response_code ?? "";
  const amountStr = body.sum ?? body.amount ?? "0";
  const amount = parseFloat(amountStr) || 0;

  // Tranzila success codes: "000" = approved
  const isSuccess = responseCode === "000" || responseCode === "0";

  // Audit log of the raw webhook BEFORE doing anything else
  await supabase.from("payment_events").insert({
    order_group: orderGroupId || null,
    event_type: "webhook_received",
    raw_payload: body,
    amount: amount || null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  // ============================================================
  // TODO (Layer 1 — at Tranzila sandbox): verify the webhook signature here,
  // using the secret/hash mechanism Tranzila provides for your supplier.
  //   if (!verifyTranzilaSignature(body, Deno.env.get("TRANZILA_WEBHOOK_SECRET"))) {
  //     return jsonResponse({ ok: false, error: "Invalid signature" }, 401);
  //   }
  // ============================================================

  if (!orderGroupId) {
    return jsonResponse({ ok: false, error: "Missing order_group" }, 400);
  }

  const { data: orders, error: fetchError } = await supabase
    .from("orders")
    .select("id, customer_email, customer_name, payment_status, total, language, product")
    .eq("order_group", orderGroupId);

  if (fetchError) {
    await supabase.from("payment_events").insert({
      order_group: orderGroupId,
      event_type: "webhook_db_error",
      raw_payload: { error: fetchError.message, body },
      ip_address: ipAddress,
    });
    return jsonResponse({ ok: false, error: "DB error" }, 500);
  }

  if (!orders || orders.length === 0) {
    await supabase.from("payment_events").insert({
      order_group: orderGroupId,
      event_type: "webhook_unknown_order",
      raw_payload: body,
      ip_address: ipAddress,
    });
    return jsonResponse({ ok: false, error: "Order not found" }, 404);
  }

  const firstOrder = orders[0];

  // Idempotency: if already succeeded, don't process again
  if (firstOrder.payment_status === "succeeded") {
    await supabase.from("payment_events").insert({
      order_id: firstOrder.id,
      order_group: orderGroupId,
      event_type: "webhook_duplicate_ignored",
      raw_payload: body,
    });
    return jsonResponse({ ok: true, message: "Already processed" });
  }

  // ---- Layer 2 integrity: the paid amount must match the order total ----
  const expectedTotal = orders.reduce(
    (sum, o) => sum + (parseFloat(String(o.total)) || 0),
    0,
  );
  const amountMismatch =
    isSuccess && (!(expectedTotal > 0) || Math.abs(amount - expectedTotal) > 0.01);

  if (amountMismatch) {
    // Do NOT mark paid. Hold for manual review; send no confirmation.
    await supabase
      .from("orders")
      .update({
        payment_status: "processing",
        payment_method: "tranzila",
        tranzila_transaction_id: transactionId || null,
        failed_reason: `Amount mismatch: expected ${expectedTotal.toFixed(2)}, received ${amount.toFixed(2)} — held for manual review.`,
      })
      .eq("order_group", orderGroupId);

    await supabase.from("payment_events").insert({
      order_id: firstOrder.id,
      order_group: orderGroupId,
      event_type: "payment_amount_mismatch",
      raw_payload: {
        expected_total: expectedTotal,
        received_amount: amount,
        response_code: responseCode,
        body,
      },
      amount: amount || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return jsonResponse(
      { ok: false, error: "amount_mismatch", expected: expectedTotal, received: amount },
      409,
    );
  }
  // ---- end Layer 2 ----

  const nowIso = new Date().toISOString();
  const newOrderStatus = isSuccess ? "paid" : "received";
  const newPaymentStatus = isSuccess ? "succeeded" : "failed";

  const updates: Record<string, unknown> = {
    status: newOrderStatus,
    payment_status: newPaymentStatus,
    payment_method: "tranzila",
    tranzila_transaction_id: transactionId || null,
  };

  if (isSuccess) {
    updates.paid_at = nowIso;
    updates.amount_paid = amount || null;
    updates.failed_reason = null;
  } else {
    updates.failed_reason = body.error_message ?? `Tranzila code ${responseCode}`;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update(updates)
    .eq("order_group", orderGroupId);

  if (updateError) {
    await supabase.from("payment_events").insert({
      order_id: firstOrder.id,
      order_group: orderGroupId,
      event_type: "webhook_update_failed",
      raw_payload: { error: updateError.message, body },
      ip_address: ipAddress,
    });
    return jsonResponse({ ok: false, error: "Update failed" }, 500);
  }

  await supabase.from("payment_events").insert({
    order_id: firstOrder.id,
    order_group: orderGroupId,
    event_type: isSuccess ? "payment_succeeded" : "payment_failed",
    raw_payload: body,
    amount: amount || null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (isSuccess) {
    try {
      const totalAmount = orders.reduce(
        (sum, o) => sum + (parseFloat(String(o.total)) || 0),
        0,
      );
      const productList = orders.map((o) => o.product).join(", ");
      await supabase.functions.invoke("send-order-confirmation", {
        body: {
          customerName: firstOrder.customer_name,
          customerEmail: firstOrder.customer_email,
          product: productList,
          variant: `${orders.length} items`,
          quantity: orders.length,
          total: totalAmount,
          orderId: firstOrder.id,
          language: firstOrder.language || "he",
        },
      });
    } catch (emailErr) {
      console.error("Failed to send confirmation email:", emailErr);
      await supabase.from("payment_events").insert({
        order_id: firstOrder.id,
        order_group: orderGroupId,
        event_type: "email_send_failed",
        raw_payload: { error: String(emailErr) },
      });
    }
  }

  return jsonResponse({
    ok: true,
    status: newOrderStatus,
    payment_status: newPaymentStatus,
    orders_updated: orders.length,
  });
});
