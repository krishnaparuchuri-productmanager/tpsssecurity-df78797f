
-- =========================================================
-- 1) user_activity_log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  activity_type text NOT NULL,
  page_url text,
  ip_address text,
  device_info text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_activity_log_type_check CHECK (
    activity_type IN ('login','logout','login_failed','page_view','export','approve','reject','create','update','delete')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_created ON public.user_activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_type_created ON public.user_activity_log (activity_type, created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CEO read activity log" ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin'::app_role) AND public.is_active_user(auth.uid()));

CREATE POLICY "Deny direct insert activity log" ON public.user_activity_log
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Deny direct update activity log" ON public.user_activity_log
  FOR UPDATE TO anon, authenticated USING (false);

CREATE POLICY "Deny direct delete activity log" ON public.user_activity_log
  FOR DELETE TO anon, authenticated USING (false);

-- =========================================================
-- 2) RPCs for activity log
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_activity(
  _type text,
  _page_url text DEFAULT NULL,
  _ip text DEFAULT NULL,
  _device text DEFAULT NULL,
  _details jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.user_activity_log (user_id, activity_type, page_url, ip_address, device_info, details)
  VALUES (auth.uid(), _type, _page_url, _ip, _device, _details)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_activity(text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text,text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_failed_login(
  _email text,
  _ip text DEFAULT NULL,
  _device text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_count integer;
BEGIN
  SELECT id INTO v_user FROM public.user_profiles WHERE lower(email) = lower(_email) LIMIT 1;
  INSERT INTO public.user_activity_log (user_id, activity_type, ip_address, device_info, details)
  VALUES (v_user, 'login_failed', _ip, _device, jsonb_build_object('email', _email));
  IF v_user IS NULL THEN RETURN 0; END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.user_activity_log
  WHERE user_id = v_user AND activity_type = 'login_failed' AND created_at > now() - interval '1 hour';
  IF v_count > 5 THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, new_values)
    VALUES (v_user, 'SECURITY_ALERT', 'user_activity_log',
            jsonb_build_object('email', _email, 'ip', _ip, 'count', v_count, 'window', '1h'));
  END IF;
  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_failed_login(text,text,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.log_failed_login(text,text,text) TO anon, authenticated;

-- =========================================================
-- 3) invoices.branch_id + auto-fill trigger
-- =========================================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS branch_id uuid;

CREATE INDEX IF NOT EXISTS idx_invoices_branch ON public.invoices(branch_id);

UPDATE public.invoices i
SET branch_id = c.branch_id
FROM public.clients c
WHERE i.client_id = c.id AND i.branch_id IS NULL AND c.branch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_invoice_branch_from_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.branch_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT branch_id INTO NEW.branch_id FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_invoice_branch ON public.invoices;
CREATE TRIGGER trg_set_invoice_branch
  BEFORE INSERT OR UPDATE OF client_id ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_branch_from_client();

-- =========================================================
-- 4) Branch summary RPC (CEO only)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_branch_summary()
RETURNS TABLE (
  branch_id uuid, branch_name text, branch_code text, is_head_office boolean,
  client_count bigint, employee_count bigint, active_deployment_count bigint,
  month_billing numeric, month_outstanding numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
DECLARE v_month_start date := date_trunc('month', CURRENT_DATE)::date;
DECLARE v_month_end date := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'ceo_admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    b.id, b.branch_name, b.branch_code, b.is_head_office,
    (SELECT COUNT(*) FROM public.clients c WHERE c.branch_id = b.id AND c.is_deleted = false AND c.is_active = true),
    (SELECT COUNT(*) FROM public.employees e WHERE e.branch_id = b.id AND e.is_deleted = false AND e.status = 'Active'),
    (SELECT COUNT(*) FROM public.employee_deployments d
       JOIN public.clients c ON c.id = d.client_id
       WHERE c.branch_id = b.id AND d.is_current = true AND d.is_deleted = false),
    COALESCE((SELECT SUM(billing_amount) FROM public.invoices i
       WHERE i.branch_id = b.id AND i.is_deleted = false
         AND i.month_date BETWEEN v_month_start AND v_month_end), 0),
    COALESCE((SELECT SUM(outstanding_amount) FROM public.invoices i
       WHERE i.branch_id = b.id AND i.is_deleted = false), 0)
  FROM public.branches b
  WHERE b.is_deleted = false
  ORDER BY b.is_head_office DESC, b.branch_name;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_branch_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_branch_summary() TO authenticated;

-- =========================================================
-- 5) MoM metric series RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.mom_metric_series(
  _metric text,
  _branch_id uuid DEFAULT NULL,
  _client_id uuid DEFAULT NULL,
  _months integer DEFAULT 12
)
RETURNS TABLE (month_label text, month_start date, value numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start date := (date_trunc('month', CURRENT_DATE) - make_interval(months => _months - 1))::date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(v_start, date_trunc('month', CURRENT_DATE)::date, '1 month')::date AS m
  )
  SELECT to_char(m, 'Mon YYYY')::text, m,
    CASE _metric
      WHEN 'billing' THEN COALESCE((SELECT SUM(billing_amount) FROM public.invoices i
         WHERE i.is_deleted = false AND date_trunc('month', i.month_date)::date = m
           AND (_branch_id IS NULL OR i.branch_id = _branch_id)
           AND (_client_id IS NULL OR i.client_id = _client_id)),0)
      WHEN 'received' THEN COALESCE((SELECT SUM(amount_received) FROM public.invoices i
         WHERE i.is_deleted = false AND date_trunc('month', i.month_date)::date = m
           AND (_branch_id IS NULL OR i.branch_id = _branch_id)
           AND (_client_id IS NULL OR i.client_id = _client_id)),0)
      WHEN 'outstanding' THEN COALESCE((SELECT SUM(outstanding_amount) FROM public.invoices i
         WHERE i.is_deleted = false AND date_trunc('month', i.month_date)::date = m
           AND (_branch_id IS NULL OR i.branch_id = _branch_id)
           AND (_client_id IS NULL OR i.client_id = _client_id)),0)
      WHEN 'employees' THEN COALESCE((SELECT SUM(total_employees) FROM public.paysheets p
         WHERE p.is_deleted = false AND date_trunc('month', p.month_date)::date = m
           AND (_client_id IS NULL OR p.client_id = _client_id)
           AND (_branch_id IS NULL OR p.client_id IN (SELECT id FROM public.clients WHERE branch_id = _branch_id))),0)
      WHEN 'epf' THEN COALESCE((SELECT SUM(total_epf_employee + total_epf_employer) FROM public.paysheets p
         WHERE p.is_deleted = false AND date_trunc('month', p.month_date)::date = m
           AND (_client_id IS NULL OR p.client_id = _client_id)
           AND (_branch_id IS NULL OR p.client_id IN (SELECT id FROM public.clients WHERE branch_id = _branch_id))),0)
      WHEN 'esi' THEN COALESCE((SELECT SUM(total_esi_employee + total_esi_employer) FROM public.paysheets p
         WHERE p.is_deleted = false AND date_trunc('month', p.month_date)::date = m
           AND (_client_id IS NULL OR p.client_id = _client_id)
           AND (_branch_id IS NULL OR p.client_id IN (SELECT id FROM public.clients WHERE branch_id = _branch_id))),0)
      WHEN 'net_salary' THEN COALESCE((SELECT SUM(total_net_salary) FROM public.paysheets p
         WHERE p.is_deleted = false AND date_trunc('month', p.month_date)::date = m
           AND (_client_id IS NULL OR p.client_id = _client_id)
           AND (_branch_id IS NULL OR p.client_id IN (SELECT id FROM public.clients WHERE branch_id = _branch_id))),0)
      WHEN 'expenses' THEN COALESCE((SELECT SUM(amount) FROM public.expenses e
         WHERE e.is_deleted = false AND e.status = 'approved'
           AND date_trunc('month', e.expense_date)::date = m
           AND (_branch_id IS NULL OR e.branch_id = _branch_id)),0)
      ELSE 0
    END
  FROM months;
END $$;

REVOKE EXECUTE ON FUNCTION public.mom_metric_series(text,uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mom_metric_series(text,uuid,uuid,integer) TO authenticated;

-- =========================================================
-- 6) Permissions seed
-- =========================================================
INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export)
VALUES
  ('ceo_admin','reports_mom',true,false,false,false,false,true),
  ('coo_ops','reports_mom',true,false,false,false,false,true),
  ('accountant','reports_mom',true,false,false,false,false,false),
  ('ceo_admin','reports_comparative',true,false,false,false,false,true),
  ('coo_ops','reports_comparative',true,false,false,false,false,true),
  ('accountant','reports_comparative',true,false,false,false,false,false),
  ('ceo_admin','reports_client_history',true,false,false,false,false,true),
  ('coo_ops','reports_client_history',true,false,false,false,false,true),
  ('accountant','reports_client_history',true,false,false,false,false,true),
  ('ceo_admin','reports_employee_history',true,false,false,false,false,true),
  ('coo_ops','reports_employee_history',true,false,false,false,false,true),
  ('accountant','reports_employee_history',true,false,false,false,false,true),
  ('ceo_admin','reports_annual',true,false,false,false,false,true),
  ('accountant','reports_annual',true,false,false,false,false,true),
  ('ceo_admin','activity_log',true,false,false,false,false,true),
  ('ceo_admin','branch_summary',true,false,false,false,false,true),
  ('ceo_admin','branches_admin',true,true,true,false,false,true)
ON CONFLICT (role, screen_name) DO NOTHING;
