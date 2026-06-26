ALTER TABLE public.offers ALTER COLUMN need_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS offers_category_idx ON public.offers (category);
CREATE INDEX IF NOT EXISTS offers_status_idx ON public.offers (status);
CREATE INDEX IF NOT EXISTS offers_need_id_idx ON public.offers (need_id);