// ============================================================
// Sfalim Shop — Tranzila Payment Webhook (v12)
//
// Receives payment notifications from Tranzila after a customer
// completes payment on the Tranzila Hosted Page (iframenew).
//
// Endpoint: POST /functions/v1/tranzila-webhook
// Auth: Public (Tranzila has no JWT) — DO NOT enable "Verify JWT"
//
// ORDER REFERENCE: Tranzila OVERWRITES `myid` with the merchant id, so the
//   real order_group must be read from our custom field `u71`.
//
// INTEGRITY LAYERS:
//   Layer 1 (query-back, ENFORCED): independently confirm the transaction with
//     Tranzila's transaction-query API using our secret API keys. The raw
//     notify body is forgeable, so we never trust Response=000 alone. Verified
//     live: transaction_index must be an INTEGER; the response gives
//     processor_response_code, amount (agorot), currency, child_terminal.
//   Layer 2 (amount): the paid amount must match the order_group's DB total.
//
// VERIFY_MODE = "enforce": a successful notify is only marked paid if the
//   query-back confirms it. Otherwise the order is held as 'processing' for
//   manual review (safe failure — never wrongly marked paid).
//
// EMAILS: All order emails fire ONLY here, after a confirmed successful
//   payment — customer confirmation (send-order-confirmation) AND business
//   alert (send-admin-order-alert). Nothing is emailed before payment.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_MODE: "observe" | "enforce" = "enforce";

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

function makeNonce(len = 80): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const rand = new Uint32Array(len);
  crypto.getRandomValues(rand);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[rand[i] % chars.length];
  return out;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function tranzilaAuthHeaders(publicKey: string, privateKey: string): Promise<Record<string, string>> {
  const time = Math.round(Date.now() / 1000).toString();
  const nonce = makeNonce(80);
  const accessToken = await hmacSha256Hex(privateKey + time + nonce, publicKey);
  return {
    "X-tranzila-api-app-key": publicKey,
    "X-tranzila-api-request-time": time,
    "X-tranzila-api-nonce": nonce,
    "X-tranzila-api-access-token": accessToken,
    "Content-Type": "application/json",
  };
}

