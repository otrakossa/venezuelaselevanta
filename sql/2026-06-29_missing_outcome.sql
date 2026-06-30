-- Sub-estados ("outcome") para personas encontradas.
-- - outcome distingue cómo apareció: at_health_center, with_family,
--   relocated, deceased, other.
-- - Mantiene status (missing|found|deceased) sin romper filtros existentes.
-- - Toda transición queda registrada en missing_status_log.
--
-- Aplicar:
--   psql "$NEW_SUPABASE_DB_URL" -f sql/2026-06-29_missing_outcome.sql

BEGIN;

-- ============================================================
-- 1) Columnas nuevas
-- ============================================================
ALTER TABLE public.missing_persons
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_note text,
  ADD COLUMN IF NOT EXISTS outcome_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS outcome_set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- CHECK como NOT VALID + VALIDATE para datasets grandes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'missing_persons_outcome_check'
  ) THEN
    ALTER TABLE public.missing_persons
      ADD CONSTRAINT missing_persons_outcome_check
      CHECK (outcome IN ('at_health_center','with_family','relocated','deceased','other'))
      NOT VALID;
    ALTER TABLE public.missing_persons
      VALIDATE CONSTRAINT missing_persons_outcome_check;
  END IF;
END $$;

ALTER TABLE public.missing_status_log
  ADD COLUMN IF NOT EXISTS prev_outcome text,
  ADD COLUMN IF NOT EXISTS new_outcome  text;

-- Grants para nuevas columnas (PostgREST sólo expone columnas con grant)
GRANT SELECT (outcome, outcome_note, outcome_set_at) ON public.missing_persons TO anon;
GRANT SELECT (outcome, outcome_note, outcome_set_at) ON public.missing_persons TO authenticated;

-- ============================================================
-- 2) Backfill
-- ============================================================
UPDATE public.missing_persons mp
   SET outcome = 'at_health_center',
       outcome_note = COALESCE(mp.outcome_note, p.center_name),
       outcome_set_at = COALESCE(mp.outcome_set_at, mp.matched_at, mp.found_date, now())
  FROM public.patients p
 WHERE mp.matched_patient_id = p.id
   AND mp.outcome IS NULL;

UPDATE public.missing_persons
   SET outcome = 'deceased',
       outcome_set_at = COALESCE(outcome_set_at, found_date, updated_at)
 WHERE status = 'deceased' AND outcome IS NULL;

