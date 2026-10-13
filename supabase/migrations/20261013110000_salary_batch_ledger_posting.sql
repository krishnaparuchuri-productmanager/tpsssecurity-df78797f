-- OF-04: salary paid through Bank Payment now posts to the ledger (Cash Book)
-- as a 'payment' in category 'staff_salary'. Owner decision 2026-10-13:
-- salary batches post; invoices stay off the cash book.

CREATE OR REPLACE FUNCTION public.post_salary_batch_to_ledger(_batch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b public.bank_payment_batches%ROWTYPE;
  v_date date;
  v_balance numeric;
BEGIN
  SELECT * INTO b FROM public.bank_payment_batches WHERE id = _batch_id;
  IF b.id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.financial_ledger
             WHERE reference_id = _batch_id AND reference_type = 'salary_batch' AND is_deleted = false) THEN
    RETURN; -- already posted
  END IF;
  v_date := COALESCE(b.created_at::date, CURRENT_DATE);
  SELECT COALESCE(MAX(balance_after), 0) INTO v_balance FROM public.financial_ledger
   WHERE entry_date <= v_date AND is_sandbox = b.is_sandbox AND is_deleted = false;
  INSERT INTO public.financial_ledger
    (voucher_number, entry_date, entry_type, category, particulars,
     debit_amount, credit_amount, balance_after, reference_id, reference_type, created_by, is_sandbox)
  VALUES (public.gen_voucher_number(v_date), v_date, 'payment', 'staff_salary',
     'Salary paid — batch ' || b.batch_number || ' (' || b.month || ', ' || COALESCE(b.client_names, '') || ')',
     b.total_amount, 0, v_balance - b.total_amount, b.id, 'salary_batch', b.generated_by, b.is_sandbox);
END;
$function$;

REVOKE ALL ON FUNCTION public.post_salary_batch_to_ledger(uuid) FROM PUBLIC, anon, authenticated;

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
  PERFORM public.post_salary_batch_to_ledger(v_batch_id);

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'CREATE', 'bank_payment_batches', v_batch_id,
          jsonb_build_object('batch_number', _batch->>'batch_number', 'records', v_n,
                             'total_amount', _batch->>'total_amount'));

  RETURN jsonb_build_object('id', v_batch_id, 'records', v_n);
END;
$function$;

-- Post batches recorded before this change.
SELECT public.post_salary_batch_to_ledger(id) FROM public.bank_payment_batches;
