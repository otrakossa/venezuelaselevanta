CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS id_number text,
  ADD COLUMN IF NOT EXISTS phone     text,
  ADD COLUMN IF NOT EXISTS address   text;

CREATE INDEX IF NOT EXISTS patients_name_trgm ON public.patients USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS patients_id_number_idx ON public.patients (id_number);
CREATE INDEX IF NOT EXISTS patients_center_idx ON public.patients (center_name);
CREATE INDEX IF NOT EXISTS patients_registered_by_idx ON public.patients (registered_by);