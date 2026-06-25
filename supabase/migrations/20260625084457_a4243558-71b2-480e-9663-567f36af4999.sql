ALTER TABLE public.missing_persons
  ADD COLUMN IF NOT EXISTS source_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_label text DEFAULT NULL;