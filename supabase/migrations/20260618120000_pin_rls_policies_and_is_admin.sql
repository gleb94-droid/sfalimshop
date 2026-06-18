-- ============================================================================
-- Pin the LIVE RLS policies + is_admin() into version control (DR / repo parity)
-- ----------------------------------------------------------------------------
-- WHY: the row-level-security policies and the is_admin() helper were created
-- directly in the Supabase dashboard and were NOT in the repo. A database reset
-- or fresh-environment rebuild would have recreated the tables with NO row-level
-- protection. This migration captures the current production policies EXACTLY as
-- they are live (verified 2026-06-18 via pg_policies / pg_get_functiondef) so a
-- reset can't regress to an unprotected state.
--
-- SAFE + IDEMPOTENT: every policy is DROP ... IF EXISTS then re-created, and the
-- function uses CREATE OR REPLACE, so this can run on a fresh DB or re-run safely.
-- It is NOT applied to the live production DB by hand (the live policies are
-- already correct) — it exists so repo == production.
--
-- Also re-asserts the admins-table write REVOKE (security hardening 2026-06-18:
-- removed INSERT/UPDATE/DELETE/TRUNCATE from anon/authenticated — RLS already
-- default-denied them, this removes the underlying GRANT landmine too).
-- ============================================================================

-- ── is_admin() helper ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid());
$function$;

-- ── admins ─────────────────────────────────────────────────────────────────
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admins FROM anon, authenticated;
DROP POLICY IF EXISTS "Read own admin status" ON public.admins;
CREATE POLICY "Read own admin status" ON public.admins
  FOR SELECT TO public
  USING (id = (SELECT auth.uid()));

-- ── assistant_logs ─────────────────────────────────────────────────────────
ALTER TABLE public.assistant_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assistant_logs admin read" ON public.assistant_logs;
CREATE POLICY "assistant_logs admin read" ON public.assistant_logs
  FOR SELECT TO public
  USING (is_admin());

-- ── blog_posts ─────────────────────────────────────────────────────────────
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_full_access" ON public.blog_posts;
CREATE POLICY "admin_full_access" ON public.blog_posts
  FOR ALL TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));
DROP POLICY IF EXISTS "public_read_published" ON public.blog_posts;
CREATE POLICY "public_read_published" ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (status = 'published'::text);

-- ── order_status_history ───────────────────────────────────────────────────
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage status history" ON public.order_status_history;
CREATE POLICY "Admins manage status history" ON public.order_status_history
  FOR ALL TO public
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));
DROP POLICY IF EXISTS "Users read own status history" ON public.order_status_history;
CREATE POLICY "Users read own status history" ON public.order_status_history
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_status_history.order_id
      AND (orders.user_id = (SELECT auth.uid()) OR (SELECT is_admin()))
  ));

-- ── orders ─────────────────────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders" ON public.orders
  FOR DELETE TO public
  USING ((SELECT is_admin()));
DROP POLICY IF EXISTS "Anon read recent guest order" ON public.orders;
CREATE POLICY "Anon read recent guest order" ON public.orders
  FOR SELECT TO anon
  USING (user_id IS NULL AND created_at > (now() - '00:02:00'::interval));
DROP POLICY IF EXISTS "Insert orders" ON public.orders;
CREATE POLICY "Insert orders" ON public.orders
  FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "Users read own orders" ON public.orders;
CREATE POLICY "Users read own orders" ON public.orders
  FOR SELECT TO public
  USING (
    (SELECT auth.uid()) = user_id
    OR lower(customer_email) = lower(((SELECT auth.jwt()) ->> 'email'::text))
    OR (SELECT is_admin())
  );
DROP POLICY IF EXISTS "Users update own orders" ON public.orders;
CREATE POLICY "Users update own orders" ON public.orders
  FOR UPDATE TO public
  USING ((SELECT auth.uid()) = user_id OR (SELECT is_admin()))
  WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT is_admin()));

-- ── payment_events ─────────────────────────────────────────────────────────
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all payment events" ON public.payment_events;
CREATE POLICY "Admins can view all payment events" ON public.payment_events
  FOR SELECT TO authenticated
  USING ((SELECT is_admin()));
DROP POLICY IF EXISTS "Users can view own payment events" ON public.payment_events;
CREATE POLICY "Users can view own payment events" ON public.payment_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = payment_events.order_id
      AND orders.user_id = (SELECT auth.uid())
  ));

-- ── pet_designs ────────────────────────────────────────────────────────────
ALTER TABLE public.pet_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read all pet designs" ON public.pet_designs;
CREATE POLICY "Admin read all pet designs" ON public.pet_designs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Admin write pet designs" ON public.pet_designs;
CREATE POLICY "Admin write pet designs" ON public.pet_designs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Public read active pet designs" ON public.pet_designs;
CREATE POLICY "Public read active pet designs" ON public.pet_designs
  FOR SELECT TO public
  USING (is_active = true);

-- ── sticker_packs ──────────────────────────────────────────────────────────
ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read all sticker packs" ON public.sticker_packs;
CREATE POLICY "Admin read all sticker packs" ON public.sticker_packs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Admin write sticker packs" ON public.sticker_packs;
CREATE POLICY "Admin write sticker packs" ON public.sticker_packs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = (SELECT auth.uid())));
DROP POLICY IF EXISTS "Public read active sticker packs" ON public.sticker_packs;
CREATE POLICY "Public read active sticker packs" ON public.sticker_packs
  FOR SELECT TO public
  USING (is_active = true);

-- ── testimonials ───────────────────────────────────────────────────────────
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage testimonials" ON public.testimonials;
CREATE POLICY "admin manage testimonials" ON public.testimonials
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
DROP POLICY IF EXISTS "read active testimonials" ON public.testimonials;
CREATE POLICY "read active testimonials" ON public.testimonials
  FOR SELECT TO public
  USING (is_active = true);

-- ── waitlist ───────────────────────────────────────────────────────────────
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins delete waitlist" ON public.waitlist;
CREATE POLICY "Admins delete waitlist" ON public.waitlist
  FOR DELETE TO authenticated
  USING ((SELECT is_admin()));
DROP POLICY IF EXISTS "Admins read waitlist" ON public.waitlist;
CREATE POLICY "Admins read waitlist" ON public.waitlist
  FOR SELECT TO authenticated
  USING ((SELECT is_admin()));
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (consent = true AND launch_notified_at IS NULL);
