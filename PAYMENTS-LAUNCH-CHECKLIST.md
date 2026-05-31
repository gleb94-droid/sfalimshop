# 💳 Payments launch checklist (BLOCKED — do not enable without approval)

Status: **BLOCKED.** `PAYMENTS_ENABLED = false`, `MAINTENANCE_MODE = true`.
Waiting on: **Tranzila supplier** (supplier docs **submitted 2026-05-31**, awaiting
the supplier number). Do not flip flags until Gleb confirms.

> **STATE AS OF 2026-05-31:** Both payment-integrity holes are **FIXED & live on
> prod** (orders payment-field trigger + `create-payment` v4 server-side amount).
> The **custom-design approval workflow** is **live** (`create-payment` v4 gate +
> trigger + `notify-design-decision` v1 disabled). **`tranzila-webhook` v2** adds
> **Layer-2 amount verification** (live); **Layer-1 signature verification is the
> main remaining payment-security TODO** (sandbox). Production is `main` HEAD
> `e3a31b4` behind the maintenance gate. See "🔔 Launch-arming" below and the
> "STATE AS OF 2026-05-31" block in `CLAUDE.md`.

Originally compiled from a read-only audit on 2026-05-30; kept current since.

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
deployed version, now `version 3` — adds the design-approval gate below).

> Note: the live `create-payment` also tightened CORS/contract details and
> sets `payment_status = 'pending'` on intent creation (server-side, via
> service role — allowed by the trigger above).

---

## 🎨 Custom-design approval workflow (LIVE on prod Supabase, 2026-05-31)

Custom orders where the **customer uploads their own image** (the design-studio
upload path — NOT BLOOM gallery items, NOT pet-name personalization) must be
**approved by the shop before they can pay**. The UI is in `App.jsx`
(checkout → track → admin); the server pieces are below. All live; the repo now
mirrors them (no `db push` / redeploy needed).

### DB columns + trigger
- New `orders` columns: `requires_design_approval` (bool, default `false`),
  `design_approval_status` (text, default `'not_required'`, CHECK in
  `not_required | pending | approved | rejected`), `design_review_note` (text),
  `design_reviewed_at` (timestamptz).
- The **same** `protect_order_payment_fields()` trigger that freezes payment
  fields ALSO governs design-approval transitions for non-privileged
  (customer) callers:
  - **INSERT** → if `requires_design_approval` is true, force
    `design_approval_status='pending'`, else `'not_required'`; clear note +
    reviewed_at. (So the client cannot self-insert an `'approved'` row.)
  - **UPDATE** → the only customer-allowed transition is
    `rejected → pending` (the "edit & resubmit" flow). Every other write to
    `design_approval_status` is pinned back to `old`. `requires_design_approval`,
    `design_review_note`, `design_reviewed_at` are also pinned. So **only the
    shop (admin / service-role) can approve or reject.**
- **Repo:** `supabase/migrations/20260531130000_add_design_approval_workflow.sql`
  (idempotent: `add column if not exists` + guarded CHECK +
  `create or replace function` + `drop trigger if exists`). This migration's
  trigger body supersedes the payment-only one in
  `20260531120000_harden_orders_payment_fields.sql` (later timestamp wins).

### `create-payment` gate
- Before charging, `create-payment` (v3) loads every row in the `order_group`
  and **refuses payment** (`403 design_not_approved`) if any row has
  `requires_design_approval = true` AND `design_approval_status <> 'approved'`.
  This complements the client-side gating in the track page.

### `notify-design-decision` email function — BUILT, **DISABLED by default**
- **Repo:** `supabase/functions/notify-design-decision/index.ts`
  (deployed, `verify_jwt=false`). Emails the customer (BLOOM-branded, he/en/ru)
  when the shop **approves** or **requests changes** on a custom design.
- Intended trigger: a **Supabase Database Webhook on UPDATE of
  `public.orders`** → POSTs the row to this function with an
  `x-webhook-secret` header.
- Fires a real email ONLY when ALL are true: (1) `design_approval_status`
  actually changed to `approved`/`rejected`; (2) `requires_design_approval =
  true`; (3) secret `DESIGN_NOTIFY_ENABLED === "true"`; (4) `RESEND_API_KEY`
  set. **Default = OFF / dry-run** (logs what it would send, sends nothing).
  Missing/incorrect `x-webhook-secret` → `401`, nothing sent.
