
DROP FUNCTION IF EXISTS public.approve_expense(uuid);

CREATE FUNCTION public.approve_expense(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    e.expense_number, e.expense_date, 'debit', v_cat.ledger_category,
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
$$;

GRANT EXECUTE ON FUNCTION public.approve_expense(uuid) TO authenticated;

-- Lock down anon-callable SECURITY DEFINER functions
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;
