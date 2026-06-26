GRANT SELECT ON public.missing_persons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.missing_persons TO authenticated;
GRANT ALL ON public.missing_persons TO service_role;