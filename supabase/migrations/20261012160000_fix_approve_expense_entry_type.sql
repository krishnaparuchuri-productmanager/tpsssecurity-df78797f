-- Expenses: approval wrote ledger entry_type 'debit', which is not a value of
-- ledger_entry_type (receipt, payment, journal, contra), so every approval —
-- from the list or via "Submit as Approved" — failed with
--   invalid input value for enum ledger_entry_type: "debit".
-- An approved expense is money paid out: use 'payment', as record_expense()
-- and record_compliance_payment() already do.

CREATE OR REPLACE FUNCTION public.approve_expense(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  e RECORD;
  v_cat RECORD;
  v_ledger_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_role(v_uid, 'ceo_admin'::app_role)
       OR public.has_role(v_uid, 'coo_ops'::app_role)
       OR public.has_role(v_uid, 'accountant'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized to approve expenses';
  END IF;

  SELECT * INTO e FROM public.expenses WHERE id = _id AND is_deleted = false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF e.status <> 'draft' THEN RAISE EXCEPTION 'Only draft expenses can be approved'; END IF;

  IF e.recorded_by = v_uid AND NOT public.has_role(v_uid, 'ceo_admin'::app_role) THEN
    RAISE EXCEPTION 'Cannot approve your own expense (segregation of duties)';
  END IF;

  SELECT * INTO v_cat FROM public.expense_categories WHERE id = e.category_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense category not found'; END IF;

  INSERT INTO public.financial_ledger (
    voucher_number, entry_date, entry_type, category, particulars,
    debit_amount, credit_amount, reference_id, reference_type, created_by, is_sandbox
  ) VALUES (
    e.expense_number, e.expense_date, 'payment', v_cat.ledger_category,
    v_cat.category_name || ' — ' || e.description,
    e.amount, 0, e.id, 'expense', v_uid, e.is_sandbox
  ) RETURNING id INTO v_ledger_id;

  UPDATE public.expenses
     SET status = 'approved', approved_by = v_uid, approved_at = now(),
         ledger_entry_id = v_ledger_id, updated_at = now()
   WHERE id = _id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'APPROVE', 'expenses', _id, jsonb_build_object('ledger_entry_id', v_ledger_id));
END;
$function$;
