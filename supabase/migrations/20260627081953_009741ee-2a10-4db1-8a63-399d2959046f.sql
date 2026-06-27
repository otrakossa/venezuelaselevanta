
-- 1) Hide PII on missing_persons from anon
REVOKE SELECT (contact_name, contact_phone, contact_email) ON public.missing_persons FROM anon;

-- 2) needs: admin/moderator-only UPDATE
DROP POLICY IF EXISTS needs_update ON public.needs;
CREATE POLICY needs_update_admin ON public.needs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- 3) offers: admin/moderator-only UPDATE
DROP POLICY IF EXISTS offers_update ON public.offers;
CREATE POLICY offers_update_admin ON public.offers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- 4) patients: hide PII columns from anon; restrict UPDATE/DELETE to admin/moderator
REVOKE SELECT (id_number, phone, address) ON public.patients FROM anon;
DROP POLICY IF EXISTS patients_update ON public.patients;
CREATE POLICY patients_update_admin ON public.patients
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY patients_delete_admin ON public.patients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- 5) push_config: no anon/authenticated grants
REVOKE ALL ON public.push_config FROM PUBLIC;
REVOKE ALL ON public.push_config FROM anon;
REVOKE ALL ON public.push_config FROM authenticated;
GRANT ALL ON public.push_config TO service_role;

-- 6) push_subscriptions: remove permissive UPDATE/DELETE (server route uses service role)
DROP POLICY IF EXISTS "Delete own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Manage by endpoint" ON public.push_subscriptions;

-- 7) report_comments: restrict DELETE to admin/moderator
DROP POLICY IF EXISTS "Authenticated delete comments" ON public.report_comments;
CREATE POLICY "Admins delete comments" ON public.report_comments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- 8) Narrow EXECUTE on SECURITY DEFINER functions in public schema
REVOKE EXECUTE ON FUNCTION public.cast_report_vote(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cast_report_vote(uuid, text, text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.link_missing_to_patient(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.link_missing_to_patient(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.unlink_missing_patient(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.unlink_missing_patient(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.suggest_missing_matches(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.suggest_missing_matches(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.suggest_patient_matches(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.suggest_patient_matches(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_critical_report() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_critical_report() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_critical_report() FROM authenticated;
