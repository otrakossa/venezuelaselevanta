ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS parish text;

ALTER TABLE public.missing_persons
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS municipality text,
  ADD COLUMN IF NOT EXISTS parish text;

CREATE INDEX IF NOT EXISTS reports_state_idx ON public.reports(state);
CREATE INDEX IF NOT EXISTS reports_municipality_idx ON public.reports(municipality);
CREATE INDEX IF NOT EXISTS missing_persons_state_idx ON public.missing_persons(state);
