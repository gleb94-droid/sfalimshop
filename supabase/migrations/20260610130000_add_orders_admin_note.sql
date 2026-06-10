-- Admin cockpit: a free-text internal note per order (e.g. "waiting for photos",
-- "printed", "packed & shipped"). Admin-only — surfaced in the order card in the
-- admin dashboard (OrderNote component), never shown to the customer.
--
-- Additive and safe: not a payment/approval field, so it is intentionally NOT
-- frozen by protect_order_payment_fields(). Admins (is_admin()) are exempt from
-- that trigger anyway, so the dashboard write is allowed; the customer UI never
-- exposes this column.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_note text;