- ⚠️ The webhook secret currently uses an **in-code fallback** in
  `notify-design-decision/index.ts` — same TODO as `waitlist-welcome`: move to
  the `DESIGN_NOTIFY_WEBHOOK_SECRET` Edge Function secret and rotate.

#### 🔔 LAUNCH-ARMING step (to turn the approval emails on)
When you want approval/changes emails to actually send:
1. **Create the DB webhook:** Supabase Dashboard → Database → Webhooks → new
   hook: table `orders`, event **UPDATE**, type **HTTP Request / POST**, URL =
   the `notify-design-decision` function URL, add HTTP header
   `x-webhook-secret = <the secret>` (the Edge Function secret
   `DESIGN_NOTIFY_WEBHOOK_SECRET`, or the in-code fallback).
2. **Arm sending:** set Edge Function secret `DESIGN_NOTIFY_ENABLED="true"`
   (and confirm `RESEND_API_KEY` is set). Until then it stays in dry-run.
3. Optionally do a dry-run first (leave `DESIGN_NOTIFY_ENABLED` unset) and watch
   the function logs to confirm the webhook fires on approve/reject.

---

## 🛡️ Webhook payment integrity (`tranzila-webhook`)

The `tranzila-webhook` function (live on prod, **v2**; repo mirrors it — no
redeploy) is the ONLY place that flips `orders.payment_status` to paid/failed.
Two integrity layers:

- ✅ **Layer 2 — amount verification (DONE / LIVE):** on a success notice the
  amount Tranzila reports (`sum`) must equal the sum of the `order_group`'s
  `orders.total` in the DB (±0.01). On mismatch the order is **NOT** marked paid
  — it's held as `payment_status='processing'` with a `failed_reason`, a
  `payment_amount_mismatch` event is logged, the webhook returns `409`, and
  **no confirmation email is sent**. Prevents "paid ₪1 on a ₪100 order" /
  tampered notices. Complements `create-payment`'s server-side amount recompute.
- ⏳ **Layer 1 — signature verification (TODO at Tranzila sandbox):** verify the
  notice is genuinely from Tranzila using the secret/hash mechanism for the
  supplier account. There's a marked `// TODO (Layer 1 …)` stub in the function
  (`TRANZILA_WEBHOOK_SECRET`). Wire it up during sandbox testing once the
  supplier details are known — until then the webhook trusts any POST that
  passes Layer 2. (Tracked alongside the H2 webhook-HMAC security task.)

Idempotent: an already-`succeeded` order short-circuits (logged as
`webhook_duplicate_ignored`). Every raw notice is audit-logged to
`payment_events` before processing.

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

- `supabase/functions/create-payment/` (v4) — builds the Tranzila hosted-page
  URL, **recomputes the charge server-side from `SUM(orders.total)`** (ignores
  the client amount), **blocks payment until the design is approved**
  (`403 design_not_approved`), blocks already-paid, logs a `payment_events` row.
  Gated: returns 503 "payments_disabled" if `TRANZILA_SUPPLIER` is unset, and the
  client falls back to a "coming soon" modal. `SITE_URL` fallback =
  `https://www.sfalimshop.com`.
- `supabase/functions/tranzila-webhook/` (v2) — parses the callback, writes
  `payment_events`, enforces **Layer 2 amount verification** (see the Webhook
  payment integrity section above), and on a verified success flips `orders` to
  `payment_status='succeeded'` / `status='paid'` with `paid_at`, `amount_paid`,
  `tranzila_transaction_id`. **Layer 1 signature verification is still TODO**
  (sandbox).
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
6b. **Implement Layer-1 webhook signature verification** (`TRANZILA_WEBHOOK_SECRET`)
   using Tranzila's real mechanism — the main remaining payment-security TODO.
7. Flip `PAYMENTS_ENABLED = true`.
8. Flip `MAINTENANCE_MODE = false` **and** switch `index.html` robots tags to `index, follow`.
9. Swap sandbox → production `TRANZILA_SUPPLIER` / `TRANZILA_TK`.
10. **Arm the custom-design approval emails** (independent of Tranzila — can be
    done any time): create the `orders` UPDATE DB webhook with the
    `x-webhook-secret` header + set `DESIGN_NOTIFY_ENABLED="true"`. See the
    "Custom-design approval workflow" section above.
