
CREATE OR REPLACE FUNCTION public.confirm_uniform_advance(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_rec uniform_advance_confirmations%ROWTYPE;
  v_current_balance NUMERIC;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT (public.has_role(v_uid, 'ceo_admin') OR public.has_role(v_uid, 'coo_ops') OR public.has_role(v_uid, 'accountant')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO v_rec FROM uniform_advance_confirmations WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found or already confirmed'; END IF;
  SELECT uniform_advance_balance INTO v_current_balance FROM employees WHERE id = v_rec.employee_id FOR UPDATE;
  UPDATE uniform_advance_confirmations
  SET status = 'confirmed',
      confirmed_by = v_uid,
      confirmed_at = now(),
      balance_before = v_current_balance,
      balance_after = GREATEST(0, v_current_balance - v_rec.deduction_amount)
  WHERE id = _id;
  UPDATE employees
  SET uniform_advance_balance = GREATEST(0, v_current_balance - v_rec.deduction_amount)
  WHERE id = v_rec.employee_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalise_payment_batch(_batch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT (public.has_role(v_uid, 'ceo_admin') OR public.has_role(v_uid, 'coo_ops') OR public.has_role(v_uid, 'accountant')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  WITH batch_emps AS (
    SELECT DISTINCT paysheet_employee_id
    FROM bank_payment_records
    WHERE batch_id = _batch_id
  ),
  totals AS (
    SELECT r.paysheet_employee_id, COALESCE(SUM(r.amount_in_batch), 0) AS total_paid
    FROM bank_payment_records r
    WHERE r.paysheet_employee_id IN (SELECT paysheet_employee_id FROM batch_emps)
    GROUP BY r.paysheet_employee_id
  )
  UPDATE paysheet_employees pe
  SET
    amount_paid = t.total_paid,
    payment_status = CASE
      WHEN t.total_paid >= pe.final_net_salary THEN 'paid'
      WHEN t.total_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END
  FROM totals t
  WHERE pe.id = t.paysheet_employee_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_create_uniform_advance_confirmations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO uniform_advance_confirmations (
      paysheet_id, paysheet_employee_id, employee_id, employee_name,
      client_id, client_name, month_date, month, deduction_amount, is_sandbox
    )
    SELECT
      pe.paysheet_id, pe.id, pe.employee_id, pe.employee_name,
      ps.client_id, c.client_name, ps.month_date, ps.month,
      pe.uniform_advance_deduction, ps.is_sandbox
    FROM paysheet_employees pe
    JOIN paysheets ps ON ps.id = pe.paysheet_id
    LEFT JOIN clients c ON c.id = ps.client_id
    WHERE pe.paysheet_id = NEW.id
      AND pe.uniform_advance_deduction > 0
      AND pe.employee_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM uniform_advance_confirmations uac
        WHERE uac.paysheet_employee_id = pe.id
      );
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.compute_ffs(jsonb) SET search_path TO 'public';
ALTER FUNCTION public.save_ffs(jsonb) SET search_path TO 'public';

REVOKE EXECUTE ON FUNCTION public.cancel_invoice(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_paysheet(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_uniform_advance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalise_payment_batch(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recreate_invoice(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recreate_paysheet(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.trg_create_uniform_advance_confirmations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_paysheet_employees_status() FROM PUBLIC;

