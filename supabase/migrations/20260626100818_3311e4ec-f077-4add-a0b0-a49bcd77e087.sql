
-- 1) Link columns
ALTER TABLE public.missing_persons
  ADD COLUMN IF NOT EXISTS matched_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS matched_by uuid;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS matched_missing_id uuid REFERENCES public.missing_persons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS missing_persons_matched_patient_id_idx
  ON public.missing_persons(matched_patient_id);
CREATE INDEX IF NOT EXISTS patients_matched_missing_id_idx
  ON public.patients(matched_missing_id);

-- Trigram index on missing_persons.name for fuzzy match
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS missing_persons_name_trgm_idx
  ON public.missing_persons USING gin (name gin_trgm_ops);

-- 2) Suggest matches: given a missing person, return likely patient candidates
CREATE OR REPLACE FUNCTION public.suggest_patient_matches(p_missing_id uuid)
RETURNS TABLE (
  patient_id uuid,
  patient_name text,
  patient_age integer,
  center_name text,
  status text,
  score real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m_name text;
  m_age integer;
BEGIN
  SELECT name, age INTO m_name, m_age FROM public.missing_persons WHERE id = p_missing_id;
  IF m_name IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.name::text,
      p.age,
      p.center_name::text,
      p.status::text,
      similarity(p.name::text, m_name) AS score
    FROM public.patients p
    WHERE p.matched_missing_id IS NULL
      AND similarity(p.name::text, m_name) >= 0.45
      AND (m_age IS NULL OR p.age IS NULL OR abs(p.age - m_age) <= 2)
    ORDER BY score DESC
    LIMIT 8;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_patient_matches(uuid) TO anon, authenticated;

-- 3) Suggest matches in the opposite direction
CREATE OR REPLACE FUNCTION public.suggest_missing_matches(p_patient_id uuid)
RETURNS TABLE (
  missing_id uuid,
  missing_name text,
  missing_age integer,
  last_seen_location text,
  status text,
  score real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_name text;
  p_age integer;
BEGIN
  SELECT name, age INTO p_name, p_age FROM public.patients WHERE id = p_patient_id;
  IF p_name IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      m.id,
      m.name,
      m.age,
      m.last_seen_location,
      m.status,
      similarity(m.name, p_name) AS score
    FROM public.missing_persons m
    WHERE m.matched_patient_id IS NULL
      AND m.status <> 'found'
      AND similarity(m.name, p_name) >= 0.45
      AND (p_age IS NULL OR m.age IS NULL OR abs(m.age - p_age) <= 2)
    ORDER BY score DESC
    LIMIT 8;
END;
$$;

GRANT EXECUTE ON FUNCTION public.suggest_missing_matches(uuid) TO anon, authenticated;

-- 4) Confirm a link (admin/moderator only). Writes both sides + marks missing as 'found'.
CREATE OR REPLACE FUNCTION public.link_missing_to_patient(
  p_missing_id uuid,
  p_patient_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  -- Unlink any previous patient bound to this missing
  UPDATE public.patients
     SET matched_missing_id = NULL
   WHERE matched_missing_id = p_missing_id AND id <> p_patient_id;

  -- Unlink any previous missing bound to this patient
  UPDATE public.missing_persons
     SET matched_patient_id = NULL,
         matched_at = NULL,
         matched_by = NULL
   WHERE matched_patient_id = p_patient_id AND id <> p_missing_id;

  UPDATE public.missing_persons
     SET matched_patient_id = p_patient_id,
         matched_at = now(),
         matched_by = uid,
         status = 'found',
         found_date = COALESCE(found_date, now())
   WHERE id = p_missing_id;

  UPDATE public.patients
     SET matched_missing_id = p_missing_id
   WHERE id = p_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_missing_to_patient(uuid, uuid) TO authenticated;

-- 5) Unlink (admin/moderator only)
CREATE OR REPLACE FUNCTION public.unlink_missing_patient(p_missing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev_patient uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  SELECT matched_patient_id INTO prev_patient FROM public.missing_persons WHERE id = p_missing_id;

  UPDATE public.missing_persons
     SET matched_patient_id = NULL,
         matched_at = NULL,
         matched_by = NULL,
         status = 'missing',
         found_date = NULL
   WHERE id = p_missing_id;

  IF prev_patient IS NOT NULL THEN
    UPDATE public.patients SET matched_missing_id = NULL WHERE id = prev_patient;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlink_missing_patient(uuid) TO authenticated;
