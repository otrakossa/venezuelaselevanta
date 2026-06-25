
-- Categories
CREATE TABLE public.categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT USING (true);

INSERT INTO public.categories (slug, name, color, icon, description) VALUES
  ('desaparecidos', 'Personas desaparecidas', '#DC2626', 'UserX', 'Reportes de personas desaparecidas'),
  ('heridos', 'Heridos / Necesidad médica', '#EA580C', 'HeartPulse', 'Heridos o necesidad médica urgente'),
  ('atrapados', 'Atrapados / Rescate', '#EAB308', 'Siren', 'Personas atrapadas que requieren rescate'),
  ('ayuda', 'Ayuda / Refugio', '#2563EB', 'HandHelping', 'Distribución de ayuda o refugio disponible'),
  ('infraestructura', 'Infraestructura dañada', '#9333EA', 'Building2', 'Edificios derrumbados o dañados'),
  ('encuentro', 'Punto de encuentro', '#16A34A', 'MapPin', 'Punto seguro de encuentro o evacuación'),
  ('vias', 'Vías bloqueadas', '#374151', 'Construction', 'Vías o puentes bloqueados/caídos'),
  ('medico', 'Centro médico', '#EC4899', 'Cross', 'Centro médico improvisado o hospital');

-- Reports
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL REFERENCES public.categories(slug),
  urgency TEXT NOT NULL DEFAULT 'medio' CHECK (urgency IN ('critico','alto','medio','bajo')),
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo','en_atencion','resuelto')),
  location_text TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  reporter_name TEXT,
  photo_url TEXT,
  affected_count INTEGER,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reports public read" ON public.reports FOR SELECT USING (true);
CREATE POLICY "Anyone can create reports" ON public.reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update reports" ON public.reports FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete reports" ON public.reports FOR DELETE TO authenticated USING (true);

-- Missing persons
CREATE TABLE public.missing_persons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  physical_description TEXT,
  last_seen_location TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  photo_url TEXT,
  contact_info TEXT,
  status TEXT NOT NULL DEFAULT 'desaparecido' CHECK (status IN ('desaparecido','encontrado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.missing_persons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missing_persons TO authenticated;
GRANT ALL ON public.missing_persons TO service_role;
ALTER TABLE public.missing_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Missing public read" ON public.missing_persons FOR SELECT USING (true);
CREATE POLICY "Anyone can create missing" ON public.missing_persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated update missing" ON public.missing_persons FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated delete missing" ON public.missing_persons FOR DELETE TO authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER missing_updated_at BEFORE UPDATE ON public.missing_persons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missing_persons;
