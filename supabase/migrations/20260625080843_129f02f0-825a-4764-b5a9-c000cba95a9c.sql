CREATE TABLE IF NOT EXISTS public.report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  author_name text,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_comments_report_id_idx ON public.report_comments(report_id, created_at DESC);

GRANT SELECT, INSERT ON public.report_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_comments TO authenticated;
GRANT ALL ON public.report_comments TO service_role;

ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments public read" ON public.report_comments FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can add comment" ON public.report_comments FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Authenticated delete comments" ON public.report_comments FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.report_comments;