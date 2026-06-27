
CREATE OR REPLACE FUNCTION public.suggest_patient_matches(p_missing_id uuid)
 RETURNS TABLE(patient_id uuid, patient_name text, patient_age integer, center_name text, status text, score real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m_name text;
  m_age integer;
  m_loc  text;
BEGIN
  SELECT name, age, last_seen_location INTO m_name, m_age, m_loc
    FROM public.missing_persons WHERE id = p_missing_id;
  IF m_name IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      p.id,
      p.name::text,
      p.age,
      p.center_name::text,
      p.status::text,
      (
        similarity(p.name::text, m_name) * 0.7
        + CASE
            WHEN p.sector IS NOT NULL AND m_loc IS NOT NULL AND (
                 m_loc ILIKE '%' || p.sector || '%'
                 OR similarity(p.sector, m_loc) >= 0.45
            ) THEN 0.3
            ELSE 0
          END
      )::real AS score
    FROM public.patients p
    WHERE p.matched_missing_id IS NULL
      AND similarity(p.name::text, m_name) >= 0.40
      AND (m_age IS NULL OR p.age IS NULL OR abs(p.age - m_age) <= 2)
    ORDER BY score DESC
    LIMIT 8;
END;
$function$;

CREATE OR REPLACE FUNCTION public.suggest_missing_matches(p_patient_id uuid)
 RETURNS TABLE(missing_id uuid, missing_name text, missing_age integer, last_seen_location text, status text, score real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p_name   text;
  p_age    integer;
  p_sector text;
BEGIN
  SELECT name, age, sector INTO p_name, p_age, p_sector
    FROM public.patients WHERE id = p_patient_id;
  IF p_name IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT
      m.id,
      m.name,
      m.age,
      m.last_seen_location,
      m.status,
      (
        similarity(m.name, p_name) * 0.7
        + CASE
            WHEN p_sector IS NOT NULL AND m.last_seen_location IS NOT NULL AND (
                 m.last_seen_location ILIKE '%' || p_sector || '%'
                 OR similarity(p_sector, m.last_seen_location) >= 0.45
            ) THEN 0.3
            ELSE 0
          END
      )::real AS score
    FROM public.missing_persons m
    WHERE m.matched_patient_id IS NULL
      AND m.status <> 'found'
      AND similarity(m.name, p_name) >= 0.40
      AND (p_age IS NULL OR m.age IS NULL OR abs(m.age - p_age) <= 2)
    ORDER BY score DESC
    LIMIT 8;
END;
$function$;
