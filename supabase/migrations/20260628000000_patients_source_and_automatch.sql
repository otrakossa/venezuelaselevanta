-- Añade rastreo de fuente a patients + función de auto-match para sync externo

-- 1) Columnas de fuente
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS source_url   TEXT,
  ADD COLUMN IF NOT EXISTS source_id    TEXT,
  ADD COLUMN IF NOT EXISTS source_label TEXT;

-- Índice único: un registro de la fuente X sólo se importa una vez
CREATE UNIQUE INDEX IF NOT EXISTS patients_source_uniq
  ON public.patients (source_url, source_id)
  WHERE source_url IS NOT NULL AND source_id IS NOT NULL;

-- 2) Función de auto-link para scripts externos (sin requerir auth.uid)
--    Usada por sync-localizapacientes.mjs con service_role key
--    Solo vincula si ambos extremos aún no tienen match
CREATE OR REPLACE FUNCTION public.auto_link_missing_to_patient(
  p_missing_id  uuid,
  p_patient_id  uuid,
  p_score       real DEFAULT 0
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_linked_m boolean;
  already_linked_p boolean;
BEGIN
  SELECT matched_patient_id IS NOT NULL INTO already_linked_m
    FROM public.missing_persons WHERE id = p_missing_id;

  SELECT matched_missing_id IS NOT NULL INTO already_linked_p
    FROM public.patients WHERE id = p_patient_id;

  -- No pisar vínculos ya confirmados por humanos
  IF already_linked_m OR already_linked_p THEN
    RETURN false;
  END IF;

  UPDATE public.missing_persons
     SET matched_patient_id = p_patient_id,
         matched_at         = now(),
         status             = 'encontrado',
         found_date         = COALESCE(found_date, now())
   WHERE id = p_missing_id;

  UPDATE public.patients
     SET matched_missing_id = p_missing_id
   WHERE id = p_patient_id;

  RETURN true;
END;
$$;

-- Solo service_role (el script de sync corre con esa key)
REVOKE EXECUTE ON FUNCTION public.auto_link_missing_to_patient(uuid, uuid, real) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.auto_link_missing_to_patient(uuid, uuid, real) TO service_role;

-- 3) Vista de duplicados dentro de patients:
--    Misma cédula o mismo nombre+centro → candidatos a fusionar
CREATE OR REPLACE VIEW public.patients_duplicates AS
SELECT
  a.id        AS id_a,
  b.id        AS id_b,
  a.name      AS name_a,
  b.name      AS name_b,
  a.id_number AS cedula_a,
  b.id_number AS cedula_b,
  a.center_name,
  a.source_label AS source_a,
  b.source_label AS source_b,
  CASE
    WHEN a.id_number IS NOT NULL AND a.id_number = b.id_number THEN 'cedula'
    ELSE 'nombre_centro'
  END AS match_type,
  similarity(a.name::text, b.name::text) AS name_score
FROM public.patients a
JOIN public.patients b
  ON a.id < b.id
  AND (
    (a.id_number IS NOT NULL AND a.id_number = b.id_number)
    OR
    (a.center_name = b.center_name AND similarity(a.name::text, b.name::text) >= 0.80)
  );

GRANT SELECT ON public.patients_duplicates TO service_role, authenticated;
