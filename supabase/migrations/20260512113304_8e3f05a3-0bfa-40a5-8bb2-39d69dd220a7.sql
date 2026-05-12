
-- 1) Add 'cancelled' to enums
ALTER TYPE public.paysheet_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2) New columns on paysheets and invoices
ALTER TABLE public.paysheets
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS replaced_by_id uuid,
  ADD COLUMN IF NOT EXISTS replaces_id uuid;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS replaced_by_id uuid,
  ADD COLUMN IF NOT EXISTS replaces_id uuid;

-- 3) Update paysheet guard to also block edits on cancelled paysheets
CREATE OR REPLACE FUNCTION public.guard_paysheet_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  is_acc boolean := public.has_role(uid,'accountant');
  is_ceo boolean := public.has_role(uid,'ceo_admin');
  is_coo boolean := public.has_role(uid,'coo_ops');
BEGIN
  IF NEW.status = 'approved' AND is_acc AND NOT is_ceo AND NOT is_coo THEN
    RAISE EXCEPTION 'Accountants cannot approve paysheets';
  END IF;
  IF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL AND NEW.submitted_by IS NOT NULL
     AND NEW.approved_by = NEW.submitted_by THEN
    RAISE EXCEPTION 'Cannot approve own submission';
  END IF;
  -- Cancelled is terminal: only allow setting replaced_by_id, nothing else
  IF TG_OP = 'UPDATE' AND OLD.status = 'cancelled' THEN
    IF NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Cancelled paysheets are immutable';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('submitted','approved','rejected') AND is_acc
     AND NOT is_ceo AND NOT is_coo
     AND NEW.status NOT IN ('draft')
     AND OLD.status <> 'rejected' THEN
    IF NOT (OLD.status='rejected' AND NEW.status='draft') THEN
      RAISE EXCEPTION 'Submitted paysheets cannot be edited by accountant';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 4) cancel_invoice RPC
CREATE OR REPLACE FUNCTION public.cancel_invoice(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv record;
  v_receipt_count int;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.has_role(v_uid, 'ceo_admin') THEN
    RAISE EXCEPTION 'Only CEO can cancel invoices';
  END IF;
  IF coalesce(length(trim(_reason)),0) < 10 THEN
    RAISE EXCEPTION 'Cancellation reason must be at least 10 characters';
  END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = _id AND is_deleted = false FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_inv.status = 'cancelled' THEN RAISE EXCEPTION 'Invoice already cancelled'; END IF;

  SELECT count(*) INTO v_receipt_count
    FROM public.payments
    WHERE invoice_id = _id AND is_deleted = false;
  IF v_receipt_count > 0 THEN
    RAISE EXCEPTION 'RECEIPTS_EXIST: Reverse all receipts before cancelling';
  END IF;

  -- Reverse any ledger entries posted for this invoice
  INSERT INTO public.financial_ledger
    (entry_date, entry_type, category, particulars, client_id,
     debit_amount, credit_amount, balance_after,
     reference_id, reference_type, voucher_number,
     created_by, is_sandbox)
  SELECT CURRENT_DATE, entry_type, category,
         'REVERSAL: ' || particulars || ' (Invoice cancelled: ' || _reason || ')',
         client_id, credit_amount, debit_amount, 0,
         _id, 'invoice_cancellation',
         'REV-' || voucher_number,
         v_uid, is_sandbox
  FROM public.financial_ledger
  WHERE reference_id = _id AND reference_type = 'invoice' AND is_deleted = false;

  -- Close any open follow-ups
  UPDATE public.invoice_followups
     SET status = 'closed', closed_reason = 'invoice_cancelled', updated_at = now()
   WHERE invoice_id = _id AND status <> 'closed' AND is_deleted = false;

  -- Mark cancelled
  UPDATE public.invoices
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancellation_reason = _reason,
         updated_at = now()
   WHERE id = _id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'CANCEL_INVOICE', 'invoices', _id,
          jsonb_build_object('reason', _reason, 'invoice_number', v_inv.invoice_number));
END $$;

REVOKE ALL ON FUNCTION public.cancel_invoice(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_invoice(uuid, text) TO authenticated;

-- 5) cancel_paysheet RPC
CREATE OR REPLACE FUNCTION public.cancel_paysheet(_id uuid, _reason text, _cascade_invoice boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ps record;
  v_inv_id uuid;
  v_inv_status text;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.has_role(v_uid, 'ceo_admin') THEN
    RAISE EXCEPTION 'Only CEO can cancel paysheets';
  END IF;
  IF coalesce(length(trim(_reason)),0) < 10 THEN
    RAISE EXCEPTION 'Cancellation reason must be at least 10 characters';
  END IF;

  SELECT * INTO v_ps FROM public.paysheets WHERE id = _id AND is_deleted = false FOR UPDATE;
  IF v_ps.id IS NULL THEN RAISE EXCEPTION 'Paysheet not found'; END IF;
  IF v_ps.status = 'cancelled' THEN RAISE EXCEPTION 'Paysheet already cancelled'; END IF;
  IF v_ps.status NOT IN ('submitted','approved','rejected','draft') THEN
    RAISE EXCEPTION 'Cannot cancel paysheet in status %', v_ps.status;
  END IF;

  -- Linked invoice handling
  SELECT id, status::text INTO v_inv_id, v_inv_status
    FROM public.invoices
   WHERE paysheet_id = _id AND is_deleted = false AND status <> 'cancelled'
   ORDER BY created_at DESC LIMIT 1;

  IF v_inv_id IS NOT NULL THEN
    IF NOT _cascade_invoice THEN
      RAISE EXCEPTION 'LINKED_INVOICE_EXISTS: Linked invoice must be cancelled first';
    END IF;
    PERFORM public.cancel_invoice(v_inv_id, _reason);
  END IF;

  UPDATE public.paysheets
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_uid,
         cancellation_reason = _reason,
         updated_at = now()
   WHERE id = _id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'CANCEL_PAYSHEET', 'paysheets', _id,
          jsonb_build_object('reason', _reason,
                             'paysheet_number', v_ps.paysheet_number,
                             'cascaded_invoice_id', v_inv_id));
