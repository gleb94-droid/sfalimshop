# waitlist-welcome — BLOOM welcome email

Sends a branded welcome email (in the subscriber's language: he / en / ru) when
a new row is inserted into `public.waitlist`.

## Safety model

This function **cannot send a real email** until BOTH:

1. `WAITLIST_WELCOME_ENABLED = "true"` (master flag — default OFF), and
2. `RESEND_API_KEY` is set.

Until then it runs in **dry-run**: it logs what it *would* send and returns 200.
So you can deploy + wire the webhook with zero risk, and arm it later.

It also never emails a row whose `launch_notified_at` is already set.

## What Gleb needs to provide

| Item | Where | Notes |
|---|---|---|
| **Resend account** | https://resend.com | Free tier = 3,000 emails/mo, 100/day. Enough for a waitlist. |
| **Verified sender domain** | Resend → Domains → add `sfalimshop.com` | Add the DNS records Resend gives you (SPF/DKIM). Until verified, email lands in spam or is rejected. |
| **`RESEND_API_KEY`** | Resend → API Keys → create | Paste into Supabase secret (below). |

## Setup steps (once you have the above)

1. **Deploy** (safe — does not send):
   ```
   supabase functions deploy waitlist-welcome --no-verify-jwt
   ```

2. **Set secrets** (Supabase → Edge Functions → Secrets, or CLI):
   ```
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set WAITLIST_FROM="BLOOM <hello@sfalimshop.com>"
   supabase secrets set WAITLIST_WEBHOOK_SECRET=<any-random-string>
   # leave WAITLIST_WELCOME_ENABLED unset for now (stays in dry-run)
   ```

3. **Create the Database Webhook** (Supabase → Database → Webhooks):
   - Table: `waitlist`
   - Events: `INSERT` only
   - Type: HTTP Request → `POST`
   - URL: `https://ubvgrxlxtelulwjtfudd.supabase.co/functions/v1/waitlist-welcome`
   - HTTP header: `x-webhook-secret: <same random string as above>`

4. **Test in dry-run**: add a test row to `waitlist`, then check the function
   logs (Supabase → Edge Functions → waitlist-welcome → Logs). You should see
   `[dry-run] would send ...`. No email is sent.

5. **Arm it** (only when you're happy):
   ```
   supabase secrets set WAITLIST_WELCOME_ENABLED=true
   ```
   Send yourself a test signup first to confirm the real email looks right.

## Env vars

| Var | Required | Default | Purpose |
|---|---|---|---|
| `RESEND_API_KEY` | to send | — | Resend API key |
| `WAITLIST_WELCOME_ENABLED` | to send | (off) | `"true"` arms real sending |
| `WAITLIST_FROM` | no | `BLOOM <hello@sfalimshop.com>` | From address (domain must be verified in Resend) |
| `WAITLIST_WEBHOOK_SECRET` | recommended | — | If set, requires matching `x-webhook-secret` header |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | — | auto | Injected by Supabase runtime (not used to send, reserved) |