-- ============================================================
-- 3) Voto público — acepta outcome opcional
-- ============================================================
DROP FUNCTION IF EXISTS public.mark_missing_person_found(uuid, text);
DROP FUNCTION IF EXISTS public.mark_missing_person_found(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.mark_missing_person_found(
  _person_id uuid,
  _device_id text,
  _outcome   text DEFAULT NULL,
  _note      text DEFAULT NULL
)
RETURNS TABLE(found_marks integer, status text, outcome text, outcome_note text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted     boolean := false;
  prev_status  text;
  prev_outcome text;
  effective_outcome text := NULLIF(_outcome, '');
  effective_note    text := NULLIF(_note, '');
BEGIN
  IF _device_id IS NULL OR length(_device_id) < 8 OR length(_device_id) > 128 THEN
    RAISE EXCEPTION 'invalid device_id';
  END IF;

  IF effective_outcome IS NOT NULL
     AND effective_outcome NOT IN ('at_health_center','with_family','relocated','other') THEN
    -- "deceased" requiere flujo de moderador, no voto público
    RAISE EXCEPTION 'invalid outcome';
  END IF;

  INSERT INTO public.missing_person_found_votes (missing_person_id, device_id)
  VALUES (_person_id, _device_id)
  ON CONFLICT (missing_person_id, device_id) DO NOTHING
  RETURNING true INTO inserted;

  SELECT mp.status, mp.outcome
    INTO prev_status, prev_outcome
    FROM public.missing_persons mp
   WHERE mp.id = _person_id
   FOR UPDATE;

  IF prev_status IS NULL THEN
    RAISE EXCEPTION 'missing_person not found';
  END IF;

  IF inserted THEN
    UPDATE public.missing_persons AS mp
       SET found_marks = COALESCE(mp.found_marks, 0) + 1,
           status      = 'found',
           found_date  = COALESCE(mp.found_date, now()),
           outcome     = COALESCE(effective_outcome, mp.outcome),
           outcome_note = COALESCE(effective_note, mp.outcome_note),
           outcome_set_at = CASE
             WHEN effective_outcome IS NOT NULL AND mp.outcome IS DISTINCT FROM effective_outcome
               THEN now()
             ELSE mp.outcome_set_at
           END
     WHERE mp.id = _person_id;

    IF prev_status <> 'found' OR (effective_outcome IS NOT NULL AND prev_outcome IS DISTINCT FROM effective_outcome) THEN
      INSERT INTO public.missing_status_log
        (missing_id, prev_status, new_status, prev_outcome, new_outcome, changed_by, note)
      VALUES
        (_person_id, prev_status, 'found', prev_outcome,
         COALESCE(effective_outcome, prev_outcome),
         NULL,
         'vote:' || left(_device_id, 8) || COALESCE(' | ' || effective_note, ''));
    END IF;
  ELSIF effective_outcome IS NOT NULL AND prev_outcome IS DISTINCT FROM effective_outcome THEN
    -- Re-voto que aporta outcome nuevo: sólo actualiza outcome (no incrementa marks)
    UPDATE public.missing_persons AS mp
       SET outcome = effective_outcome,
           outcome_note = COALESCE(effective_note, mp.outcome_note),
           outcome_set_at = now()
     WHERE mp.id = _person_id;
    INSERT INTO public.missing_status_log
      (missing_id, prev_status, new_status, prev_outcome, new_outcome, changed_by, note)
    VALUES
      (_person_id, prev_status, prev_status, prev_outcome, effective_outcome, NULL,
       'vote-outcome:' || left(_device_id, 8) || COALESCE(' | ' || effective_note, ''));
  END IF;

  RETURN QUERY
    SELECT mp.found_marks, mp.status::text, mp.outcome, mp.outcome_note
      FROM public.missing_persons mp
     WHERE mp.id = _person_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_missing_person_found(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_missing_person_found(uuid, text, text, text) TO anon, authenticated;

-- ============================================================
-- 4) Match con paciente — setea outcome=at_health_center
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_missing_to_patient(p_missing_id uuid, p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev_status  text;
  prev_outcome text;
  ctr_name     text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  SELECT status, outcome INTO prev_status, prev_outcome
    FROM public.missing_persons WHERE id = p_missing_id FOR UPDATE;
  IF prev_status IS NULL THEN RAISE EXCEPTION 'missing_person not found'; END IF;

  SELECT center_name INTO ctr_name FROM public.patients WHERE id = p_patient_id;

  UPDATE public.patients
     SET matched_missing_id = NULL
   WHERE matched_missing_id = p_missing_id AND id <> p_patient_id;

  UPDATE public.missing_persons
     SET matched_patient_id = NULL, matched_at = NULL, matched_by = NULL
   WHERE matched_patient_id = p_patient_id AND id <> p_missing_id;

  UPDATE public.missing_persons
     SET matched_patient_id = p_patient_id,
         matched_at = now(),
         matched_by = uid,
         status = 'found',
         found_date = COALESCE(found_date, now()),
         outcome = 'at_health_center',
         outcome_note = COALESCE(outcome_note, ctr_name),
         outcome_set_at = now(),
         outcome_set_by = uid
   WHERE id = p_missing_id;

  UPDATE public.patients SET matched_missing_id = p_missing_id WHERE id = p_patient_id;

  IF prev_status <> 'found' OR prev_outcome IS DISTINCT FROM 'at_health_center' THEN
    INSERT INTO public.missing_status_log
      (missing_id, prev_status, new_status, prev_outcome, new_outcome, changed_by, note)
    VALUES
      (p_missing_id, prev_status, 'found', prev_outcome, 'at_health_center', uid,
       'match:patient:' || p_patient_id::text || COALESCE(' | ' || ctr_name, ''));
  END IF;
END;
$$;

-- unlink ya existe; lo extendemos para limpiar outcome
CREATE OR REPLACE FUNCTION public.unlink_missing_patient(p_missing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev_patient uuid;
  prev_status text;
  prev_outcome text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  SELECT matched_patient_id, status, outcome
    INTO prev_patient, prev_status, prev_outcome
    FROM public.missing_persons WHERE id = p_missing_id FOR UPDATE;

  UPDATE public.missing_persons
     SET matched_patient_id = NULL,
         matched_at = NULL,
         matched_by = NULL,
         status = 'missing',
         found_date = NULL,
         outcome = NULL,
         outcome_note = NULL,
         outcome_set_at = NULL,
         outcome_set_by = NULL
   WHERE id = p_missing_id;

  IF prev_patient IS NOT NULL THEN
    UPDATE public.patients SET matched_missing_id = NULL WHERE id = prev_patient;
  END IF;

  IF prev_status = 'found' THEN
    INSERT INTO public.missing_status_log
      (missing_id, prev_status, new_status, prev_outcome, new_outcome, changed_by, note)
    VALUES
      (p_missing_id, prev_status, 'missing', prev_outcome, NULL, uid,
       'unlink:patient:' || COALESCE(prev_patient::text, 'none'));
  END IF;
END;
$$;

-- ============================================================
-- 5) Admin/moderador — found con outcome arbitrario + deceased
-- ============================================================
DROP FUNCTION IF EXISTS public.mark_missing_found(uuid, text);
DROP FUNCTION IF EXISTS public.mark_missing_found(uuid, text, text);

CREATE OR REPLACE FUNCTION public.mark_missing_found(
  p_id      uuid,
  p_outcome text DEFAULT NULL,
  p_note    text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev_status  text;
  prev_outcome text;
  eff_outcome  text := NULLIF(p_outcome,'');
  eff_note     text := NULLIF(p_note,'');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  IF eff_outcome IS NOT NULL
     AND eff_outcome NOT IN ('at_health_center','with_family','relocated','other') THEN
    RAISE EXCEPTION 'invalid outcome (use mark_missing_deceased for deceased)';
  END IF;

  SELECT status, outcome INTO prev_status, prev_outcome
    FROM public.missing_persons WHERE id = p_id FOR UPDATE;
  IF prev_status IS NULL THEN RAISE EXCEPTION 'missing_person not found'; END IF;

  UPDATE public.missing_persons
     SET status = 'found',
         found_date = COALESCE(found_date, now()),
         outcome = COALESCE(eff_outcome, outcome),
         outcome_note = COALESCE(eff_note, outcome_note),
         outcome_set_at = CASE
           WHEN eff_outcome IS NOT NULL AND outcome IS DISTINCT FROM eff_outcome
             THEN now() ELSE outcome_set_at END,
         outcome_set_by = CASE
           WHEN eff_outcome IS NOT NULL AND outcome IS DISTINCT FROM eff_outcome
             THEN uid ELSE outcome_set_by END
   WHERE id = p_id;

  INSERT INTO public.missing_status_log
    (missing_id, prev_status, new_status, prev_outcome, new_outcome, changed_by, note)
  VALUES
    (p_id, prev_status, 'found', prev_outcome,
     COALESCE(eff_outcome, prev_outcome), uid, eff_note);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_missing_found(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_missing_deceased(
  p_id   uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev_status  text;
  prev_outcome text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  SELECT status, outcome INTO prev_status, prev_outcome
    FROM public.missing_persons WHERE id = p_id FOR UPDATE;
  IF prev_status IS NULL THEN RAISE EXCEPTION 'missing_person not found'; END IF;

  UPDATE public.missing_persons
     SET status = 'deceased',
         outcome = 'deceased',
         outcome_note = COALESCE(NULLIF(p_note,''), outcome_note),
         outcome_set_at = now(),
         outcome_set_by = uid,
         found_date = COALESCE(found_date, now())
   WHERE id = p_id;

  INSERT INTO public.missing_status_log
    (missing_id, prev_status, new_status, prev_outcome, new_outcome, changed_by, note)
  VALUES
    (p_id, prev_status, 'deceased', prev_outcome, 'deceased', uid, NULLIF(p_note,''));
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_missing_deceased(uuid, text) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
