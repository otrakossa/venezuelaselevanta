-- Unifica auditoría de cambios de estado de desaparecidos y restaura
-- el voto público "Marcar como encontrado" que faltaba en producción.
--
-- Aplicar con:
--   psql "$NEW_SUPABASE_DB_URL" -f sql/2026-06-29_unify_found_audit.sql

BEGIN;

-- ============================================================
-- 1) Columna found_marks (contador de votos ciudadanos)
-- ============================================================
ALTER TABLE public.missing_persons
  ADD COLUMN IF NOT EXISTS found_marks integer NOT NULL DEFAULT 0;

-- ============================================================
-- 2) Tabla missing_person_found_votes (1 dispositivo = 1 voto)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.missing_person_found_votes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  missing_person_id   uuid NOT NULL REFERENCES public.missing_persons(id) ON DELETE CASCADE,
  device_id           text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (missing_person_id, device_id)
);

GRANT SELECT, INSERT ON public.missing_person_found_votes TO anon, authenticated;
GRANT ALL ON public.missing_person_found_votes TO service_role;

ALTER TABLE public.missing_person_found_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read found votes" ON public.missing_person_found_votes;
CREATE POLICY "anyone can read found votes" ON public.missing_person_found_votes
  FOR SELECT TO anon, authenticated USING (true);

-- Las inserciones se hacen vía RPC SECURITY DEFINER; bloqueamos INSERT directo.
DROP POLICY IF EXISTS "no direct insert found votes" ON public.missing_person_found_votes;
CREATE POLICY "no direct insert found votes" ON public.missing_person_found_votes
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_found_votes_person
  ON public.missing_person_found_votes (missing_person_id);

-- ============================================================
-- 3) RPC: mark_missing_person_found (voto público)
--    - Anti doble voto por device_id
--    - Al primer voto cambia status a 'found' y registra auditoría
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_missing_person_found(
  _person_id uuid,
  _device_id text
)
RETURNS TABLE(found_marks integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted     boolean := false;
  prev_status  text;
  new_marks    integer;
BEGIN
  IF _device_id IS NULL OR length(_device_id) < 8 OR length(_device_id) > 128 THEN
    RAISE EXCEPTION 'invalid device_id';
  END IF;

  INSERT INTO public.missing_person_found_votes (missing_person_id, device_id)
  VALUES (_person_id, _device_id)
  ON CONFLICT (missing_person_id, device_id) DO NOTHING
  RETURNING true INTO inserted;

  IF inserted THEN
    SELECT mp.status INTO prev_status
      FROM public.missing_persons mp
     WHERE mp.id = _person_id
     FOR UPDATE;

    IF prev_status IS NULL THEN
      RAISE EXCEPTION 'missing_person not found';
    END IF;

    UPDATE public.missing_persons
       SET found_marks = COALESCE(found_marks, 0) + 1,
           status      = 'found',
           found_date  = COALESCE(found_date, now())
     WHERE id = _person_id;

    IF prev_status <> 'found' THEN
      INSERT INTO public.missing_status_log (missing_id, prev_status, new_status, changed_by, note)
      VALUES (_person_id, prev_status, 'found', NULL,
              'vote:' || left(_device_id, 8));
    END IF;
  END IF;

  RETURN QUERY
    SELECT mp.found_marks, mp.status::text
      FROM public.missing_persons mp
     WHERE mp.id = _person_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_missing_person_found(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_missing_person_found(uuid, text) TO anon, authenticated;

-- ============================================================
-- 4) RPC: link_missing_to_patient (auditoría unificada)
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_missing_to_patient(p_missing_id uuid, p_patient_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prev_status text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  SELECT status INTO prev_status FROM public.missing_persons WHERE id = p_missing_id FOR UPDATE;
  IF prev_status IS NULL THEN
    RAISE EXCEPTION 'missing_person not found';
  END IF;

  UPDATE public.patients
     SET matched_missing_id = NULL
   WHERE matched_missing_id = p_missing_id AND id <> p_patient_id;

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

  IF prev_status <> 'found' THEN
    INSERT INTO public.missing_status_log (missing_id, prev_status, new_status, changed_by, note)
    VALUES (p_missing_id, prev_status, 'found', uid, 'match:patient:' || p_patient_id::text);
  END IF;
END;
$$;

-- ============================================================
-- 5) RPC: unlink_missing_patient (auditoría unificada)
-- ============================================================
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.has_role(uid, 'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;

  SELECT matched_patient_id, status
    INTO prev_patient, prev_status
    FROM public.missing_persons WHERE id = p_missing_id FOR UPDATE;

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

  IF prev_status = 'found' THEN
    INSERT INTO public.missing_status_log (missing_id, prev_status, new_status, changed_by, note)
    VALUES (p_missing_id, prev_status, 'missing', uid, 'unlink:patient:' || COALESCE(prev_patient::text, 'none'));
  END IF;
END;
$$;

-- ============================================================
-- 6) Backfill found_marks desde votos existentes (no-op si tabla recién creada)
-- ============================================================
UPDATE public.missing_persons mp
   SET found_marks = sub.c
  FROM (
    SELECT missing_person_id, COUNT(*)::int AS c
      FROM public.missing_person_found_votes
     GROUP BY missing_person_id
  ) sub
 WHERE mp.id = sub.missing_person_id
   AND mp.found_marks <> sub.c;

COMMIT;
