-- Admin de Interoperabilidad
-- Aplicar en PROD (proyecto NUEVO advebubtfjgxwpjxprok) con:
--   psql "$NEW_SUPABASE_DB_URL" -f sql/2026-06-27_admin_interop.sql

BEGIN;

-- ============================================================
-- 1) match_dismissals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.match_dismissals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  missing_id    uuid NOT NULL,
  patient_id    uuid NOT NULL,
  dismissed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (missing_id, patient_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_dismissals TO authenticated;
GRANT ALL ON public.match_dismissals TO service_role;
ALTER TABLE public.match_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mods read dismissals" ON public.match_dismissals;
CREATE POLICY "mods read dismissals" ON public.match_dismissals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
DROP POLICY IF EXISTS "mods write dismissals" ON public.match_dismissals;
CREATE POLICY "mods write dismissals" ON public.match_dismissals
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- ============================================================
-- 2) dedupe_whitelist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dedupe_whitelist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id        uuid NOT NULL,
  b_id        uuid NOT NULL,
  decided_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (a_id < b_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS dedupe_whitelist_pair_uniq
  ON public.dedupe_whitelist (a_id, b_id);
GRANT SELECT, INSERT, DELETE ON public.dedupe_whitelist TO authenticated;
GRANT ALL ON public.dedupe_whitelist TO service_role;
ALTER TABLE public.dedupe_whitelist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mods manage whitelist" ON public.dedupe_whitelist;
CREATE POLICY "mods manage whitelist" ON public.dedupe_whitelist
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- ============================================================
-- 3) merge_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.merge_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id      uuid NOT NULL,
  loser_id       uuid NOT NULL,
  merged_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload_loser  jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.merge_log TO authenticated;
GRANT ALL ON public.merge_log TO service_role;
ALTER TABLE public.merge_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mods read merge log" ON public.merge_log;
CREATE POLICY "mods read merge log" ON public.merge_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- ============================================================
-- 4) missing_status_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.missing_status_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  missing_id   uuid NOT NULL,
  prev_status  text,
  new_status   text,
  changed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.missing_status_log TO authenticated;
