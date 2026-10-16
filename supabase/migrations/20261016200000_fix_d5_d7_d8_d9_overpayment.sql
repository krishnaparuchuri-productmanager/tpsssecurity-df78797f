-- Fixes found by the Phase 4 regression tests (docs/testing/TESTING_CHECKPOINT.md).
-- Same migration for sandbox and production.

-- D-5: the sandbox flag defaulted to a fixed true/false whatever database it was in
-- (e.g. an employee created in production without an explicit flag was saved as sandbox).
-- Every table now defaults to the database's own environment.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bank_payment_batches','bank_payment_records','client_billing_lines','client_wage_config','clients',
    'crm_leads','employees','financial_ledger','invoices','notifications','payments','paysheet_employees',
    'paysheets','uniform_advance_confirmations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN is_sandbox SET DEFAULT public.is_sandbox_env()', t);
  END LOOP;
END $$;

-- D-7: "Approved (post to ledger now)" always failed: the expense was inserted as approved and then
-- passed to approve_expense, which only accepts drafts. Insert as a draft, then approve (the normal
-- own-approval rule applies: only a CEO / Super Admin may approve their own expense).
CREATE OR REPLACE FUNCTION public.record_expense_v2(_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_sandbox boolean := public.is_sandbox_env();
  v_amount numeric := (_payload->>'amount')::numeric;
  v_date date := COALESCE((_payload->>'expense_date')::date, CURRENT_DATE);
  v_cat uuid := (_payload->>'category_id')::uuid;
  v_status text := COALESCE(_payload->>'status','draft');
  v_num text;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status NOT IN ('draft','approved') THEN RAISE EXCEPTION 'Status must be draft or approved'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Amount must be > 0'; END IF;
  IF v_cat IS NULL THEN RAISE EXCEPTION 'Category required'; END IF;

  v_num := public.gen_expense_number(v_date);

  INSERT INTO public.expenses(
    expense_number, expense_date, branch_id, category_id, description, amount,
    payment_mode, reference_number, receipt_url, recorded_by, status, is_sandbox
  ) VALUES (
    v_num, v_date,
    NULLIF(_payload->>'branch_id','')::uuid,
    v_cat,
    _payload->>'description',
    v_amount,
    _payload->>'payment_mode',
    _payload->>'reference_number',
    _payload->>'receipt_url',
    v_uid,
    'draft',
    v_sandbox
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'CREATE','expenses',v_id, jsonb_build_object('amount',v_amount,'status',v_status));

  IF v_status = 'approved' THEN
    PERFORM public.approve_expense(v_id);
  END IF;

  RETURN v_id;
END $function$;

-- D-9: approving a non-existent paysheet reported success.
CREATE OR REPLACE FUNCTION public.approve_paysheet(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_ps public.paysheets%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO or COO can approve';
  END IF;
  SELECT * INTO v_ps FROM public.paysheets WHERE id=_id FOR UPDATE;
  IF v_ps.id IS NULL THEN RAISE EXCEPTION 'Paysheet not found'; END IF;
  IF v_ps.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted paysheets can be approved'; END IF;
  IF v_ps.submitted_by = v_uid AND NOT public.has_role(v_uid,'ceo_admin') THEN RAISE EXCEPTION 'Cannot approve own submission'; END IF;

  UPDATE public.paysheets SET status='approved', approved_by=v_uid, approved_at=now(), updated_at=now() WHERE id=_id;

  PERFORM public.apply_advance_deductions_on_approve(_id);

  IF v_ps.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (v_ps.submitted_by, 'Paysheet approved',
      'Paysheet ' || v_ps.paysheet_number || ' has been approved.', 'paysheet', _id, v_ps.is_sandbox);
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'APPROVE','paysheets',_id, jsonb_build_object('status','approved'));
END
$function$;

-- D-8: re-creating a cancelled paysheet always failed (referenced a non-existent branch_id column,
-- omitted the required working days, left the number empty). Copies the full paysheet as a new draft.
CREATE OR REPLACE FUNCTION public.recreate_paysheet(_old_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_old public.paysheets%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.has_role(v_uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admin can re-create paysheets';
  END IF;

  SELECT * INTO v_old FROM public.paysheets WHERE id = _old_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Original paysheet not found'; END IF;
  IF v_old.status <> 'cancelled' THEN RAISE EXCEPTION 'Only cancelled paysheets can be re-created'; END IF;
  IF v_old.replaced_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already re-created as another paysheet';
  END IF;

  INSERT INTO public.paysheets (
    paysheet_number, client_id, month, month_date, total_days_in_month,
    total_employees, total_earned_wages, total_epf_employee, total_epf_employer,
    total_esi_employee, total_esi_employer, total_pt_deduction, total_advance_deductions,
    total_net_salary, anomaly_count, status, is_sandbox, created_by, replaces_id
  ) VALUES (
    public.gen_paysheet_number(v_old.month_date, v_old.is_sandbox), v_old.client_id, v_old.month, v_old.month_date,
    v_old.total_days_in_month, v_old.total_employees, v_old.total_earned_wages, v_old.total_epf_employee,
    v_old.total_epf_employer, v_old.total_esi_employee, v_old.total_esi_employer, v_old.total_pt_deduction,
    v_old.total_advance_deductions, v_old.total_net_salary, v_old.anomaly_count,
    'draft', v_old.is_sandbox, v_uid, _old_id
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.paysheet_employees (
    paysheet_id, employee_id, uan_number, esi_number, employee_name, designation,
    basic, da, ta, four_hour_ot, weekly_off, bonus, relieving_charges, leave_wages,
    conveyance_allowance, washing_allowance, uniform_allowance, spl_allowance, payable_gross,
    working_days, no_of_duties, earned_wages, epf_mw_wages, epf_wages,
    epf_employee_deduction, epf_employer_contribution, esi_wages, esi_employee_deduction, esi_employer_contribution,
    pt_deduction, net_salary, advance_deduction, uniform_advance_deduction,
    canteen_price, canteen_quantity, canteen_subsidy, canteen_total, final_net_salary,
    is_new_joiner, anomaly_flags, notes, is_sandbox
  )
  SELECT v_new_id, employee_id, uan_number, esi_number, employee_name, designation,
         basic, da, ta, four_hour_ot, weekly_off, bonus, relieving_charges, leave_wages,
         conveyance_allowance, washing_allowance, uniform_allowance, spl_allowance, payable_gross,
         working_days, no_of_duties, earned_wages, epf_mw_wages, epf_wages,
         epf_employee_deduction, epf_employer_contribution, esi_wages, esi_employee_deduction, esi_employer_contribution,
         pt_deduction, net_salary, advance_deduction, uniform_advance_deduction,
         canteen_price, canteen_quantity, canteen_subsidy, canteen_total, final_net_salary,
         is_new_joiner, anomaly_flags, notes, v_old.is_sandbox
    FROM public.paysheet_employees
   WHERE paysheet_id = _old_id AND is_deleted = false;

  UPDATE public.paysheets SET replaced_by_id = v_new_id WHERE id = _old_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'RECREATE_PAYSHEET', 'paysheets', v_new_id,
          jsonb_build_object('replaces_id', _old_id));

  RETURN v_new_id;
END $function$;

-- Owner decision 2026-10-16 (question 12): the database refuses a receipt larger than the invoice's
-- outstanding amount (the screen already blocks it). Late payments in a new financial year are recorded
-- against the original invoice as normal.
CREATE OR REPLACE FUNCTION public.handle_new_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_outstanding numeric;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Receipt amount must be positive';
  END IF;
  SELECT outstanding_amount INTO v_outstanding FROM public.invoices WHERE id = NEW.invoice_id;
  IF NEW.amount > COALESCE(v_outstanding, 0) + 0.005 THEN
    RAISE EXCEPTION 'OVERPAYMENT: receipt % exceeds the outstanding amount %', NEW.amount, COALESCE(v_outstanding, 0);
  END IF;
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := public.gen_receipt_number(NEW.payment_date, COALESCE(NEW.is_sandbox, public.is_sandbox_env()));
  END IF;
  RETURN NEW;
END $function$;
