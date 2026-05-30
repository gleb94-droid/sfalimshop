-- Task 8: optional per-line pet-name personalization.
-- A nullable text column on orders. Customer-supplied, optional, trimmed,
-- shown prominently in the admin order view so Gleb can print it in-house.
--
-- No RLS/grant changes needed: the orders INSERT policy is row-level only
-- (auth.uid() = user_id OR user_id IS NULL) and column privileges are
-- table-wide for anon/authenticated, so a new column inherits them.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pet_name text;

COMMENT ON COLUMN public.orders.pet_name IS
  'Optional customer pet name for BLOOM personalization (Task 8). NULL = none.';
