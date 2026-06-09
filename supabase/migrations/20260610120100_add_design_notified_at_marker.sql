-- Pre-launch audit fix (item 9): send-once marker for the notify-design-submission
-- edge function. The endpoint is client-callable and the order_group UUID is
-- client-readable, so this column lets the function email the admin at most ONCE
-- per order_group (kills the replay/spam → inbox/Resend-quota DoS vector) without
-- a client-held secret and without breaking the normal one-shot submit flow.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS design_notified_at timestamptz;
