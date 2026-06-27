
CREATE INDEX IF NOT EXISTS missing_persons_report_date_desc_idx
  ON public.missing_persons (report_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS missing_persons_status_report_date_idx
  ON public.missing_persons (status, report_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS missing_persons_last_seen_location_trgm_idx
  ON public.missing_persons USING gin (last_seen_location gin_trgm_ops);

CREATE INDEX IF NOT EXISTS missing_persons_description_trgm_idx
  ON public.missing_persons USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS missing_persons_geo_idx
  ON public.missing_persons (last_seen_lat, last_seen_lng)
  WHERE last_seen_lat IS NOT NULL AND last_seen_lng IS NOT NULL;

CREATE INDEX IF NOT EXISTS reports_created_at_desc_idx
  ON public.reports (created_at DESC);

CREATE INDEX IF NOT EXISTS reports_category_status_idx
  ON public.reports (category, status);

CREATE INDEX IF NOT EXISTS reports_urgency_idx
  ON public.reports (urgency);

CREATE INDEX IF NOT EXISTS reports_geo_idx
  ON public.reports (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;

DROP INDEX IF EXISTS public.offers_category_idx;
DROP INDEX IF EXISTS public.offers_need_id_idx;
DROP INDEX IF EXISTS public.patients_center_idx;

ANALYZE public.missing_persons;
ANALYZE public.reports;
ANALYZE public.patients;
ANALYZE public.offers;
