-- ============================================================
-- PHASE 3B — Finance, Compliance, Backup
-- ============================================================

-- ============= EXPENSE CATEGORIES =============
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  ledger_category public.ledger_category NOT NULL DEFAULT 'other_expense',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View expense categories" ON public.expense_categories
  FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "Deny direct insert expense_categories" ON public.expense_categories
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update expense_categories" ON public.expense_categories
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete expense_categories" ON public.expense_categories
  FOR DELETE TO anon, authenticated USING (false);
CREATE TRIGGER set_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= EXPENSES =============
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number text NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid,
  category_id uuid NOT NULL REFERENCES public.expense_categories(id),
  description text NOT NULL,
  amount numeric NOT NULL,
  payment_mode text NOT NULL,
  reference_number text,
  receipt_url text,
  recorded_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  ledger_entry_id uuid,
  status text NOT NULL DEFAULT 'draft',
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date) WHERE is_deleted=false;
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status) WHERE is_deleted=false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_number_env
  ON public.expenses(expense_number, is_sandbox) WHERE is_deleted=false;

CREATE OR REPLACE FUNCTION public.expenses_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be > 0';
  END IF;
  IF NEW.payment_mode NOT IN ('Cash','Bank','UPI','Card') THEN
    RAISE EXCEPTION 'Invalid payment mode';
  END IF;
  IF NEW.status NOT IN ('draft','approved') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF length(coalesce(NEW.description,'')) > 500 THEN
    RAISE EXCEPTION 'Description max 500 chars';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER expenses_validate_trg
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.expenses_validate();
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Deny direct insert expenses" ON public.expenses
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update expenses" ON public.expenses
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete expenses" ON public.expenses
  FOR DELETE TO anon, authenticated USING (false);

-- ============= COMPLIANCE PAYMENTS =============
CREATE TABLE IF NOT EXISTS public.compliance_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type text NOT NULL,
  payment_month date NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  branch_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  challan_number text,
  bank_name text,
  reference_number text,
  late_fee numeric NOT NULL DEFAULT 0,
  interest numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  paysheet_id uuid,
  notes text,
  recorded_by uuid,
  ledger_entry_id uuid,
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compay_month ON public.compliance_payments(payment_month) WHERE is_deleted=false;
CREATE INDEX IF NOT EXISTS idx_compay_type ON public.compliance_payments(payment_type) WHERE is_deleted=false;

CREATE OR REPLACE FUNCTION public.compliance_payments_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_type NOT IN ('EPF','ESI','GST','PT','TDS','OTHER') THEN
    RAISE EXCEPTION 'Invalid payment type';
  END IF;
  IF NEW.amount < 0 OR NEW.late_fee < 0 OR NEW.interest < 0 THEN
    RAISE EXCEPTION 'Amounts must be non-negative';
  END IF;
  NEW.total_paid := COALESCE(NEW.amount,0) + COALESCE(NEW.late_fee,0) + COALESCE(NEW.interest,0);
  -- Force first day of month
  NEW.payment_month := date_trunc('month', NEW.payment_month)::date;
  RETURN NEW;
END $$;
CREATE TRIGGER compay_validate_trg
  BEFORE INSERT OR UPDATE ON public.compliance_payments
  FOR EACH ROW EXECUTE FUNCTION public.compliance_payments_validate();

ALTER TABLE public.compliance_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View compliance payments" ON public.compliance_payments
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Deny direct insert compliance_payments" ON public.compliance_payments
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update compliance_payments" ON public.compliance_payments
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete compliance_payments" ON public.compliance_payments
  FOR DELETE TO anon, authenticated USING (false);

-- ============= INVOICE FOLLOWUPS =============
CREATE TABLE IF NOT EXISTS public.invoice_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  client_id uuid NOT NULL,
  followup_date date NOT NULL DEFAULT CURRENT_DATE,
  contacted_by uuid,
  contact_mode text,
  response text,
  promise_date date,
  next_followup_date date,
  status text NOT NULL DEFAULT 'open',
  closed_reason text,
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_followups_invoice ON public.invoice_followups(invoice_id) WHERE is_deleted=false;
CREATE INDEX IF NOT EXISTS idx_followups_status ON public.invoice_followups(status) WHERE is_deleted=false;

