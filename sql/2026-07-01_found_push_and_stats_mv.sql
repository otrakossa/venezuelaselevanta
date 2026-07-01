-- Tarea #16 & #19 — Push cuando aparece un desaparecido + solidarity_stats materializada.
--
-- Aplicar con:
--   psql "$NEW_SUPABASE_DB_URL" -f sql/2026-07-01_found_push_and_stats_mv.sql

BEGIN;

-- ============================================================
-- #16 — Trigger de notificación push al encontrar a alguien
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_missing_found()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cfg RECORD;
  target_url text;
BEGIN
  IF NEW.status <> 'found' OR OLD.status = 'found' THEN
    RETURN NEW;
  END IF;

  SELECT broadcast_url, broadcast_secret INTO cfg FROM public.push_config WHERE id = true;
  IF cfg.broadcast_url IS NULL OR cfg.broadcast_secret IS NULL THEN RETURN NEW; END IF;

  target_url := regexp_replace(cfg.broadcast_url, '/broadcast$', '/notify-found');

  PERFORM net.http_post(
    url := target_url,
    headers := jsonb_build_object('Content-Type','application/json','x-broadcast-secret', cfg.broadcast_secret),
    body := jsonb_build_object('missing_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_missing_found ON public.missing_persons;
CREATE TRIGGER trg_notify_missing_found
AFTER UPDATE OF status ON public.missing_persons
FOR EACH ROW EXECUTE FUNCTION public.notify_missing_found();

-- ============================================================
-- #19 — Materialized view para solidarity_stats (refresh 5 min)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.solidarity_stats_mv AS
WITH counts AS (
  SELECT
    (SELECT count(*) FROM page_views) AS visits,
    (SELECT count(*) FROM page_views WHERE created_at >= ((now() AT TIME ZONE 'America/Caracas')::date)) AS visits_today,
    (SELECT count(*) FROM reports) AS reports,
    (SELECT count(*) FROM needs) AS needs,
    (SELECT count(*) FROM offers) AS offers,
    (SELECT count(*) FROM report_comments) AS report_comments,
    (SELECT count(*) FROM missing_person_comments) AS missing_comments,
    (SELECT count(*) FROM report_votes) AS report_votes,
    (SELECT count(*) FROM missing_person_found_votes) AS found_votes,
    (SELECT count(*) FROM contact_messages) AS contacts
)
SELECT
  (visits + reports + needs + offers + report_comments + missing_comments + report_votes + found_votes + contacts) AS total_solidarity,
  (reports + needs + offers + report_comments + missing_comments + report_votes + found_votes + contacts) AS contributions,
  visits, visits_today, reports, needs, offers, report_comments, missing_comments, report_votes, found_votes, contacts,
  now() AS refreshed_at
FROM counts;

GRANT SELECT ON public.solidarity_stats_mv TO anon, authenticated, service_role;

-- Reemplazar la vista existente para que apunte al MV (compat con el frontend actual).
DROP VIEW IF EXISTS public.solidarity_stats;
CREATE VIEW public.solidarity_stats AS SELECT * FROM public.solidarity_stats_mv;
GRANT SELECT ON public.solidarity_stats TO anon, authenticated, service_role;

-- Refresco periódico (5 min) vía pg_cron
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-solidarity-stats-mv')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-solidarity-stats-mv');
    PERFORM cron.schedule(
      'refresh-solidarity-stats-mv',
      '*/5 * * * *',
      $cron$ REFRESH MATERIALIZED VIEW public.solidarity_stats_mv; $cron$
    );
  END IF;
END
$do$;

COMMIT;

-- Primer refresh inmediato para que la MV no arranque vacía
REFRESH MATERIALIZED VIEW public.solidarity_stats_mv;
