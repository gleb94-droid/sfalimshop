-- Anonymized question log for the on-site AI assistant.
-- Lets the owner see what customers ask (insight for FAQ/products) and powers a
-- lightweight per-visitor rate limit. No PII: the visitor is identified only by a
-- salted hash of their IP, never the raw IP or any name/email.
--
-- RLS: admin-read only. The edge function writes with the service-role key (which
-- bypasses RLS), so there are intentionally NO public insert/select policies.

create table if not exists public.assistant_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lang        text,
  page        text,
  role        text,                -- 'user' (we log the user's message only)
  message     text,
  ip_hash     text                 -- salted SHA-256 of the client IP (rate limit / abuse only)
);

create index if not exists assistant_logs_created_at_idx on public.assistant_logs (created_at desc);
create index if not exists assistant_logs_ip_recent_idx  on public.assistant_logs (ip_hash, created_at desc);

alter table public.assistant_logs enable row level security;

-- Admin can read the log in the dashboard. is_admin() is the project's existing helper.
drop policy if exists "assistant_logs admin read" on public.assistant_logs;
create policy "assistant_logs admin read" on public.assistant_logs
  for select using (is_admin());

-- No INSERT/UPDATE/DELETE policies → only the service role (edge function) can write.
