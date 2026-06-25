-- Add credibility / verification columns to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS confirm_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Votes table: 1 vote per device per report
CREATE TABLE IF NOT EXISTS public.report_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  vote text NOT NULL CHECK (vote IN ('confirm','dispute')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_votes TO anon, authenticated;
GRANT ALL ON public.report_votes TO service_role;

ALTER TABLE public.report_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes public read"
  ON public.report_votes FOR SELECT TO public USING (true);

CREATE POLICY "Anyone can cast vote"
  ON public.report_votes FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can update own vote"
  ON public.report_votes FOR UPDATE TO public USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can remove own vote"
  ON public.report_votes FOR DELETE TO public USING (true);

CREATE TRIGGER set_report_votes_updated_at
  BEFORE UPDATE ON public.report_votes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger that keeps counters in sync
CREATE OR REPLACE FUNCTION public.sync_report_vote_counts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote = 'confirm' THEN
      UPDATE public.reports SET confirm_count = confirm_count + 1 WHERE id = NEW.report_id;
    ELSE
      UPDATE public.reports SET dispute_count = dispute_count + 1 WHERE id = NEW.report_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.vote <> OLD.vote THEN
      IF OLD.vote = 'confirm' THEN
        UPDATE public.reports SET confirm_count = GREATEST(confirm_count - 1, 0) WHERE id = NEW.report_id;
      ELSE
        UPDATE public.reports SET dispute_count = GREATEST(dispute_count - 1, 0) WHERE id = NEW.report_id;
      END IF;
      IF NEW.vote = 'confirm' THEN
        UPDATE public.reports SET confirm_count = confirm_count + 1 WHERE id = NEW.report_id;
      ELSE
        UPDATE public.reports SET dispute_count = dispute_count + 1 WHERE id = NEW.report_id;
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote = 'confirm' THEN
      UPDATE public.reports SET confirm_count = GREATEST(confirm_count - 1, 0) WHERE id = OLD.report_id;
    ELSE
      UPDATE public.reports SET dispute_count = GREATEST(dispute_count - 1, 0) WHERE id = OLD.report_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS report_votes_sync ON public.report_votes;
CREATE TRIGGER report_votes_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.report_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_report_vote_counts();

ALTER PUBLICATION supabase_realtime ADD TABLE public.report_votes;