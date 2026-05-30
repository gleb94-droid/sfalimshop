-- testimonials — customer reviews shown on the Home page (Reviews component in
-- App.jsx). The component was already built + gated to render only when active
-- rows exist; the table just hadn't been created, so the anon read 404'd. This
-- creates it so the read returns empty (200) and the section stays hidden until
-- reviews are added. Supersedes the standalone /testimonials.sql at repo root.
--
-- RLS: public reads active rows; admins manage (matches the project's
-- is_admin() convention). Add review rows via Supabase Studio or as an admin.
create table if not exists public.testimonials (
  id            uuid primary key default gen_random_uuid(),
  author_name   text not null,
  author_city   text,
  author_avatar text,
  rating        int not null check (rating between 1 and 5),
  body_he       text not null,
  body_en       text,
  body_ru       text,
  product       text,
  is_active     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.testimonials enable row level security;

drop policy if exists "read active testimonials" on public.testimonials;
create policy "read active testimonials" on public.testimonials
  for select using (is_active = true);

drop policy if exists "admin manage testimonials" on public.testimonials;
create policy "admin manage testimonials" on public.testimonials
  for all to authenticated using (is_admin()) with check (is_admin());

create index if not exists testimonials_active_sort_idx
  on public.testimonials (is_active, sort_order, created_at desc);

grant select on public.testimonials to anon, authenticated;
