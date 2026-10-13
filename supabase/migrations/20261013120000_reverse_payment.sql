-- OF-05: receipts can be reversed (Super Admin, reason >= 10 chars).
-- Marks the payment deleted, posts an offsetting ledger entry, recalculates the
-- invoice (received / status; outstanding via calc_invoice_fields) and audits.
-- After reversing all receipts an invoice can be cancelled as usual.

CREATE OR REPLACE FUNCTION public.reverse_payment(_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  p public.payments%ROWTYPE;
  v_inv public.invoices%ROWTYPE;
  v_received numeric;
  v_status public.invoice_status;
  v_balance numeric;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT public.has_role(v_uid, 'super_admin') THEN
    RAISE EXCEPTION 'Only Super Admin can reverse receipts';
  END IF;
  IF coalesce(length(trim(_reason)), 0) < 10 THEN
    RAISE EXCEPTION 'Reversal reason must be at least 10 characters';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id = _id FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  IF p.is_deleted THEN RAISE EXCEPTION 'Receipt already reversed'; END IF;

  SELECT * INTO v_inv FROM public.invoices WHERE id = p.invoice_id FOR UPDATE;
  IF v_inv.status = 'cancelled' THEN RAISE EXCEPTION 'Invoice is cancelled'; END IF;

  UPDATE public.payments SET is_deleted = true,
    notes = trim(both ' ' from coalesce(notes, '') || ' [REVERSED: ' || _reason || ']')
   WHERE id = _id;

  v_received := greatest(coalesce(v_inv.amount_received, 0) - p.amount, 0);
  v_status := CASE
    WHEN v_received >= v_inv.amount_receivable AND v_received > 0 THEN 'paid'
    WHEN v_received > 0 THEN 'partially_paid'
    WHEN v_inv.due_date IS NOT NULL AND v_inv.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'sent' END;
  UPDATE public.invoices SET amount_received = v_received, status = v_status, updated_at = now()
   WHERE id = v_inv.id;

  SELECT COALESCE(MAX(balance_after), 0) INTO v_balance FROM public.financial_ledger
   WHERE entry_date <= CURRENT_DATE AND is_sandbox = p.is_sandbox AND is_deleted = false;
  INSERT INTO public.financial_ledger
    (voucher_number, entry_date, entry_type, category, particulars, client_id,
     debit_amount, credit_amount, balance_after, reference_id, reference_type, created_by, is_sandbox)
  VALUES (public.gen_voucher_number(CURRENT_DATE), CURRENT_DATE, 'journal', 'payment_received',
     'REVERSAL of receipt ' || p.receipt_number || ' (' || v_inv.invoice_number || '): ' || _reason,
     p.client_id, p.amount, 0, v_balance - p.amount, p.id, 'payment_reversal', v_uid, p.is_sandbox);

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'REVERSE_PAYMENT', 'payments', _id,
          jsonb_build_object('receipt_number', p.receipt_number, 'amount', p.amount, 'reason', _reason));
END;
$function$;

REVOKE ALL ON FUNCTION public.reverse_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_payment(uuid, text) TO authenticated;
