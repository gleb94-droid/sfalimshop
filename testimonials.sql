-- ============================================================
-- testimonials — customer reviews shown on Home page
-- Run this once in Supabase Studio → SQL Editor.
-- After it runs, add real review rows manually (Studio → Table editor).
-- ============================================================

create table if not exists public.testimonials (
  id              uuid primary key default gen_random_uuid(),
  -- Display info. author_name is the Hebrew/default name; the *_en/*_ru columns
  -- are optional per-language overrides so the name localizes with the site
  -- language (e.g. אלה / Ella / Элла). If empty, the front-end falls back to author_name.
  author_name     text not null,                -- e.g. "מאיה ל'"  or "Maya L."
  author_name_en  text,                         -- optional English display name
  author_name_ru  text,                         -- optional Russian display name
  author_city     text,                         -- e.g. "תל אביב"  (optional, shown small)
  author_avatar   text,                         -- optional URL to a square avatar image
  rating          int  not null check (rating between 1 and 5),
  -- Trilingual review body. Hebrew is required; English/Russian fall back to Hebrew if empty.
  body_he         text not null,
  body_en         text,
  body_ru         text,
  -- Optional context — which product the review is about ("BLOOM Pixel", "ספל" …).
  -- `product` is the Hebrew/default; product_en/product_ru are optional per-language
  -- overrides. Standard catalog product names also auto-localize via localizeProduct().
  product         text,
  product_en      text,                         -- optional English product label
  product_ru      text,                         -- optional Russian product label
  -- Admin controls
  is_active       boolean not null default true,
  sort_order      int     not null default 0,
  created_at      timestamptz not null default now()
);

-- Public read access for active reviews (so the website can show them).
alter table public.testimonials enable row level security;

drop policy if exists "read active testimonials" on public.testimonials;
create policy "read active testimonials"
  on public.testimonials for select
  using (is_active = true);

-- Helpful index for the read query the front-end runs
create index if not exists testimonials_active_sort_idx
  on public.testimonials (is_active, sort_order, created_at desc);

-- ============================================================
-- How to add a review (example — do NOT run as-is, edit first):
-- ============================================================
-- insert into public.testimonials (author_name, author_city, rating, body_he, body_en, body_ru, product, sort_order)
-- values ('מאיה ל''', 'תל אביב', 5,
--         'איכות הדפסה מדהימה, הספל הגיע מהר ובאריזה יפה.',
--         'Amazing print quality, the mug arrived fast and beautifully packaged.',
--         'Потрясающее качество печати, кружка пришла быстро и красиво упакована.',
--         'ספל', 1);
