-- Super Admin role (2/2): wire up privileges.
--
-- Model:
--   * super_admin inherits everything ceo_admin can do: has_role(uid,'ceo_admin')
--     returns true for super_admin users, so every existing CEO check, policy and
--     has_permission() call keeps working for them unchanged.
--   * System-administration powers move to super_admin ONLY:
--     user/role management, role permissions, audit logs, activity log,
--     backups, cron secrets, environment config (app_config), sandbox wipe,
--     and cancel / re-create of invoices and paysheets.
--   * Reading user profiles/roles stays with CEO (CRM assignee pickers need it).
--   * Notification fan-outs that targeted ceo_admin now also include super_admin.

-- 1. Role inheritance ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR (_role = 'ceo_admin' AND role = 'super_admin'))
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'ceo_admin' THEN 1 WHEN 'coo_ops' THEN 2 WHEN 'accountant' THEN 3 END LIMIT 1
$function$;

-- 2. Super-admin-only RPCs ----------------------------------------------------
-- Rewrites the role check inside each function body; fails loudly if the
-- expected text is not found (i.e. the function drifted from what we audited).
DO $$
DECLARE
  r record;
  v_def text;
  v_new text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('public.cancel_invoice(uuid,text)',            'has_role(v_uid, ''ceo_admin'')',   'Only CEO can cancel invoices',   'Only Super Admin can cancel invoices'),
      ('public.cancel_paysheet(uuid,text,boolean)',   'has_role(v_uid, ''ceo_admin'')',   'Only CEO can cancel paysheets',  'Only Super Admin can cancel paysheets'),
      ('public.recreate_invoice(uuid)',               'has_role(v_uid, ''ceo_admin'')',   'Only CEO can re-create invoices','Only Super Admin can re-create invoices'),
      ('public.recreate_paysheet(uuid)',              'has_role(v_uid, ''ceo_admin'')',   'Only CEO can re-create paysheets','Only Super Admin can re-create paysheets'),
      ('public.wipe_sandbox()',                       'has_role(auth.uid(),''ceo_admin'')','Only CEO can wipe sandbox',      'Only Super Admin can wipe sandbox')
    ) AS t(fn, old_check, old_msg, new_msg)
  LOOP
    v_def := pg_get_functiondef(r.fn::regprocedure);
    IF position(r.old_check IN v_def) = 0 THEN
      RAISE EXCEPTION 'super_admin migration: role check not found in %', r.fn;
    END IF;
    v_new := replace(v_def, r.old_check, replace(r.old_check, 'ceo_admin', 'super_admin'));
    v_new := replace(v_new, r.old_msg, r.new_msg);
    EXECUTE v_new;
  END LOOP;
END $$;

-- 3. Notification recipients also include super_admin -------------------------
DO $$
DECLARE
  fn text;
  v_def text;
  v_new text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.apply_advance_deductions_on_approve(uuid)',
    'public.mark_contract_status_and_notify()',
    'public.mark_overdue_invoices()',
    'public.notify_payment_received()',
    'public.notify_paysheet_submitted()',
    'public.run_compliance_daily_checks()'
  ] LOOP
    v_def := pg_get_functiondef(fn::regprocedure);
    v_new := replace(v_def, 'role IN (''ceo_admin''', 'role IN (''super_admin'',''ceo_admin''');
    IF v_new = v_def THEN
      RAISE EXCEPTION 'super_admin migration: recipient list not found in %', fn;
    END IF;
    EXECUTE v_new;
  END LOOP;
END $$;

-- 4. RLS: system-administration tables become super_admin only ----------------
ALTER POLICY "Admins read audit" ON public.audit_logs
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));

ALTER POLICY "CEO read backup logs" ON public.backup_logs
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
ALTER POLICY "CEO read backup logs" ON public.backup_logs RENAME TO "Super admin read backup logs";

ALTER POLICY "CEO read activity log" ON public.user_activity_log
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
ALTER POLICY "CEO read activity log" ON public.user_activity_log RENAME TO "Super admin read activity log";

ALTER POLICY "CEO read cron_secrets" ON public.cron_secrets
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
ALTER POLICY "CEO read cron_secrets" ON public.cron_secrets RENAME TO "Super admin read cron_secrets";

ALTER POLICY "CEO insert app_config" ON public.app_config
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
ALTER POLICY "CEO insert app_config" ON public.app_config RENAME TO "Super admin insert app_config";
ALTER POLICY "CEO update app_config" ON public.app_config
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
ALTER POLICY "CEO update app_config" ON public.app_config RENAME TO "Super admin update app_config";

ALTER POLICY "Admins insert permissions" ON public.role_permissions
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
ALTER POLICY "Admins update permissions" ON public.role_permissions
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));

ALTER POLICY "Admins insert profiles" ON public.user_profiles
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
ALTER POLICY "Admins update all profiles" ON public.user_profiles
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));

ALTER POLICY "Admins manage roles" ON public.user_roles
  USING (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND is_active_user(auth.uid()));
