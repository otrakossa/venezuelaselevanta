CREATE OR REPLACE FUNCTION public.set_missing_person_photo(p_person_id uuid, p_photo_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_photo_url IS NULL OR length(p_photo_url) < 10 OR length(p_photo_url) > 2000 THEN
    RAISE EXCEPTION 'invalid photo url';
  END IF;
  UPDATE public.missing_persons
     SET photo_url = p_photo_url
   WHERE id = p_person_id
     AND (photo_url IS NULL OR photo_url = '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_missing_person_photo(uuid, text) TO anon, authenticated;