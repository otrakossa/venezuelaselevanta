
ALTER TABLE public.missing_persons
  ADD COLUMN IF NOT EXISTS found_marks INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.missing_person_found_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  missing_person_id UUID NOT NULL REFERENCES public.missing_persons(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (missing_person_id, device_id)
);

GRANT SELECT, INSERT ON public.missing_person_found_votes TO anon, authenticated;
GRANT ALL ON public.missing_person_found_votes TO service_role;

ALTER TABLE public.missing_person_found_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read found votes"
  ON public.missing_person_found_votes FOR SELECT
  USING (true);

CREATE POLICY "anyone can insert found vote"
  ON public.missing_person_found_votes FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.mark_missing_person_found(_person_id UUID, _device_id TEXT)
RETURNS TABLE (found_marks INTEGER, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted BOOLEAN := false;
BEGIN
  INSERT INTO public.missing_person_found_votes (missing_person_id, device_id)
  VALUES (_person_id, _device_id)
  ON CONFLICT (missing_person_id, device_id) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF inserted THEN
    UPDATE public.missing_persons
       SET found_marks = COALESCE(found_marks, 0) + 1,
           status = 'found',
           found_date = COALESCE(found_date, now())
     WHERE id = _person_id;
  END IF;

  RETURN QUERY
    SELECT mp.found_marks, mp.status::TEXT
      FROM public.missing_persons mp
     WHERE mp.id = _person_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_missing_person_found(UUID, TEXT) TO anon, authenticated;
