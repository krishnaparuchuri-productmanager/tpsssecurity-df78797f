-- Invoices: amount owed is the receivable, not the internal net margin.
--
-- Bug: outstanding_amount = net_margin - amount_received, and an invoice
-- became 'paid' once amount_received >= net_margin. Net margin is the
-- receivable MINUS internal deductions (salaries, employer PF/ESI), i.e. TPSS's
-- profit — not what the client owes. Consequences:
--   * outstanding understated (82,600 invoice showed 3,156.67 due after a
--     30,000 receipt instead of 51,900),
--   * receipts capped at that figure, so a client's full payment could not be
--     recorded,
--   * Aging, Statement of Account, dashboard, follow-ups all understated dues.
--
-- Fix: outstanding = amount_receivable - amount_received; 'paid' when
-- amount_received >= amount_receivable. Net margin is unchanged (internal
-- profit figure). Existing invoices are recalculated.

CREATE OR REPLACE FUNCTION public.calc_invoice_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_billing numeric := 0; v_ded numeric := 0; ln jsonb; dr jsonb;
BEGIN
  IF NEW.billing_lines IS NOT NULL THEN
    FOR ln IN SELECT * FROM jsonb_array_elements(NEW.billing_lines) LOOP
      v_billing := v_billing + COALESCE((ln->>'amount')::numeric,
        COALESCE((ln->>'qty')::numeric,0) * COALESCE((ln->>'rate_per_month')::numeric,0));
    END LOOP; END IF;
  NEW.billing_amount := round(v_billing, 2);
  NEW.tds_amount := round(NEW.billing_amount * NEW.tds_percentage / 100, 2);
  NEW.gst_amount := CASE WHEN NEW.gst_applicable AND NOT NEW.gst_rcm
    THEN round(NEW.billing_amount * NEW.gst_percentage / 100, 2) ELSE 0 END;
  NEW.total_taxable_value := NEW.billing_amount;
  NEW.total_invoice_value := NEW.billing_amount + NEW.gst_amount;
  NEW.amount_receivable := NEW.total_invoice_value - NEW.tds_amount;
  IF NEW.deduction_rows IS NOT NULL THEN
    FOR dr IN SELECT * FROM jsonb_array_elements(NEW.deduction_rows) LOOP
      IF COALESCE((dr->>'is_enabled')::boolean, false) THEN
        v_ded := v_ded + COALESCE((dr->>'value')::numeric, 0); END IF;
    END LOOP; END IF;
  NEW.total_deductions := round(v_ded, 2);
  NEW.net_margin := NEW.amount_receivable - NEW.total_deductions;
  NEW.outstanding_amount := NEW.amount_receivable - COALESCE(NEW.amount_received,0);
  NEW.amount_in_words := public.amount_in_words_inr(NEW.total_invoice_value);
  IF TG_OP = 'INSERT' AND (NEW.invoice_number IS NULL OR NEW.invoice_number='') THEN
    NEW.invoice_number := public.gen_invoice_number(NEW.client_id, NEW.invoice_date, COALESCE(NEW.is_sandbox, public.is_sandbox_env()));
  END IF;
  IF NEW.service_period_from IS NULL THEN NEW.service_period_from := date_trunc('month', NEW.month_date)::date; END IF;
  IF NEW.service_period_to IS NULL THEN NEW.service_period_to := (date_trunc('month', NEW.month_date) + interval '1 month - 1 day')::date; END IF;
  IF NEW.due_date IS NULL THEN NEW.due_date := NEW.invoice_date + 30; END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.after_payment_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.invoices%ROWTYPE; v_received numeric; v_status public.invoice_status;
  v_balance numeric; v_voucher text;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
  v_received := COALESCE(v_inv.amount_received, 0) + NEW.amount;
  IF v_received >= v_inv.amount_receivable THEN v_status := 'paid';
  ELSIF v_received > 0 THEN v_status := 'partially_paid';
  ELSE v_status := v_inv.status; END IF;
  UPDATE public.invoices SET amount_received = v_received,
    outstanding_amount = v_inv.amount_receivable - v_received, status = v_status WHERE id = NEW.invoice_id;
  SELECT COALESCE(MAX(balance_after),0) INTO v_balance FROM public.financial_ledger
    WHERE entry_date <= NEW.payment_date AND is_sandbox = NEW.is_sandbox AND is_deleted=false;
  v_voucher := public.gen_voucher_number(NEW.payment_date);
  INSERT INTO public.financial_ledger
    (voucher_number, entry_date, entry_type, category, particulars, client_id,
     debit_amount, credit_amount, balance_after, reference_id, reference_type, created_by, is_sandbox)
  VALUES (v_voucher, NEW.payment_date, 'receipt', 'payment_received',
     'Payment received: ' || v_inv.invoice_number, NEW.client_id, 0, NEW.amount, v_balance + NEW.amount,
     NEW.id, 'payment', NEW.recorded_by, NEW.is_sandbox);
  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_values)
    VALUES (NEW.recorded_by, 'CREATE', 'payments', NEW.id, to_jsonb(NEW));
  RETURN NEW;
END $function$;

-- Recalculate existing invoices (the BEFORE UPDATE trigger recomputes
-- outstanding_amount); align payment status with the corrected balance.
UPDATE public.invoices
   SET status = CASE
         WHEN COALESCE(amount_received,0) >= amount_receivable AND COALESCE(amount_received,0) > 0 THEN 'paid'::invoice_status
         WHEN COALESCE(amount_received,0) > 0 THEN 'partially_paid'::invoice_status
         ELSE status END
 WHERE status IN ('partially_paid', 'paid')
   AND is_deleted = false;

UPDATE public.invoices SET updated_at = updated_at WHERE status <> 'cancelled';
