
-- 1) reports: drop permissive UPDATE/DELETE policies (admin/moderator policies already exist)
DROP POLICY IF EXISTS "Authenticated can update reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated can delete reports" ON public.reports;

-- 2) missing_persons: replace permissive UPDATE/DELETE with admin/moderator-only
DROP POLICY IF EXISTS "Authenticated update missing" ON public.missing_persons;
DROP POLICY IF EXISTS "Authenticated delete missing" ON public.missing_persons;
CREATE POLICY "Admins update missing"
ON public.missing_persons
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins delete missing"
ON public.missing_persons
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- 3) missing_persons: hide contact_* and report_date-internal fields from anon via column grants.
-- Authenticated users (signed-in helpers / admins) keep full access via existing grants.
REVOKE SELECT ON public.missing_persons FROM anon;
GRANT SELECT (
  id, name, age, description,
  last_seen_location, state, municipality, parish,
  last_seen_lat, last_seen_lng,
  photo_url, status, report_date, found_date,
  source_id, source_label, source_url,
  created_at, updated_at
) ON public.missing_persons TO anon;

-- 4) report_votes: remove direct UPDATE/DELETE table policies; route mutations through a SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "Anyone can update own vote" ON public.report_votes;
DROP POLICY IF EXISTS "Anyone can remove own vote" ON public.report_votes;

CREATE OR REPLACE FUNCTION public.cast_report_vote(p_report_id uuid, p_device_id text, p_vote text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_device_id IS NULL OR length(p_device_id) < 8 OR length(p_device_id) > 128 THEN
    RAISE EXCEPTION 'invalid device_id';
  END IF;
  IF p_vote NOT IN ('confirm','dispute','none') THEN
    RAISE EXCEPTION 'invalid vote';
  END IF;
  IF p_vote = 'none' THEN
    DELETE FROM public.report_votes WHERE report_id = p_report_id AND device_id = p_device_id;
  ELSE
    INSERT INTO public.report_votes (report_id, device_id, vote)
    VALUES (p_report_id, p_device_id, p_vote)
    ON CONFLICT (report_id, device_id) DO UPDATE
      SET vote = EXCLUDED.vote, updated_at = now();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cast_report_vote(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_report_vote(uuid, text, text) TO anon, authenticated;

-- 5) storage report-media: add admin/moderator UPDATE & DELETE policies so private bucket can be maintained.
-- INSERT and SELECT policies already exist for anon/authenticated.
DROP POLICY IF EXISTS "report-media admin update" ON storage.objects;
DROP POLICY IF EXISTS "report-media admin delete" ON storage.objects;
CREATE POLICY "report-media admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'report-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')))
WITH CHECK (bucket_id = 'report-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')));
CREATE POLICY "report-media admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'report-media' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')));

-- 6) telegram_sessions: explicitly lock down to service_role only (currently unused; webhook uses in-memory sessions).
REVOKE ALL ON public.telegram_sessions FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.telegram_sessions TO service_role;
