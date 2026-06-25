
-- 1. Drop FK so we can update category slugs in both tables
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_category_fkey;

-- 2. Update report slugs to English
UPDATE public.reports SET category = CASE category
  WHEN 'desaparecidos'   THEN 'missing'
  WHEN 'heridos'         THEN 'medical'
  WHEN 'atrapados'       THEN 'rescue'
  WHEN 'ayuda'           THEN 'shelter'
  WHEN 'infraestructura' THEN 'infrastructure'
  WHEN 'encuentro'       THEN 'evacuation'
  WHEN 'vias'            THEN 'blocked_road'
  WHEN 'medico'          THEN 'hospital'
  ELSE category END;

-- 3. Categories: replace primary key by id, add created_at, reseed rows
DELETE FROM public.categories;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_pkey;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.categories ADD PRIMARY KEY (id);
ALTER TABLE public.categories ADD CONSTRAINT categories_slug_key UNIQUE (slug);

INSERT INTO public.categories (name, slug, color, icon) VALUES
  ('Personas desaparecidas',           'missing',        '#DC2626', '🔴'),
  ('Heridos / Necesidad médica',       'medical',        '#EA580C', '🟠'),
  ('Personas atrapadas / Rescate',     'rescue',         '#CA8A04', '🟡'),
  ('Distribución de ayuda / Refugio',  'shelter',        '#2563EB', '🔵'),
  ('Infraestructura dañada',           'infrastructure', '#7C3AED', '🟣'),
  ('Punto de encuentro / Evacuación',  'evacuation',     '#16A34A', '🟢'),
  ('Vías bloqueadas',                  'blocked_road',   '#374151', '⚫'),
  ('Centro médico / Hospital',         'hospital',       '#DB2777', '🩺');

-- 4. Re-create FK from reports.category -> categories.slug
ALTER TABLE public.reports
  ADD CONSTRAINT reports_category_fkey FOREIGN KEY (category) REFERENCES public.categories(slug);

-- 5. Reports: migrate urgency & status to English, rename location_text -> address
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_urgency_check;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ALTER COLUMN urgency DROP DEFAULT;
ALTER TABLE public.reports ALTER COLUMN status  DROP DEFAULT;

UPDATE public.reports SET urgency = CASE urgency
  WHEN 'critico' THEN 'critical'
  WHEN 'alto'    THEN 'high'
  WHEN 'medio'   THEN 'medium'
  WHEN 'bajo'    THEN 'low'
  ELSE urgency END;

UPDATE public.reports SET status = CASE status
  WHEN 'activo'      THEN 'active'
  WHEN 'en_atencion' THEN 'attending'
  WHEN 'atencion'    THEN 'attending'
  WHEN 'resuelto'    THEN 'resolved'
  ELSE status END;

ALTER TABLE public.reports ALTER COLUMN urgency SET DEFAULT 'medium';
ALTER TABLE public.reports ALTER COLUMN status  SET DEFAULT 'active';
ALTER TABLE public.reports
  ADD CONSTRAINT reports_urgency_check CHECK (urgency IN ('critical','high','medium','low')),
  ADD CONSTRAINT reports_status_check  CHECK (status  IN ('active','attending','resolved'));

ALTER TABLE public.reports RENAME COLUMN location_text TO address;

-- 6. Missing persons: rename columns, add new fields, migrate status
ALTER TABLE public.missing_persons DROP CONSTRAINT IF EXISTS missing_persons_status_check;
ALTER TABLE public.missing_persons ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.missing_persons RENAME COLUMN physical_description TO description;
ALTER TABLE public.missing_persons RENAME COLUMN lat TO last_seen_lat;
ALTER TABLE public.missing_persons RENAME COLUMN lng TO last_seen_lng;
ALTER TABLE public.missing_persons RENAME COLUMN contact_info TO contact_name;

ALTER TABLE public.missing_persons ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.missing_persons ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.missing_persons ADD COLUMN IF NOT EXISTS report_date timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.missing_persons ADD COLUMN IF NOT EXISTS found_date  timestamptz;

UPDATE public.missing_persons SET status = CASE status
  WHEN 'desaparecido' THEN 'missing'
  WHEN 'encontrado'   THEN 'found'
  ELSE status END;
UPDATE public.missing_persons SET report_date = created_at WHERE report_date IS NULL;

ALTER TABLE public.missing_persons ALTER COLUMN status SET DEFAULT 'missing';
ALTER TABLE public.missing_persons
  ADD CONSTRAINT missing_persons_status_check CHECK (status IN ('missing','found','deceased'));
