
-- ============================================================
-- 1. TABLA: cola de candidatos a duplicado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.missing_dedupe_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id uuid NOT NULL REFERENCES public.missing_persons(id) ON DELETE CASCADE,
  duplicate_id uuid NOT NULL REFERENCES public.missing_persons(id) ON DELETE CASCADE,
  score        real NOT NULL,
  reason       text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','auto_merged','confirmed','dismissed')),
  reviewed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mdq_distinct CHECK (canonical_id <> duplicate_id),
  CONSTRAINT mdq_unique_pair UNIQUE (canonical_id, duplicate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.missing_dedupe_queue TO authenticated;
GRANT ALL ON public.missing_dedupe_queue TO service_role;

ALTER TABLE public.missing_dedupe_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_mod_read_dedupe_queue"
  ON public.missing_dedupe_queue FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE POLICY "admin_mod_update_dedupe_queue"
  ON public.missing_dedupe_queue FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX IF NOT EXISTS idx_mdq_status ON public.missing_dedupe_queue(status, created_at DESC);

-- ============================================================
-- 2. TABLA: auditoría de fusiones (hard-delete, así que guardamos snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.missing_merge_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id      uuid NOT NULL,
  deleted_id        uuid NOT NULL,
  score             real,
  reason            text,
  deleted_snapshot  jsonb NOT NULL,
  moved_comments    integer NOT NULL DEFAULT 0,
  moved_found_votes integer NOT NULL DEFAULT 0,
  merged_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  merged_at         timestamptz NOT NULL DEFAULT now(),
  auto              boolean NOT NULL DEFAULT false
);

GRANT SELECT, INSERT ON public.missing_merge_log TO authenticated;
GRANT ALL ON public.missing_merge_log TO service_role;

ALTER TABLE public.missing_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_mod_read_merge_log"
  ON public.missing_merge_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

CREATE INDEX IF NOT EXISTS idx_mml_merged_at ON public.missing_merge_log(merged_at DESC);
CREATE INDEX IF NOT EXISTS idx_mml_canonical ON public.missing_merge_log(canonical_id);

-- ============================================================
-- 3. FUNCIÓN: fusionar dos registros (hard-delete del duplicado)
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_missing_persons(
  p_canonical_id uuid,
  p_duplicate_id uuid,
  p_auto         boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  snapshot jsonb;
  cnt_comments integer := 0;
  cnt_votes    integer := 0;
  src_reason   text;
  src_score    real;
BEGIN
  -- Auto path skips role check (called from dedupe cron); manual requires admin/mod
  IF NOT p_auto THEN
    IF uid IS NULL THEN
      RAISE EXCEPTION 'not authenticated';
    END IF;
    IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
      RAISE EXCEPTION 'insufficient privileges';
    END IF;
  END IF;

  IF p_canonical_id = p_duplicate_id THEN
    RAISE EXCEPTION 'canonical and duplicate must differ';
  END IF;

  -- Snapshot of the row we're about to delete (for audit)
  SELECT to_jsonb(mp.*) INTO snapshot
    FROM public.missing_persons mp WHERE id = p_duplicate_id;
  IF snapshot IS NULL THEN
    RAISE EXCEPTION 'duplicate_id not found';
  END IF;

  -- Move comments (skip rows already pointing at canonical to avoid PK issues if any)
  UPDATE public.missing_person_comments
     SET missing_person_id = p_canonical_id
   WHERE missing_person_id = p_duplicate_id;
  GET DIAGNOSTICS cnt_comments = ROW_COUNT;

  -- Move found-votes; collapse votes from the same device if already present on canonical
  DELETE FROM public.missing_person_found_votes v
   WHERE v.missing_person_id = p_duplicate_id
     AND EXISTS (
       SELECT 1 FROM public.missing_person_found_votes vc
        WHERE vc.missing_person_id = p_canonical_id
          AND vc.device_id = v.device_id
     );

  UPDATE public.missing_person_found_votes
     SET missing_person_id = p_canonical_id
   WHERE missing_person_id = p_duplicate_id;
  GET DIAGNOSTICS cnt_votes = ROW_COUNT;

  -- Backfill canonical with non-empty fields from duplicate when canonical has them empty
  UPDATE public.missing_persons c SET
    photo_url           = COALESCE(NULLIF(c.photo_url, ''),           NULLIF(d.photo_url, '')),
    id_number           = COALESCE(NULLIF(c.id_number, ''),           NULLIF(d.id_number, '')),
    contact_phone       = COALESCE(NULLIF(c.contact_phone, ''),       NULLIF(d.contact_phone, '')),
    contact_name        = COALESCE(NULLIF(c.contact_name, ''),        NULLIF(d.contact_name, '')),
    description         = COALESCE(NULLIF(c.description, ''),         NULLIF(d.description, '')),
    last_seen_location  = COALESCE(NULLIF(c.last_seen_location, ''),  NULLIF(d.last_seen_location, '')),
    age                 = COALESCE(c.age, d.age),
    last_seen_lat       = COALESCE(c.last_seen_lat, d.last_seen_lat),
    last_seen_lng       = COALESCE(c.last_seen_lng, d.last_seen_lng),
    found_marks         = COALESCE(c.found_marks, 0) + COALESCE(d.found_marks, 0)
  FROM public.missing_persons d
  WHERE c.id = p_canonical_id AND d.id = p_duplicate_id;

  -- Pull reason/score from queue if present (for the audit row)
  SELECT q.reason, q.score INTO src_reason, src_score
    FROM public.missing_dedupe_queue q
   WHERE q.canonical_id = p_canonical_id AND q.duplicate_id = p_duplicate_id
   ORDER BY q.created_at DESC LIMIT 1;

  -- Audit BEFORE delete
  INSERT INTO public.missing_merge_log
    (canonical_id, deleted_id, score, reason, deleted_snapshot,
     moved_comments, moved_found_votes, merged_by, auto)
  VALUES
    (p_canonical_id, p_duplicate_id, src_score, src_reason, snapshot,
     cnt_comments, cnt_votes, uid, p_auto);

  -- Mark related queue rows as resolved (any pair touching the duplicate)
  UPDATE public.missing_dedupe_queue
     SET status = CASE WHEN p_auto THEN 'auto_merged' ELSE 'confirmed' END,
         reviewed_by = uid,
         reviewed_at = now()
   WHERE (canonical_id = p_canonical_id AND duplicate_id = p_duplicate_id)
      OR duplicate_id = p_duplicate_id;

  -- Hard delete duplicate
  DELETE FROM public.missing_persons WHERE id = p_duplicate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_missing_persons(uuid,uuid,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_missing_persons(uuid,uuid,boolean) TO authenticated, service_role;

-- ============================================================
-- 4. FUNCIÓN: detección + auto-merge para registros con score ≥ 0.95
-- ============================================================
CREATE OR REPLACE FUNCTION public.dedupe_missing_persons_run()
RETURNS TABLE(detected integer, auto_merged integer, queued integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_detected    integer := 0;
  v_auto_merged integer := 0;
  v_queued      integer := 0;
  pair RECORD;
BEGIN
  -- Build candidate pairs in a CTE
  CREATE TEMP TABLE IF NOT EXISTS _cands(
    canonical_id uuid, duplicate_id uuid, score real, reason text
  ) ON COMMIT DROP;
  TRUNCATE _cands;

  -- 4a. Exact id_number match (score 1.0)
  INSERT INTO _cands(canonical_id, duplicate_id, score, reason)
  SELECT a.id, b.id, 1.0::real, 'exact_id_number'
    FROM public.missing_persons a
    JOIN public.missing_persons b
      ON a.id < b.id
     AND a.id_number IS NOT NULL
     AND b.id_number IS NOT NULL
     AND length(a.id_number) >= 5
     AND a.id_number = b.id_number
   WHERE a.matched_patient_id IS NULL
     AND b.matched_patient_id IS NULL;

  -- 4b. Strong name+age+location match (score 0.85)
  -- Use trigram similarity and a tight age window. Limit to keep cost bounded.
  INSERT INTO _cands(canonical_id, duplicate_id, score, reason)
  SELECT a.id, b.id, 0.85::real, 'name_age_location'
    FROM public.missing_persons a
    JOIN public.missing_persons b
      ON a.id < b.id
     AND a.name % b.name
     AND similarity(a.name, b.name) >= 0.85
     AND (a.age IS NULL OR b.age IS NULL OR abs(a.age - b.age) <= 1)
     AND a.last_seen_location IS NOT NULL
     AND b.last_seen_location IS NOT NULL
     AND similarity(a.last_seen_location, b.last_seen_location) >= 0.6
   WHERE a.matched_patient_id IS NULL
     AND b.matched_patient_id IS NULL
     AND NOT EXISTS (SELECT 1 FROM _cands c WHERE c.canonical_id = a.id AND c.duplicate_id = b.id)
   LIMIT 5000;

  SELECT count(*) INTO v_detected FROM _cands;

  -- Insert into queue (ignore pairs already known)
  FOR pair IN SELECT * FROM _cands LOOP
    BEGIN
      INSERT INTO public.missing_dedupe_queue (canonical_id, duplicate_id, score, reason)
      VALUES (pair.canonical_id, pair.duplicate_id, pair.score, pair.reason);
      v_queued := v_queued + 1;
    EXCEPTION WHEN unique_violation THEN
      -- pair already in queue, skip
      NULL;
    END;

    -- Auto-merge when score is conservative-high (>= 0.95)
    IF pair.score >= 0.95 THEN
      BEGIN
        PERFORM public.merge_missing_persons(pair.canonical_id, pair.duplicate_id, true);
        v_auto_merged := v_auto_merged + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Don't abort the whole run if one merge fails (e.g. row already gone)
        NULL;
      END;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_detected, v_auto_merged, v_queued;
END;
$$;

REVOKE ALL ON FUNCTION public.dedupe_missing_persons_run() FROM public;
GRANT EXECUTE ON FUNCTION public.dedupe_missing_persons_run() TO authenticated, service_role;

-- ============================================================
-- 5. CRON: cada 8 horas
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('dedupe-missing-persons') 
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dedupe-missing-persons');
    PERFORM cron.schedule(
      'dedupe-missing-persons',
      '0 */8 * * *',
      $cron$ SELECT public.dedupe_missing_persons_run(); $cron$
    );
  END IF;
END $$;