async function queryTransaction(opts: {
  terminal: string;
  index: string;
  publicKey: string;
  privateKey: string;
}): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  try {
    const headers = await tranzilaAuthHeaders(opts.publicKey, opts.privateKey);
    // transaction_index MUST be an integer (API rejects a string: error_code 20004).
    const indexNum = Number(opts.index);
    const res = await fetch("https://report.tranzila.com/v1/transaction", {
      method: "POST",
      headers,
      body: JSON.stringify({ terminal_name: opts.terminal, transaction_index: indexNum }),
    });
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: String(e) };
  }
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

  // IMPORTANT: read order_group from u71 FIRST. Tranzila overwrites `myid`
  // with the merchant id, so myid is unreliable (kept only as a last fallback).
  const orderGroupId =
    body.u71 ?? body.order_group ?? body.OrderID ?? body.client ?? body.myid ?? "";
  const txIndex =
    body.index ?? body.Index ?? body.transaction_id ?? body.TransactionIndex ?? body.transaction_index ?? "";
  const transactionId =
    txIndex || body.Tempref || body.ConfirmationCode || body.confirmation_code || "";
  const responseCode = body.Response ?? body.response_code ?? body.processor_response_code ?? "";
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

  const expectedTotal = orders.reduce(
    (sum, o) => sum + (parseFloat(String(o.total)) || 0),
    0,
  );

  // ============================================================
  // Layer 1 — query-back verification (independent confirmation)
  // ============================================================
  const appPublicKey = (Deno.env.get("TRANZILA_APP_PUBLIC_KEY") ?? "").trim();
  const appPrivateKey = (Deno.env.get("TRANZILA_APP_PRIVATE_KEY") ?? "").trim();
  const terminal = (Deno.env.get("TRANZILA_SUPPLIER") ?? "").trim();

  let querybackVerified = false;
  let querybackDetail: Record<string, unknown> = { mode: VERIFY_MODE };

  if (isSuccess) {
    if (!appPublicKey || !appPrivateKey || !terminal) {
      querybackDetail = { ...querybackDetail, skipped: "missing_api_credentials" };
    } else if (!txIndex) {
      querybackDetail = {
        ...querybackDetail,
        skipped: "missing_transaction_index",
        notify_keys: Object.keys(body),
      };
    } else {
      const q = await queryTransaction({
        terminal, index: txIndex, publicKey: appPublicKey, privateKey: appPrivateKey,
      });
      const txns = Array.isArray(q.data?.transactions) ? q.data.transactions : [];
      const tx =
        txns.find((t: any) => String(t?.index) === String(txIndex)) ?? txns[0] ?? null;

      const procCode = tx
        ? String(tx.processor_response_code ?? tx.response_code ?? tx.Response ?? "")
        : "";
      const rawAmount = tx ? Number(tx.amount ?? tx.sum ?? 0) : 0;
      const amountShekels = rawAmount > 0 ? rawAmount / 100 : 0;
      const txCurrency = tx ? String(tx.currency ?? "") : "";
      const txTerminal = tx
        ? String(tx.child_terminal ?? tx.terminal ?? tx.terminal_name ?? "")
        : "";

      const approvedOk = procCode === "000";
      const amountOk = expectedTotal > 0 && Math.abs(amountShekels - expectedTotal) <= 0.01;
      const currencyOk =
        txCurrency === "" || txCurrency === "1" || txCurrency === "ILS" || txCurrency === "376";
      const terminalOk =
        txTerminal === "" || txTerminal.toLowerCase() === terminal.toLowerCase();

      querybackVerified = q.ok && !!tx && approvedOk && amountOk && currencyOk && terminalOk;

      querybackDetail = {
        ...querybackDetail,
        http_ok: q.ok,
        http_status: q.status,
        http_error: q.error ?? null,
        queried_index: txIndex,
        found_tx: !!tx,
        processor_response_code: procCode,
        query_amount_raw: rawAmount,
        query_amount_shekels: amountShekels,
        expected_total: expectedTotal,
        query_currency: txCurrency,
        query_terminal: txTerminal,
        checks: { approvedOk, amountOk, currencyOk, terminalOk },
        verified: querybackVerified,
        raw_response: q.data,
      };
    }

    await supabase.from("payment_events").insert({
      order_id: firstOrder.id,
      order_group: orderGroupId,
      event_type: "queryback_result",
      raw_payload: querybackDetail,
      amount: amount || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  }
  // ---- end Layer 1 ----

  // ---- Layer 2 integrity: the paid amount must match the order total ----
  const amountMismatch =
    isSuccess && (!(expectedTotal > 0) || Math.abs(amount - expectedTotal) > 0.01);

  const enforceFailed = VERIFY_MODE === "enforce" && isSuccess && !querybackVerified;

  if (amountMismatch || enforceFailed) {
    const reason = amountMismatch
      ? `Amount mismatch: expected ${expectedTotal.toFixed(2)}, received ${amount.toFixed(2)} — held for manual review.`
      : `Query-back verification failed — held for manual review.`;

    await supabase
      .from("orders")
      .update({
        payment_status: "processing",
        payment_method: "tranzila",
        tranzila_transaction_id: transactionId || null,
        failed_reason: reason,
      })
      .eq("order_group", orderGroupId);

    await supabase.from("payment_events").insert({
      order_id: firstOrder.id,
      order_group: orderGroupId,
      event_type: amountMismatch ? "payment_amount_mismatch" : "payment_held_unverified",
      raw_payload: {
        expected_total: expectedTotal,
        received_amount: amount,
        response_code: responseCode,
        queryback: querybackDetail,
        body,
      },
      amount: amount || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    return jsonResponse(
      {
        ok: false,
        error: amountMismatch ? "amount_mismatch" : "verification_failed",
        expected: expectedTotal,
        received: amount,
      },
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
    raw_payload: { body, queryback_verified: querybackVerified, verify_mode: VERIFY_MODE },
    amount: amount || null,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (isSuccess) {
    // (1) Customer confirmation email — only after confirmed payment
    try {
      const totalAmount = orders.reduce(
        (sum, o) => sum + (parseFloat(String(o.total)) || 0),
        0,
      );
      const productList = orders.map((o) => o.product).join(", ");
      await supabase.functions.invoke("send-order-confirmation", {
        body: {
          // Pass order_group so the email renders every item with its real
          // model, size/variant, colour and mockup preview (the function
          // re-reads the rows from the DB). Without it the email falls back
          // to a single generic "N items" line.
          orderGroup: orderGroupId,
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

    // (2) Business alert email — only after confirmed payment (paid order)
    try {
      await supabase.functions.invoke("send-admin-order-alert", {
        body: { orderGroup: orderGroupId },
      });
    } catch (alertErr) {
      console.error("Failed to send admin alert:", alertErr);
      await supabase.from("payment_events").insert({
        order_id: firstOrder.id,
        order_group: orderGroupId,
        event_type: "admin_alert_failed",
        raw_payload: { error: String(alertErr) },
      });
    }
  }

  return jsonResponse({
    ok: true,
    status: newOrderStatus,
    payment_status: newPaymentStatus,
    queryback_verified: querybackVerified,
    verify_mode: VERIFY_MODE,
    orders_updated: orders.length,
  });
});
