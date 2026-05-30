# 💳 Payments launch checklist (BLOCKED — do not enable without approval)

Status: **BLOCKED.** `PAYMENTS_ENABLED = false`, `MAINTENANCE_MODE = true`.
Waiting on: Tranzila **supplier number**. Do not touch payment code or flip flags
until Gleb provides it and approves.

This file documents what's already built and the gaps that **must** be closed
before real money flows. Compiled from a read-only audit on 2026-05-30.

---

## ✅ SECURITY GAPS — BOTH FIXED (live on production Supabase, 2026-05-31)

Both payment-integrity holes from the 2026-05-30 audit are now closed. The
fixes were applied directly to production Supabase via MCP and have since been
mirrored into the repo for tracking (migration + edge-function source). No
redeploy / `db push` needed — they are already live.

### ✅ (a) FIXED — Client can no longer write its own payment fields

**Was:** the checkout "Cancel" button (`App.jsx`) wrote `payment_status`
directly to `orders`. The RLS policy "Users update own orders" let any
logged-in customer set `payment_status = 'paid'` on their own unpaid order via
the API, faking a successful payment. `payment_status` is the source of truth
for "did they pay?" and must be server-writable only.

**Fix (live on prod):** a `BEFORE INSERT OR UPDATE` trigger on `public.orders`,
`trg_protect_order_payment_fields`, calling
`public.protect_order_payment_fields()`. For non-privileged callers (anyone who
is **not** `service_role` / `postgres` / `supabase_admin` /
`supabase_auth_admin` and **not** `is_admin()`):

- **INSERT** → all payment fields are force-reset to safe defaults
  (`payment_status = 'idle'`, `amount_paid/paid_at/tranzila_transaction_id/`
  `payment_method/failed_reason/cancelled_at = null`).
- **UPDATE** → all payment fields are pinned back to their `old` values
  (`payment_status`, `amount_paid`, `paid_at`, `total`,
  `tranzila_transaction_id`, `payment_method`, `currency`, `failed_reason`) —
  so a customer write to any of them is silently reverted.

Only the server (service-role: the Tranzila webhook) and admins can change
payment fields. The customer's browser cancel write is now a no-op on the
protected columns.

**Repo:** `supabase/migrations/20260531120000_harden_orders_payment_fields.sql`
(idempotent — `create or replace function` + `drop trigger if exists` — safe to
re-run even though already applied).

### ✅ (b) FIXED — `create-payment` ignores the client amount

**Was:** `create-payment` trusted the `amount` sent by the browser, so a
technical user could initiate a charge for ₪1 on a ₪100 order.

**Fix (live on prod):** `create-payment` now **always recomputes the charge
server-side** as `SUM(orders.total)` for the `order_group` (pulled with the
service-role key). The client-supplied `amount` is **informational only** —
never used for the charge; it is logged to `payment_events.raw_payload`
alongside an `amount_source: "server_recomputed"` marker and a
`client_amount_mismatch` flag for audit.

**Repo:** `supabase/functions/create-payment/index.ts` (synced from the
deployed version, `version 2`).

> Note: the live `create-payment` also tightened CORS/contract details and
> sets `payment_status = 'pending'` on intent creation (server-side, via
> service role — allowed by the trigger above).

---

## 🟡 FUNCTIONAL GAPS — needed for a working payment flow

1. **No `#pay-success` / `#pay-fail` landing handler.**
   `create-payment` builds return URLs (`#pay-success?og=...`, `#pay-fail?og=...`)
   but App.jsx has no route that catches them. After paying, the customer comes
   back to a hash the app ignores. Need a small landing screen (trilingual) that
   reads `?og=`, checks the order's `payment_status`, and shows success/failure.

2. **Tranzila field names are unverified.** Both Edge Functions have explicit
   `// TODO: verify against Tranzila docs` markers for the hosted-page path,
   param names (`sum`, `currency`, `tranmode`, `TranzilaTK`, `order`), the
   webhook fields (`Response`, `ConfirmationCode`, `sum`, `order`), and the
   success code (`"000"`). Confirm against the live account before trusting them.

---

## ✅ ALREADY BUILT (good)

- `supabase/functions/create-payment/` — builds the Tranzila hosted-page URL,
  validates the order, blocks already-paid/cancelled, logs a `payment_events`
  row. Gated: returns 503 "payments_disabled" if `TRANZILA_SUPPLIER` is unset,
  and the client falls back to a "coming soon" modal.
- `supabase/functions/tranzila-webhook/` — verifies `TranzilaTK`, parses the
  callback, writes `payment_events`, and on success flips `orders` to
  `payment_status='paid'` / `status='received'` with `paid_at`, `amount_paid`,
  `tranzila_transaction_id`.
- CSP in `vercel.json` already allows `frame-src` + `form-action` for
  `https://*.tranzila.com`.
- `orders` / `payment_events` schema is ready (all payment columns exist).
- `payment_events` RLS: admin-read + own-order-read; **written server-side only**.

---

## 🚦 Go-live order of operations (when the supplier number arrives)

1. ✅ ~~Fix the security gap above (server-side cancel + RLS).~~ **DONE** — both
   payment-integrity holes are fixed and live on prod (see the ✅ section above).
2. Add the `#pay-success` / `#pay-fail` handler.
3. Set Supabase secrets: `TRANZILA_SUPPLIER`, `TRANZILA_TK`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy both Edge Functions.
5. Sandbox end-to-end test → confirm the webhook actually flips `payment_status`.
6. Verify all Tranzila field-name TODOs against the live docs.
7. Flip `PAYMENTS_ENABLED = true`.
8. Flip `MAINTENANCE_MODE = false` **and** switch `index.html` robots tags to `index, follow`.
9. Swap sandbox → production `TRANZILA_SUPPLIER` / `TRANZILA_TK`.
