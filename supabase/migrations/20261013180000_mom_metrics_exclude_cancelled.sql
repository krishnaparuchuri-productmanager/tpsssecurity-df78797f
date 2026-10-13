-- MoM / Comparative metrics counted cancelled invoices and paysheets
-- (e.g. a cancelled-and-recreated invoice was billed twice). Exclude them.
CREATE OR REPLACE FUNCTION public.mom_metric_series(_metric text, _branch_id uuid DEFAULT NULL::uuid, _client_id uuid DEFAULT NULL::uuid, _months integer DEFAULT 12)
 RETURNS TABLE(month_label text, month_start date, value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start date := (date_trunc('month', CURRENT_DATE) - make_interval(months => _months - 1))::date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(v_start, date_trunc('month', CURRENT_DATE)::date, '1 month')::date AS m
  ),
  inv AS (
    SELECT * FROM public.invoices i
     WHERE i.is_deleted = false AND i.status <> 'cancelled'
       AND (_branch_id IS NULL OR i.branch_id = _branch_id)
       AND (_client_id IS NULL OR i.client_id = _client_id)
  ),
  ps AS (
    SELECT * FROM public.paysheets p
     WHERE p.is_deleted = false AND p.status <> 'cancelled'
       AND (_client_id IS NULL OR p.client_id = _client_id)
       AND (_branch_id IS NULL OR p.client_id IN (SELECT id FROM public.clients WHERE branch_id = _branch_id))
  )
  SELECT to_char(m, 'Mon YYYY')::text, m,
    CASE _metric
      WHEN 'billing' THEN COALESCE((SELECT SUM(billing_amount) FROM inv WHERE date_trunc('month', inv.month_date)::date = m),0)
      WHEN 'received' THEN COALESCE((SELECT SUM(amount_received) FROM inv WHERE date_trunc('month', inv.month_date)::date = m),0)
      WHEN 'outstanding' THEN COALESCE((SELECT SUM(outstanding_amount) FROM inv WHERE date_trunc('month', inv.month_date)::date = m),0)
      WHEN 'employees' THEN COALESCE((SELECT SUM(total_employees) FROM ps WHERE date_trunc('month', ps.month_date)::date = m),0)
      WHEN 'epf' THEN COALESCE((SELECT SUM(total_epf_employee + total_epf_employer) FROM ps WHERE date_trunc('month', ps.month_date)::date = m),0)
      WHEN 'esi' THEN COALESCE((SELECT SUM(total_esi_employee + total_esi_employer) FROM ps WHERE date_trunc('month', ps.month_date)::date = m),0)
      WHEN 'net_salary' THEN COALESCE((SELECT SUM(total_net_salary) FROM ps WHERE date_trunc('month', ps.month_date)::date = m),0)
      WHEN 'expenses' THEN COALESCE((SELECT SUM(amount) FROM public.expenses e
         WHERE e.is_deleted = false AND e.status = 'approved'
           AND date_trunc('month', e.expense_date)::date = m
           AND (_branch_id IS NULL OR e.branch_id = _branch_id)),0)
      ELSE 0
    END
  FROM months;
END $function$;
