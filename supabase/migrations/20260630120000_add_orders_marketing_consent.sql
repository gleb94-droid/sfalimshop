-- Marketing consent checkbox (Amendment 40 / IL anti-spam compliance).
-- Customers must explicitly opt in (unchecked by default) before we can
-- send them marketing email/SMS. Automated reminders are illegal without this.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;
