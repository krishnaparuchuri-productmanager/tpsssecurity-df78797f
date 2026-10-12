-- Bank Payment: record a batch atomically and let it mark employees paid.
--
-- Problems (pre-existing, both environments):
-- 1. guard_paysheet_employees_status() rejects ANY change to rows of an
--    approved paysheet, including the payment-tracking columns
--    (amount_paid, payment_status) that finalise_payment_batch() maintains,
--    so finalising always failed: "Cannot modify paysheet_employees: parent
--    paysheet is approved".
-- 2. The screen wrote batch, records and finalise as three separate calls, so a
--    failure part-way left an orphan batch.
--
-- Fix:
-- * Approved rows stay frozen except amount_paid / payment_status, and only
--   while finalise_payment_batch() is running (transaction-local flag).
-- * record_payment_batch(_batch, _records) inserts the batch + records and
--   finalises in one transaction. Direct inserts are denied again, so this RPC
--   is the only write path (supersedes 20261012130000).

-- 1. Guard: allow payment-tracking updates from the finalise step only --------
CREATE OR REPLACE FUNCTION public.guard_paysheet_employees_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent_status text;
  parent_id uuid;
BEGIN
  parent_id := COALESCE(NEW.paysheet_id, OLD.paysheet_id);
  IF parent_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT status::text INTO parent_status FROM public.paysheets WHERE id = parent_id;
  IF parent_status = 'approved' THEN
    IF TG_OP = 'UPDATE'
       AND current_setting('app.payment_finalise', true) = 'on'
       AND (to_jsonb(NEW) - 'amount_paid' - 'payment_status' - 'updated_at')
         = (to_jsonb(OLD) - 'amount_paid' - 'payment_status' - 'updated_at') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify paysheet_employees: parent paysheet is approved';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2. Finalise: raise the flag for the duration of the transaction ------------
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

  PERFORM set_config('app.payment_finalise', 'on', true);

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

  PERFORM set_config('app.payment_finalise', 'off', true);
END;
$function$;

-- 3. Atomic record + finalise ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_payment_batch(_batch jsonb, _records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_batch_id uuid;
  v_n int;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT (public.has_role(v_uid, 'ceo_admin') OR public.has_role(v_uid, 'coo_ops') OR public.has_role(v_uid, 'accountant')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF jsonb_typeof(_records) <> 'array' OR jsonb_array_length(_records) = 0 THEN
    RAISE EXCEPTION 'Select at least one employee for payment';
  END IF;

  INSERT INTO public.bank_payment_batches (
    batch_number, month, month_date, client_names, debit_account_id, debit_account_number,
    total_employees, total_amount, generated_by, is_sandbox
  ) VALUES (
    _batch->>'batch_number', _batch->>'month', (_batch->>'month_date')::date, _batch->>'client_names',
    NULLIF(_batch->>'debit_account_id','')::uuid, _batch->>'debit_account_number',
    (_batch->>'total_employees')::int, (_batch->>'total_amount')::numeric, v_uid,
    COALESCE((_batch->>'is_sandbox')::boolean, public.is_sandbox_env())
  ) RETURNING id INTO v_batch_id;

  INSERT INTO public.bank_payment_records (
    batch_id, paysheet_id, paysheet_employee_id, employee_id, employee_name, client_id, client_name,
    month, net_payable, amount_paid_prior, amount_in_batch, payment_identifier,
    bank_account_number, bank_ifsc, is_sandbox
  )
  SELECT v_batch_id, (r->>'paysheet_id')::uuid, (r->>'paysheet_employee_id')::uuid,
         NULLIF(r->>'employee_id','')::uuid, r->>'employee_name', NULLIF(r->>'client_id','')::uuid, r->>'client_name',
         r->>'month', (r->>'net_payable')::numeric, COALESCE((r->>'amount_paid_prior')::numeric, 0),
         (r->>'amount_in_batch')::numeric, r->>'payment_identifier',
         r->>'bank_account_number', r->>'bank_ifsc',
         COALESCE((r->>'is_sandbox')::boolean, public.is_sandbox_env())
  FROM jsonb_array_elements(_records) r;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  PERFORM public.finalise_payment_batch(v_batch_id);

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'CREATE', 'bank_payment_batches', v_batch_id,
          jsonb_build_object('batch_number', _batch->>'batch_number', 'records', v_n,
                             'total_amount', _batch->>'total_amount'));

  RETURN jsonb_build_object('id', v_batch_id, 'records', v_n);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_payment_batch(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_batch(jsonb, jsonb) TO authenticated;

-- 4. Direct inserts denied again (RPC is the only write path) -----------------
DROP POLICY IF EXISTS "Create bank_payment_batches" ON public.bank_payment_batches;
DROP POLICY IF EXISTS "Deny direct insert bank_payment_batches" ON public.bank_payment_batches;
CREATE POLICY "Deny direct insert bank_payment_batches" ON public.bank_payment_batches
  FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "Create bank_payment_records" ON public.bank_payment_records;
DROP POLICY IF EXISTS "Deny direct insert bank_payment_records" ON public.bank_payment_records;
CREATE POLICY "Deny direct insert bank_payment_records" ON public.bank_payment_records
  FOR INSERT TO anon, authenticated WITH CHECK (false);
