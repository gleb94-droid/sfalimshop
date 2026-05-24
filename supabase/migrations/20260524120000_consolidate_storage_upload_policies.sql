-- Consolidate redundant anon-INSERT policies on storage.objects.
--
-- Before this migration storage.objects had three overlapping policies that
-- allowed anonymous uploads into the "designs" bucket:
--   * "Allow public uploads"        (anon, authenticated) bucket_id = 'designs'
--   * "Anyone can upload designs"   (public)              bucket_id = 'designs'
--   * "allow uploads 11mhil1_0"     (anon, authenticated) bucket_id = 'DESIGNS' (typo, never matched)
--
-- This migration drops all three and replaces them with ONE clear policy that
-- allows anon + authenticated INSERT into the "designs" bucket only. Customer
-- uploads to "designs" must continue to work without login. Admin-scoped
-- policies for the "designs", "mockups" and "pet-designs" buckets are left
-- untouched. RLS stays enabled on storage.objects.
--
-- It also sets bucket-level file size and MIME limits on the "designs" and
-- "pet-designs" buckets (10 MB, png/jpeg/webp only).

DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload designs" ON storage.objects;
DROP POLICY IF EXISTS "allow uploads 11mhil1_0" ON storage.objects;

CREATE POLICY "Public upload to designs bucket"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'designs');

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id IN ('designs', 'pet-designs');