GRANT ALL ON public.missing_status_log TO service_role;
ALTER TABLE public.missing_status_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mods read status log" ON public.missing_status_log;
CREATE POLICY "mods read status log" ON public.missing_status_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- ============================================================
-- 5) RPC: mark_missing_found(p_id, p_note)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_missing_found(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;
  SELECT status INTO prev FROM public.missing_persons WHERE id = p_id;
  IF prev IS NULL THEN RAISE EXCEPTION 'missing_person not found'; END IF;
  UPDATE public.missing_persons
     SET status='found', found_date=COALESCE(found_date, now())
   WHERE id = p_id;
  INSERT INTO public.missing_status_log (missing_id, prev_status, new_status, changed_by, note)
  VALUES (p_id, prev, 'found', uid, p_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_missing_found(uuid, text) TO authenticated;

-- ============================================================
-- 6) RPC: merge_missing_persons(winner_id, loser_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_missing_persons(p_winner_id uuid, p_loser_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  loser public.missing_persons%ROWTYPE;
  winner public.missing_persons%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;
  IF p_winner_id = p_loser_id THEN RAISE EXCEPTION 'winner and loser must differ'; END IF;

  SELECT * INTO loser  FROM public.missing_persons WHERE id = p_loser_id  FOR UPDATE;
  SELECT * INTO winner FROM public.missing_persons WHERE id = p_winner_id FOR UPDATE;
  IF loser.id IS NULL OR winner.id IS NULL THEN RAISE EXCEPTION 'records not found'; END IF;

  INSERT INTO public.merge_log (winner_id, loser_id, merged_by, payload_loser)
  VALUES (p_winner_id, p_loser_id, uid, to_jsonb(loser));

  UPDATE public.missing_persons SET
    age                = COALESCE(age, loser.age),
    description        = COALESCE(description, loser.description),
    last_seen_location = COALESCE(last_seen_location, loser.last_seen_location),
    state              = COALESCE(state, loser.state),
    municipality       = COALESCE(municipality, loser.municipality),
    parish             = COALESCE(parish, loser.parish),
    last_seen_lat      = COALESCE(last_seen_lat, loser.last_seen_lat),
    last_seen_lng      = COALESCE(last_seen_lng, loser.last_seen_lng),
    photo_url          = COALESCE(photo_url, loser.photo_url),
    contact_name       = COALESCE(contact_name, loser.contact_name),
    contact_phone      = COALESCE(contact_phone, loser.contact_phone),
    contact_email      = COALESCE(contact_email, loser.contact_email),
    found_date         = COALESCE(found_date, loser.found_date),
    status             = CASE WHEN winner.status='missing' AND loser.status='found'
                              THEN 'found' ELSE winner.status END,
    matched_patient_id = COALESCE(matched_patient_id, loser.matched_patient_id),
    updated_at         = now()
   WHERE id = p_winner_id;

  UPDATE public.patients
     SET matched_missing_id = p_winner_id
   WHERE matched_missing_id = p_loser_id;

  DELETE FROM public.missing_persons WHERE id = p_loser_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.merge_missing_persons(uuid, uuid) TO authenticated;

-- ============================================================
-- 7) RPC: find_duplicate_candidates(p_since, p_limit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_duplicate_candidates(
  p_since timestamptz DEFAULT (now() - interval '30 days'),
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  a_id uuid, b_id uuid,
  a_name text, b_name text,
  a_age int, b_age int,
  a_location text, b_location text,
  a_source text, b_source text,
  a_photo text, b_photo text,
  a_status text, b_status text,
  name_sim real, loc_sim real
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT * FROM public.missing_persons WHERE created_at >= p_since
  )
  SELECT
    LEAST(a.id, b.id)    AS a_id,
    GREATEST(a.id, b.id) AS b_id,
    a.name, b.name,
    a.age,  b.age,
    a.last_seen_location, b.last_seen_location,
    a.source_label, b.source_label,
    a.photo_url, b.photo_url,
    a.status, b.status,
    similarity(lower(a.name), lower(b.name))::real AS name_sim,
    COALESCE(similarity(lower(a.last_seen_location), lower(b.last_seen_location)),0)::real AS loc_sim
  FROM recent a
  JOIN public.missing_persons b
    ON b.id > a.id
   AND lower(a.name) % lower(b.name)
   AND (a.age IS NULL OR b.age IS NULL OR abs(a.age - b.age) <= 2)
  WHERE similarity(lower(a.name), lower(b.name)) >= 0.55
    AND COALESCE(similarity(lower(a.last_seen_location), lower(b.last_seen_location)),1) >= 0.40
    AND NOT EXISTS (
      SELECT 1 FROM public.dedupe_whitelist w
      WHERE w.a_id = LEAST(a.id,b.id) AND w.b_id = GREATEST(a.id,b.id)
    )
  ORDER BY name_sim DESC
  LIMIT p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.find_duplicate_candidates(timestamptz, int) TO authenticated;

-- ============================================================
-- 8) RPC: interop_source_overview()
-- ============================================================
CREATE OR REPLACE FUNCTION public.interop_source_overview()
RETURNS TABLE (
  kind text, source_label text, total bigint,
  with_photo bigint, with_coords bigint, matched bigint,
  found bigint, last_created timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'missing'::text, COALESCE(source_label,'(sin fuente)')::text,
         COUNT(*)::bigint,
         COUNT(*) FILTER (WHERE photo_url IS NOT NULL)::bigint,
         COUNT(*) FILTER (
           WHERE last_seen_lat BETWEEN -1 AND 14
             AND last_seen_lng BETWEEN -74 AND -59
         )::bigint,
         COUNT(*) FILTER (WHERE matched_patient_id IS NOT NULL)::bigint,
         COUNT(*) FILTER (WHERE status='found')::bigint,
         MAX(created_at)
    FROM public.missing_persons
   GROUP BY COALESCE(source_label,'(sin fuente)')
  UNION ALL
  SELECT 'patient'::text, COALESCE(source_label,'(sin fuente)')::text,
         COUNT(*)::bigint,
         COUNT(*) FILTER (WHERE photo_url IS NOT NULL)::bigint,
         0::bigint,
         COUNT(*) FILTER (WHERE matched_missing_id IS NOT NULL)::bigint,
         COUNT(*) FILTER (WHERE status IN ('discharged','reunited'))::bigint,
         MAX(created_at)
    FROM public.patients
   GROUP BY COALESCE(source_label,'(sin fuente)')
  ORDER BY 1, 3 DESC;
$$;
GRANT EXECUTE ON FUNCTION public.interop_source_overview() TO authenticated;

COMMIT;
