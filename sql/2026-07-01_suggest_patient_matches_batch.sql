-- Versión batch de suggest_patient_matches para eliminar N+1 en MatchQueue.
-- Recibe un arreglo de missing_ids y devuelve todas las sugerencias en una sola llamada.
--
-- Aplicar con:
--   psql "$NEW_SUPABASE_DB_URL" -f sql/2026-07-01_suggest_patient_matches_batch.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.suggest_patient_matches_batch(p_missing_ids uuid[])
RETURNS TABLE(
  missing_id   uuid,
  patient_id   uuid,
  patient_name text,
  patient_age  integer,
  center_name  text,
  status       text,
  score        real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH src AS (
    SELECT id, name, age, last_seen_location
      FROM public.missing_persons
     WHERE id = ANY (p_missing_ids)
  ),
  scored AS (
    SELECT
      m.id AS missing_id,
      p.id AS patient_id,
      p.name::text  AS patient_name,
      p.age         AS patient_age,
      p.center_name::text AS center_name,
      p.status::text      AS status,
      (
        similarity(p.name::text, m.name) * 0.7
        + CASE
            WHEN p.sector IS NOT NULL AND m.last_seen_location IS NOT NULL AND (
                 m.last_seen_location ILIKE '%' || p.sector || '%'
                 OR similarity(p.sector, m.last_seen_location) >= 0.45
            ) THEN 0.3
            ELSE 0
          END
      )::real AS score,
      row_number() OVER (
        PARTITION BY m.id
        ORDER BY
          (similarity(p.name::text, m.name) * 0.7
           + CASE
               WHEN p.sector IS NOT NULL AND m.last_seen_location IS NOT NULL AND (
                    m.last_seen_location ILIKE '%' || p.sector || '%'
                    OR similarity(p.sector, m.last_seen_location) >= 0.45
               ) THEN 0.3
               ELSE 0
             END) DESC
      ) AS rn
    FROM src m
    JOIN public.patients p
      ON p.matched_missing_id IS NULL
     AND similarity(p.name::text, m.name) >= 0.40
     AND (m.age IS NULL OR p.age IS NULL OR abs(p.age - m.age) <= 2)
  )
  SELECT missing_id, patient_id, patient_name, patient_age, center_name, status, score
    FROM scored
   WHERE rn <= 8
   ORDER BY missing_id, score DESC;
$$;

REVOKE ALL ON FUNCTION public.suggest_patient_matches_batch(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggest_patient_matches_batch(uuid[]) TO anon, authenticated;

COMMIT;