CREATE OR REPLACE FUNCTION public.followups_validate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('open','in_progress','promised','closed') THEN
    RAISE EXCEPTION 'Invalid followup status';
  END IF;
  IF NEW.contact_mode IS NOT NULL AND NEW.contact_mode NOT IN ('Phone','In-Person','Email','WhatsApp','Other') THEN
    RAISE EXCEPTION 'Invalid contact mode';
  END IF;
  IF length(coalesce(NEW.response,'')) > 1000 THEN
    RAISE EXCEPTION 'Response max 1000 chars';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER followups_validate_trg
  BEFORE INSERT OR UPDATE ON public.invoice_followups
  FOR EACH ROW EXECUTE FUNCTION public.followups_validate();
CREATE TRIGGER set_followups_updated_at
  BEFORE UPDATE ON public.invoice_followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invoice_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View followups" ON public.invoice_followups
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Deny direct insert invoice_followups" ON public.invoice_followups
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update invoice_followups" ON public.invoice_followups
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete invoice_followups" ON public.invoice_followups
  FOR DELETE TO anon, authenticated USING (false);

-- ============= BACKUP LOGS =============
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL,
  triggered_by uuid,
  backup_date timestamptz NOT NULL DEFAULT now(),
  file_path text,
  file_size_kb numeric DEFAULT 0,
  tables_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backup_logs_date ON public.backup_logs(backup_date DESC);
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CEO read backup logs" ON public.backup_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'ceo_admin') AND public.is_active_user(auth.uid()));
CREATE POLICY "Deny direct insert backup_logs" ON public.backup_logs
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update backup_logs" ON public.backup_logs
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete backup_logs" ON public.backup_logs
  FOR DELETE TO anon, authenticated USING (false);

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets(id, name, public)
VALUES ('backups','backups', false)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "CEO read backups bucket" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id='backups' AND public.has_role(auth.uid(),'ceo_admin') AND public.is_active_user(auth.uid()));

-- ============================================================
-- RPCs
-- ============================================================

-- gen_expense_number(_date) → EXP-MMMYYYY-NNN
CREATE OR REPLACE FUNCTION public.gen_expense_number(_date date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_sandbox boolean := public.is_sandbox_env();
  v_label text := upper(to_char(_date,'MonYYYY'));
  v_next int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(expense_number,'^EXP-[A-Z]+[0-9]+-',''),'')::int),0)+1
    INTO v_next
    FROM public.expenses
   WHERE is_sandbox = v_sandbox
     AND expense_number LIKE 'EXP-' || v_label || '-%';
  RETURN 'EXP-' || v_label || '-' || lpad(v_next::text,3,'0');
END $$;
GRANT EXECUTE ON FUNCTION public.gen_expense_number(date) TO authenticated;

