
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source text;

CREATE UNIQUE INDEX IF NOT EXISTS reports_external_id_unique
  ON public.reports(external_id) WHERE external_id IS NOT NULL;

INSERT INTO public.categories (slug, name, color, icon)
VALUES ('earthquake', 'Sismo', '#9333EA', 'Waves')
ON CONFLICT (slug) DO NOTHING;
