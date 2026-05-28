// supabase/functions/tranzila-webhook/index.ts
//
// Deno Edge Function — receives Tranzila's server-to-server payment notification.
// This is the ONLY place that updates orders.payment_status to "paid" or "failed".
// Client-side redirects (success_url / fail_url) are for UX only, never trusted.
//
// Tranzila posts to this URL (set as notify_url in create-payment):
//   https://<project-ref>.supabase.co/functions/v1/tranzila-webhook
//
// TODO: verify against Tranzila docs — confirm:
//   1. The HTTP method Tranzila uses for the notification (POST assumed)
//   2. The Content-Type (application/x-www-form-urlencoded assumed)
//   3. The exact field names in the notification payload
//   4. The authentication/verification mechanism (see step 2 below)
//   5. The success Response code (000 assumed — verify against Tranzila docs)
//   6. Whether Tranzila retries on non-200 responses and the retry schedule

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────────────────────────
// Tranzila's server-to-server POST does not send CORS headers / preflight.
// We still handle OPTIONS for browser testing during development.
function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": `*`,
    "Access-Control-Allow-Headers": `content-type`,
    "Access-Control-Allow-Methods": `POST, OPTIONS`,
  };
}

// ─── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return new Response(`Method not allowed`, { status: 405 });
  }

  // ── 1. Build Supabase admin client (service-role, bypasses RLS) ───────────
  const supabaseUrl = Deno.env.get(`SUPABASE_URL`) ?? ``;
  const serviceRoleKey = Deno.env.get(`SUPABASE_SERVICE_ROLE_KEY`) ?? ``;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`[tranzila-webhook] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
    // Return 500 so Tranzila retries — do not return 200 on misconfiguration
    return new Response(`Server misconfiguration`, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── 2. Parse the notification body ───────────────────────────────────────
  // TODO: verify against Tranzila docs — Tranzila may send form-encoded or JSON.
  // Assumption: application/x-www-form-urlencoded (standard for Israeli PSPs).
  let params: URLSearchParams;
  try {
    const raw = await req.text();
    params = new URLSearchParams(raw);
  } catch (parseErr) {
    console.error(`[tranzila-webhook] Failed to parse body:`, parseErr);
    return new Response(`Bad request`, { status: 400 });
  }

  // Log the raw payload immediately (before any processing) so we have a record
  // even if subsequent DB operations fail.
  const rawPayload: Record<string, string> = {};
  params.forEach((value, key) => { rawPayload[key] = value; });

  console.log(`[tranzila-webhook] received:`, JSON.stringify(rawPayload));

  // ── 3. Verify authenticity ───────────────────────────────────────────────
  // TODO: verify against Tranzila docs — Tranzila does not use HMAC signatures
  // in all integration types. Verification options (confirm which applies):
  //   a) Check that TranzilaTK in the payload matches our stored secret.
  //   b) Validate the notification against Tranzila's verification API endpoint.
  //   c) IP allowlist (Tranzila publishes their notification server IP ranges).
  // For now, check TranzilaTK as a minimum.

  // TODO: swap to production at go-live ↓↓↓
  // TRANZILA_TK: sandbox terminal password now, real password at go-live.
  const expectedTK = Deno.env.get(`TRANZILA_TK`) ?? ``;
  const receivedTK = params.get(`TranzilaTK`) ?? ``;

  if (expectedTK && receivedTK !== expectedTK) {
    console.warn(`[tranzila-webhook] TK mismatch — possible spoofed notification`);
    // Return 200 to avoid Tranzila flagging our endpoint as broken,
    // but do not process the payment.
    // TODO: verify against Tranzila docs — whether returning 403 causes retry loops
    return new Response(`OK`, { status: 200 });
  }

  // ── 4. Extract key fields ─────────────────────────────────────────────────
  // TODO: verify against Tranzila docs — exact field names may differ
  const responseCode = params.get(`Response`) ?? ``; // TODO: confirm field name
  const confirmationCode = params.get(`ConfirmationCode`) ?? ``; // TODO: confirm field name
  const rawSum = params.get(`sum`) ?? `0`; // TODO: confirm field name
  const orderGroup = params.get(`order`) ?? ``; // the value we passed as `order=` in create-payment
  const currency = params.get(`currency`) ?? `ILS`; // TODO: confirm field name and value format

  // TODO: verify against Tranzila docs — confirm exact success code(s)
  // Common Tranzila success code is "000" but verify this.
  const TRANZILA_SUCCESS_CODE = `000`; // TODO: confirm against Tranzila docs

  const isPaid = responseCode === TRANZILA_SUCCESS_CODE;
  const amount = parseFloat(rawSum) || 0;

  const ipAddress =
    req.headers.get(`x-forwarded-for`) ??
    req.headers.get(`cf-connecting-ip`) ??
    null;
  const userAgent = req.headers.get(`user-agent`) ?? null;

  // ── 5. Log the raw event FIRST, regardless of outcome ────────────────────
  const { error: logError } = await supabase.from(`payment_events`).insert({
    order_group: orderGroup || null,
    event_type: isPaid ? `payment_paid` : `payment_failed`,
    raw_payload: rawPayload,
    amount,
    currency,
    ip_address: ipAddress,
    user_agent: userAgent,
  });

  if (logError) {
    console.error(`[tranzila-webhook] Failed to log payment_event:`, logError);
    // Non-fatal for the webhook response, but log it. Continue to update order.
  }

  // ── 6. Update orders ──────────────────────────────────────────────────────
  if (!orderGroup) {
    console.warn(`[tranzila-webhook] No order_group in notification — cannot update orders`);
    // Still return 200 so Tranzila does not retry indefinitely
    return new Response(`OK`, { status: 200 });
  }

  if (isPaid) {
    // Payment confirmed — update all rows in the order group atomically
    const { error: updateError } = await supabase
      .from(`orders`)
      .update({
        payment_status: `paid`,
        paid_at: new Date().toISOString(),
        amount_paid: amount,
        tranzila_transaction_id: confirmationCode,
        // Advance the fulfilment status so the admin dashboard shows the order
        status: `received`,
      })
      .eq(`order_group`, orderGroup)
      .in(`payment_status`, [`idle`, `failed`]); // idempotent: skip if already paid

    if (updateError) {
      console.error(`[tranzila-webhook] Failed to update orders to paid:`, updateError);
      // Return 500 so Tranzila retries — we want this to succeed
      return new Response(`DB error`, { status: 500 });
    }

    console.log(`[tranzila-webhook] order_group=${orderGroup} marked as paid, confirmationCode=${confirmationCode}`);
  } else {
    // Payment failed or declined
    const failedReason = `Tranzila Response code: ${responseCode}`;
    // TODO: verify against Tranzila docs — map numeric response codes to
    // human-readable Hebrew/English messages for customer-facing display

    const { error: updateError } = await supabase
      .from(`orders`)
      .update({
        payment_status: `failed`,
        failed_reason: failedReason,
      })
      .eq(`order_group`, orderGroup)
      .in(`payment_status`, [`idle`]); // do not overwrite "paid" with "failed"

    if (updateError) {
      console.error(`[tranzila-webhook] Failed to update orders to failed:`, updateError);
      return new Response(`DB error`, { status: 500 });
    }

    console.log(`[tranzila-webhook] order_group=${orderGroup} marked as failed, responseCode=${responseCode}`);
  }

  // ── 7. Respond 200 OK to Tranzila ────────────────────────────────────────
  // Tranzila requires a 200 response to stop retrying.
  return new Response(`OK`, { status: 200 });
});