-- record_expense_v2 (Phase 3B replacement; takes branch_id + category_id)
CREATE OR REPLACE FUNCTION public.record_expense_v2(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
    v_status,
    v_sandbox
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'CREATE','expenses',v_id, jsonb_build_object('amount',v_amount,'status',v_status));

  IF v_status = 'approved' THEN
    PERFORM public.approve_expense(v_id);
  END IF;

  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_expense_v2(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_expense_v2(jsonb) TO authenticated;

-- approve_expense
CREATE OR REPLACE FUNCTION public.approve_expense(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  e public.expenses%ROWTYPE;
  v_ledger_cat public.ledger_category;
  v_balance numeric;
  v_voucher text;
  v_ledger_id uuid;
  v_cat_name text;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO e FROM public.expenses WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
  IF e.status = 'approved' THEN RETURN; END IF;

  SELECT ledger_category, category_name INTO v_ledger_cat, v_cat_name
    FROM public.expense_categories WHERE id = e.category_id;

  SELECT COALESCE(MAX(balance_after),0) INTO v_balance
    FROM public.financial_ledger
   WHERE entry_date <= e.expense_date AND is_sandbox=e.is_sandbox AND is_deleted=false;

  v_voucher := public.gen_voucher_number(e.expense_date);

  INSERT INTO public.financial_ledger(
    voucher_number, entry_date, entry_type, category, particulars, client_id,
    debit_amount, credit_amount, balance_after, reference_id, reference_type,
    created_by, is_sandbox
  ) VALUES (
    v_voucher, e.expense_date, 'payment', v_ledger_cat,
    v_cat_name || ' - ' || e.description, NULL,
    e.amount, 0, v_balance - e.amount, e.id, 'expense',
    v_uid, e.is_sandbox
  ) RETURNING id INTO v_ledger_id;

  UPDATE public.expenses
     SET status='approved', approved_by=v_uid, approved_at=now(), ledger_entry_id=v_ledger_id
   WHERE id=_id;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'APPROVE','expenses',_id, jsonb_build_object('ledger_entry_id', v_ledger_id));
END $$;
REVOKE EXECUTE ON FUNCTION public.approve_expense(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.approve_expense(uuid) TO authenticated;

-- record_compliance_payment
CREATE OR REPLACE FUNCTION public.record_compliance_payment(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sandbox boolean := public.is_sandbox_env();
  v_id uuid;
  v_type text := _payload->>'payment_type';
  v_date date := COALESCE((_payload->>'payment_date')::date, CURRENT_DATE);
  v_amount numeric := COALESCE((_payload->>'amount')::numeric, 0);
  v_late numeric := COALESCE((_payload->>'late_fee')::numeric, 0);
  v_int numeric := COALESCE((_payload->>'interest')::numeric, 0);
  v_total numeric := v_amount + v_late + v_int;
  v_balance numeric;
  v_voucher text;
  v_ledger_id uuid;
  v_ledger_cat public.ledger_category;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  v_ledger_cat := CASE v_type
    WHEN 'EPF' THEN 'epf_payment'
    WHEN 'ESI' THEN 'esi_payment'
    WHEN 'GST' THEN 'gst_payment'
    WHEN 'PT'  THEN 'pt_payment'
    ELSE 'other_expense'
  END::public.ledger_category;

  SELECT COALESCE(MAX(balance_after),0) INTO v_balance
    FROM public.financial_ledger
   WHERE entry_date <= v_date AND is_sandbox=v_sandbox AND is_deleted=false;

  v_voucher := public.gen_voucher_number(v_date);

  INSERT INTO public.financial_ledger(
    voucher_number, entry_date, entry_type, category, particulars,
    debit_amount, credit_amount, balance_after, reference_type,
    created_by, is_sandbox
  ) VALUES (
    v_voucher, v_date, 'payment', v_ledger_cat,
    v_type || ' Payment for ' || to_char((_payload->>'payment_month')::date,'Mon YYYY')
       || COALESCE(' (Challan: ' || NULLIF(_payload->>'challan_number','') || ')',''),
    v_total, 0, v_balance - v_total, 'compliance_payment',
    v_uid, v_sandbox
  ) RETURNING id INTO v_ledger_id;

  INSERT INTO public.compliance_payments(
    payment_type, payment_month, payment_date, branch_id, amount, challan_number,
    bank_name, reference_number, late_fee, interest, paysheet_id, notes,
    recorded_by, ledger_entry_id, is_sandbox
  ) VALUES (
    v_type,
    (_payload->>'payment_month')::date,
    v_date,
    NULLIF(_payload->>'branch_id','')::uuid,
    v_amount,
    _payload->>'challan_number',
    _payload->>'bank_name',
    _payload->>'reference_number',
    v_late, v_int,
    NULLIF(_payload->>'paysheet_id','')::uuid,
    _payload->>'notes',
    v_uid, v_ledger_id, v_sandbox
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'CREATE','compliance_payments',v_id, _payload);
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_compliance_payment(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_compliance_payment(jsonb) TO authenticated;

-- create_followup
CREATE OR REPLACE FUNCTION public.create_followup(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sandbox boolean := public.is_sandbox_env();
  v_id uuid;
  v_inv uuid := (_payload->>'invoice_id')::uuid;
  v_client uuid;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT client_id INTO v_client FROM public.invoices WHERE id=v_inv;
  IF v_client IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;

  INSERT INTO public.invoice_followups(
    invoice_id, client_id, followup_date, contacted_by, contact_mode, response,
    promise_date, next_followup_date, status, created_by, is_sandbox
  ) VALUES (
    v_inv, v_client,
    COALESCE((_payload->>'followup_date')::date, CURRENT_DATE),
    v_uid,
    _payload->>'contact_mode',
    _payload->>'response',
    NULLIF(_payload->>'promise_date','')::date,
    NULLIF(_payload->>'next_followup_date','')::date,
    COALESCE(_payload->>'status','open'),
    v_uid, v_sandbox
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'CREATE','invoice_followups',v_id,_payload);
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_followup(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_followup(jsonb) TO authenticated;

-- update_followup
CREATE OR REPLACE FUNCTION public.update_followup(_id uuid, _payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.invoice_followups SET
    contact_mode = COALESCE(_payload->>'contact_mode', contact_mode),
    response = COALESCE(_payload->>'response', response),
    promise_date = COALESCE(NULLIF(_payload->>'promise_date','')::date, promise_date),
    next_followup_date = COALESCE(NULLIF(_payload->>'next_followup_date','')::date, next_followup_date),
    status = COALESCE(_payload->>'status', status),
    closed_reason = COALESCE(_payload->>'closed_reason', closed_reason),
    updated_at = now()
  WHERE id=_id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'UPDATE','invoice_followups',_id,_payload);
END $$;
REVOKE EXECUTE ON FUNCTION public.update_followup(uuid,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_followup(uuid,jsonb) TO authenticated;

-- auto_open_followups (scheduled)
CREATE OR REPLACE FUNCTION public.auto_open_followups()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_count int := 0;
  inv RECORD;
  v_user RECORD;
BEGIN
  FOR inv IN
    SELECT i.id, i.client_id, i.invoice_number, i.is_sandbox
      FROM public.invoices i
     WHERE i.is_deleted=false
       AND i.due_date < CURRENT_DATE
       AND COALESCE(i.outstanding_amount,0) > 0
       AND NOT EXISTS (
         SELECT 1 FROM public.invoice_followups f
          WHERE f.invoice_id=i.id AND f.is_deleted=false AND f.status<>'closed'
       )
  LOOP
    INSERT INTO public.invoice_followups(invoice_id, client_id, status, response, is_sandbox, created_by)
    VALUES (inv.id, inv.client_id, 'open', 'Auto-opened: invoice overdue', inv.is_sandbox, NULL);
    -- notify accountant + COO
    FOR v_user IN
      SELECT up.id FROM public.user_profiles up
        JOIN public.user_roles ur ON ur.user_id=up.id
       WHERE up.is_active=true AND ur.role IN ('accountant','coo_ops')
    LOOP
      INSERT INTO public.notifications(user_id, title, message, type, related_record_id, is_sandbox)
      VALUES (v_user.id, 'Invoice overdue',
              'Invoice ' || inv.invoice_number || ' is overdue. Follow-up opened.',
              'followup_opened', inv.id, inv.is_sandbox);
    END LOOP;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.auto_open_followups() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.auto_open_followups() TO authenticated, service_role;

-- auto_close_followups when invoice is fully paid
CREATE OR REPLACE FUNCTION public.auto_close_followups_for_invoice(_invoice_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_outstanding numeric;
  v_invnum text;
  v_count int := 0;
  v_user RECORD;
BEGIN
  SELECT COALESCE(outstanding_amount,0), invoice_number INTO v_outstanding, v_invnum
    FROM public.invoices WHERE id=_invoice_id;
  IF v_outstanding > 0 THEN RETURN 0; END IF;

  UPDATE public.invoice_followups
     SET status='closed', closed_reason='Payment received in full', updated_at=now()
   WHERE invoice_id=_invoice_id AND status<>'closed' AND is_deleted=false;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    FOR v_user IN
      SELECT up.id FROM public.user_profiles up
        JOIN public.user_roles ur ON ur.user_id=up.id
       WHERE up.is_active=true AND ur.role IN ('accountant','coo_ops')
    LOOP
      INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
      VALUES (v_user.id, 'Follow-up closed',
              'Follow-up closed for invoice ' || COALESCE(v_invnum,'?') || ' — paid in full.',
              'followup_closed', _invoice_id, public.is_sandbox_env());
    END LOOP;
  END IF;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.auto_close_followups_for_invoice(uuid) TO authenticated, service_role;

-- Trigger on payments to auto-close
CREATE OR REPLACE FUNCTION public.payments_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.auto_close_followups_for_invoice(NEW.invoice_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payments_after_insert_trg ON public.payments;
CREATE TRIGGER payments_after_insert_trg
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_after_insert();

-- manage_expense_category (CEO only)
CREATE OR REPLACE FUNCTION public.manage_expense_category(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid := NULLIF(_payload->>'id','')::uuid;
  v_action text := COALESCE(_payload->>'action','upsert');
BEGIN
  IF NOT public.has_role(v_uid,'ceo_admin') THEN RAISE EXCEPTION 'CEO only'; END IF;
  IF v_action='delete' AND v_id IS NOT NULL THEN
    UPDATE public.expense_categories SET is_active=false WHERE id=v_id;
    RETURN v_id;
  END IF;
  IF v_id IS NULL THEN
    INSERT INTO public.expense_categories(category_name, is_active, sort_order, ledger_category)
    VALUES (
      _payload->>'category_name',
      COALESCE((_payload->>'is_active')::boolean, true),
      COALESCE((_payload->>'sort_order')::int, 999),
      COALESCE((_payload->>'ledger_category')::public.ledger_category, 'other_expense')
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.expense_categories SET
      category_name = COALESCE(_payload->>'category_name', category_name),
      is_active = COALESCE((_payload->>'is_active')::boolean, is_active),
      sort_order = COALESCE((_payload->>'sort_order')::int, sort_order),
      ledger_category = COALESCE((_payload->>'ledger_category')::public.ledger_category, ledger_category),
      updated_at = now()
    WHERE id=v_id;
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'UPSERT','expense_categories',v_id,_payload);
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.manage_expense_category(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.manage_expense_category(jsonb) TO authenticated;

-- reorder_expense_categories (bulk)
CREATE OR REPLACE FUNCTION public.reorder_expense_categories(_orders jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); rec jsonb;
BEGIN
  IF NOT public.has_role(v_uid,'ceo_admin') THEN RAISE EXCEPTION 'CEO only'; END IF;
  FOR rec IN SELECT * FROM jsonb_array_elements(_orders) LOOP
    UPDATE public.expense_categories
       SET sort_order=(rec->>'sort_order')::int, updated_at=now()
     WHERE id=(rec->>'id')::uuid;
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.reorder_expense_categories(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reorder_expense_categories(jsonb) TO authenticated;

-- record_backup_log (called by edge function via service role)
CREATE OR REPLACE FUNCTION public.record_backup_log(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.backup_logs(
    backup_type, triggered_by, file_path, file_size_kb, tables_included, status, error_message
  ) VALUES (
    _payload->>'backup_type',
    NULLIF(_payload->>'triggered_by','')::uuid,
    _payload->>'file_path',
    COALESCE((_payload->>'file_size_kb')::numeric,0),
    COALESCE(_payload->'tables_included','[]'::jsonb),
    COALESCE(_payload->>'status','success'),
    _payload->>'error_message'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.record_backup_log(jsonb) TO service_role, authenticated;
