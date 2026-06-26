-- Harden function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.gen_client_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
    NEW.client_code := 'CLT-' || LPAD(nextval('public.clients_code_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.gen_employee_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    NEW.employee_code := 'EMP-' || LPAD(nextval('public.employees_code_seq')::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END; $$;

-- Restrict EXECUTE on SECURITY DEFINER helpers to authenticated users only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user(uuid) TO authenticated;

-- Tighten notifications insert: must target self OR be ceo_admin/coo_ops
DROP POLICY IF EXISTS "Authenticated insert notifications" ON public.notifications;
CREATE POLICY "Insert notifications for self or by admin"
  ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'ceo_admin')
    OR public.has_role(auth.uid(), 'coo_ops')
  );

-- Tighten audit_logs insert: user_id must be auth.uid()
DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_logs;
CREATE POLICY "Insert audit as self"
  ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

