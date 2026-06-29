
CREATE OR REPLACE FUNCTION public.set_missing_status(p_id uuid, p_status text, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;
  IF p_status NOT IN ('missing','found','deceased') THEN
    RAISE EXCEPTION 'invalid status (use missing|found|deceased)';
  END IF;
  UPDATE public.missing_persons
     SET status = p_status,
         found_date = CASE WHEN p_status = 'missing' THEN NULL
                           WHEN found_date IS NULL THEN now()
                           ELSE found_date END,
         description = CASE WHEN p_note IS NULL OR length(trim(p_note))=0 THEN description
                            ELSE COALESCE(description || E'\n','') || '[' || now()::date || ' admin] ' || p_note END
   WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_missing_person(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT (public.has_role(uid,'admin') OR public.has_role(uid,'moderator')) THEN
    RAISE EXCEPTION 'insufficient privileges';
  END IF;
  -- FKs: votes/queue cascade, patients/matched set null. Comments must move out manually.
  DELETE FROM public.missing_person_comments WHERE missing_person_id = p_id;
  DELETE FROM public.missing_persons WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_missing_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_missing_person(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