END $$;

REVOKE ALL ON FUNCTION public.cancel_paysheet(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_paysheet(uuid, text, boolean) TO authenticated;

-- 6) recreate_invoice
CREATE OR REPLACE FUNCTION public.recreate_invoice(_old_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old record;
  v_new_id uuid;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.has_role(v_uid, 'ceo_admin') THEN
    RAISE EXCEPTION 'Only CEO can re-create invoices';
  END IF;

  SELECT * INTO v_old FROM public.invoices WHERE id = _old_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Original invoice not found'; END IF;
  IF v_old.status <> 'cancelled' THEN RAISE EXCEPTION 'Only cancelled invoices can be re-created'; END IF;
  IF v_old.replaced_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already re-created as another invoice';
  END IF;

  INSERT INTO public.invoices (
    client_id, paysheet_id, branch_id,
    invoice_number, invoice_date, month, month_date,
    service_period_from, service_period_to,
    billing_lines, deduction_rows,
    tds_percentage, gst_applicable, gst_rcm, gst_percentage,
    invoice_notes, template_config,
    po_number, po_date,
    status, is_sandbox, created_by, replaces_id
  ) VALUES (
    v_old.client_id, v_old.paysheet_id, v_old.branch_id,
    '', CURRENT_DATE, v_old.month, v_old.month_date,
    v_old.service_period_from, v_old.service_period_to,
    v_old.billing_lines, v_old.deduction_rows,
    v_old.tds_percentage, v_old.gst_applicable, v_old.gst_rcm, v_old.gst_percentage,
    v_old.invoice_notes, v_old.template_config,
    v_old.po_number, v_old.po_date,
    'draft', v_old.is_sandbox, v_uid, _old_id
  ) RETURNING id INTO v_new_id;

  UPDATE public.invoices SET replaced_by_id = v_new_id WHERE id = _old_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'RECREATE_INVOICE', 'invoices', v_new_id,
          jsonb_build_object('replaces_id', _old_id));

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.recreate_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recreate_invoice(uuid) TO authenticated;

-- 7) recreate_paysheet
CREATE OR REPLACE FUNCTION public.recreate_paysheet(_old_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_old record;
  v_new_id uuid;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.has_role(v_uid, 'ceo_admin') THEN
    RAISE EXCEPTION 'Only CEO can re-create paysheets';
  END IF;

  SELECT * INTO v_old FROM public.paysheets WHERE id = _old_id;
  IF v_old.id IS NULL THEN RAISE EXCEPTION 'Original paysheet not found'; END IF;
  IF v_old.status <> 'cancelled' THEN RAISE EXCEPTION 'Only cancelled paysheets can be re-created'; END IF;
  IF v_old.replaced_by_id IS NOT NULL THEN
    RAISE EXCEPTION 'Already re-created as another paysheet';
  END IF;

  INSERT INTO public.paysheets (
    client_id, branch_id, month, month_date,
    status, is_sandbox, created_by, replaces_id, paysheet_number
  ) VALUES (
    v_old.client_id, v_old.branch_id, v_old.month, v_old.month_date,
    'draft', v_old.is_sandbox, v_uid, _old_id, ''
  ) RETURNING id INTO v_new_id;

  -- Copy employee rows
  INSERT INTO public.paysheet_employees (
    paysheet_id, employee_id, uan_number, esi_number,
    employee_name, designation, basic, da, ta,
    four_hour_ot, weekly_off, bonus, relieving_charges, leave_wages,
    conveyance_allowance, washing_allowance,
    no_of_duties
  )
  SELECT v_new_id, employee_id, uan_number, esi_number,
         employee_name, designation, basic, da, ta,
         four_hour_ot, weekly_off, bonus, relieving_charges, leave_wages,
         conveyance_allowance, washing_allowance,
         no_of_duties
    FROM public.paysheet_employees
   WHERE paysheet_id = _old_id;

  UPDATE public.paysheets SET replaced_by_id = v_new_id WHERE id = _old_id;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'RECREATE_PAYSHEET', 'paysheets', v_new_id,
          jsonb_build_object('replaces_id', _old_id));

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.recreate_paysheet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recreate_paysheet(uuid) TO authenticated;
