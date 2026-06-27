-- Ampliar tabla patients con campos geográficos y vínculo canónico al centro
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS health_center_id uuid REFERENCES public.health_centers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_patients_state ON public.patients (state);
CREATE INDEX IF NOT EXISTS idx_patients_sector ON public.patients (sector);
CREATE INDEX IF NOT EXISTS idx_patients_health_center_id ON public.patients (health_center_id);
