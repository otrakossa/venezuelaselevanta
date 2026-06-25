
-- pg_net for outbound HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km INTEGER NOT NULL DEFAULT 10,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subs_latlng_idx ON public.push_subscriptions (lat, lng);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon, authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert their own subscription (no PII beyond endpoint they provide)
CREATE POLICY "Anyone can subscribe" ON public.push_subscriptions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Anyone who knows the endpoint can update/delete it (it's their secret)
CREATE POLICY "Manage by endpoint" ON public.push_subscriptions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Delete own subscription" ON public.push_subscriptions
  FOR DELETE TO anon, authenticated USING (true);

-- No public SELECT — only service_role can list

CREATE TRIGGER set_push_subs_updated
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Settings table for storing the broadcast URL + secret (one row)
CREATE TABLE IF NOT EXISTS public.push_config (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  broadcast_url TEXT,
  broadcast_secret TEXT
);
GRANT ALL ON public.push_config TO service_role;
ALTER TABLE public.push_config ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role can read/write

INSERT INTO public.push_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Trigger function: fire-and-forget HTTP POST to broadcast endpoint
CREATE OR REPLACE FUNCTION public.notify_critical_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg RECORD;
BEGIN
  IF NEW.urgency <> 'critical' THEN RETURN NEW; END IF;
  SELECT broadcast_url, broadcast_secret INTO cfg FROM public.push_config WHERE id = true;
  IF cfg.broadcast_url IS NULL OR cfg.broadcast_secret IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := cfg.broadcast_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-broadcast-secret', cfg.broadcast_secret),
    body := jsonb_build_object('report_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block report insert
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_notify_critical ON public.reports;
CREATE TRIGGER reports_notify_critical
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_critical_report();

-- Add 'found' status option for missing_persons (it's text, so just allow it)
-- (status column is already TEXT free-form; no change needed if so)
