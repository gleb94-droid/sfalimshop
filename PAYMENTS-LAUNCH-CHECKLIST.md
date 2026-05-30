# 💳 Payments launch checklist (BLOCKED — do not enable without approval)

Status: **BLOCKED.** `PAYMENTS_ENABLED = false`, `MAINTENANCE_MODE = true`.
Waiting on: Tranzila **supplier number**. Do not touch payment code or flip flags
until Gleb provides it and approves.

This file documents what's already built and the gaps that **must** be closed
before real money flows. Compiled from a read-only audit on 2026-05-30.

---

## 🔴 SECURITY GAP — must fix BEFORE enabling payments

### Client can set its own `payment_status` (cancel button)

**Where:** `App.jsx:5413–5417` (the "Cancel" button on checkout step 4).

```js
await supabase.from("orders").update({
  status: "cancelled",
  payment_status: "cancelled",
  cancelled_at: new Date().toISOString(),
}).in("id", pendingOrderIds);
```

**The problem:** the browser writes `payment_status` directly to the `orders`
table. The RLS policy "Users update own orders" allows a logged-in user to
update **their own** orders — including `payment_status`. So a technical user
could call the same API and set `payment_status = 'paid'` on their own
unpaid order, faking a successful payment.

> Guests (rows where `user_id IS NULL`) cannot exploit this — the update policy
> only permits owner-or-admin — but every logged-in customer can, on their own
> orders.

**Why it matters:** `payment_status` is the source of truth for "did they pay?"
It must be writable **only by the server** (the Tranzila webhook, via the
service-role key), never by the customer's browser.

**Recommended fix (needs Gleb's approval — touches RLS + App.jsx):**

1. **Move cancellation server-side.** Replace the client `update` with a call to
   a small Edge Function (or extend `create-payment`) that cancels using the
   service-role key. The browser should never write `payment_status` /
   `paid_at` / `amount_paid` / `tranzila_transaction_id`.
2. **Tighten the RLS update policy** so customers can update only "safe" columns
   (e.g. notes) and **not** the payment columns. Options: a column-restricted
   policy, a `BEFORE UPDATE` trigger that rejects customer writes to payment
   columns, or simply remove customer UPDATE rights entirely and route all
   state changes through the server.

⚠️ Both of these are explicitly **off-limits until approved** (RLS change +
App.jsx edit). Logged here so we don't forget.

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

1. Fix the security gap above (server-side cancel + RLS) — **approve first**.
2. Add the `#pay-success` / `#pay-fail` handler.
3. Set Supabase secrets: `TRANZILA_SUPPLIER`, `TRANZILA_TK`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy both Edge Functions.
5. Sandbox end-to-end test → confirm the webhook actually flips `payment_status`.
6. Verify all Tranzila field-name TODOs against the live docs.
7. Flip `PAYMENTS_ENABLED = true`.
8. Flip `MAINTENANCE_MODE = false` **and** switch `index.html` robots tags to `index, follow`.
9. Swap sandbox → production `TRANZILA_SUPPLIER` / `TRANZILA_TK`.
