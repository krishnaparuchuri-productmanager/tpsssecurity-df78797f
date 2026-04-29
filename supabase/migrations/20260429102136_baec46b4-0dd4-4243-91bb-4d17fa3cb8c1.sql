-- ============= COMPLIANCE TASKS TABLE =============
CREATE TABLE IF NOT EXISTS public.compliance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code text NOT NULL,
  task_name text NOT NULL,
  category text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  due_date date NOT NULL,
  period_label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_date date,
  completed_by uuid,
  challan_number text,
  amount_paid numeric DEFAULT 0,
  notes text,
  assigned_to uuid,
  reminder_days_before integer NOT NULL DEFAULT 7,
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_due ON public.compliance_tasks(due_date) WHERE is_deleted=false;
CREATE INDEX IF NOT EXISTS idx_compliance_status ON public.compliance_tasks(status) WHERE is_deleted=false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_period
  ON public.compliance_tasks(task_code, period_label, is_sandbox) WHERE is_deleted=false;

ALTER TABLE public.compliance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View compliance tasks" ON public.compliance_tasks
  FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);

CREATE POLICY "Deny direct insert compliance_tasks" ON public.compliance_tasks
  FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update compliance_tasks" ON public.compliance_tasks
  FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete compliance_tasks" ON public.compliance_tasks
  FOR DELETE TO anon, authenticated USING (false);

CREATE TRIGGER set_compliance_updated_at
  BEFORE UPDATE ON public.compliance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= RPC: record_expense =============
CREATE OR REPLACE FUNCTION public.record_expense(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_date date := COALESCE((_payload->>'entry_date')::date, CURRENT_DATE);
  v_cat public.ledger_category := (_payload->>'category')::public.ledger_category;
  v_particulars text := _payload->>'particulars';
  v_amount numeric := (_payload->>'amount')::numeric;
  v_client uuid := NULLIF(_payload->>'client_id','')::uuid;
  v_ref text := _payload->>'reference_number';
  v_sandbox boolean := public.is_sandbox_env();
  v_balance numeric;
  v_voucher text;
  v_id uuid;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized to record expenses';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Amount must be > 0'; END IF;
  IF v_particulars IS NULL OR length(trim(v_particulars))=0 THEN RAISE EXCEPTION 'Particulars required'; END IF;

  SELECT COALESCE(MAX(balance_after),0) INTO v_balance
    FROM public.financial_ledger
    WHERE entry_date <= v_date AND is_sandbox = v_sandbox AND is_deleted=false;

  v_voucher := public.gen_voucher_number(v_date);

  INSERT INTO public.financial_ledger
    (voucher_number, entry_date, entry_type, category, particulars, client_id,
     debit_amount, credit_amount, balance_after, reference_id, reference_type,
     created_by, is_sandbox)
  VALUES
    (v_voucher, v_date, 'payment', v_cat, v_particulars, v_client,
     v_amount, 0, v_balance - v_amount, NULL,
     COALESCE(v_ref,'expense'), v_uid, v_sandbox)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'CREATE', 'financial_ledger', v_id,
          jsonb_build_object('category', v_cat::text, 'amount', v_amount, 'particulars', v_particulars));

  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.record_expense(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_expense(jsonb) TO authenticated;

-- ============= RPC: create_compliance_task =============
CREATE OR REPLACE FUNCTION public.create_compliance_task(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_sandbox boolean := public.is_sandbox_env();
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.compliance_tasks(
    task_code, task_name, category, frequency, due_date, period_label,
    status, assigned_to, reminder_days_before, notes, created_by, is_sandbox
  ) VALUES (
    _payload->>'task_code',
    _payload->>'task_name',
    _payload->>'category',
    COALESCE(_payload->>'frequency','one_time'),
    (_payload->>'due_date')::date,
    _payload->>'period_label',
    COALESCE(_payload->>'status','pending'),
    NULLIF(_payload->>'assigned_to','')::uuid,
    COALESCE((_payload->>'reminder_days_before')::int, 7),
    _payload->>'notes',
    v_uid, v_sandbox
  ) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'CREATE','compliance_tasks',v_id, _payload);
  RETURN v_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.create_compliance_task(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_compliance_task(jsonb) TO authenticated;

-- ============= RPC: update_compliance_task =============
CREATE OR REPLACE FUNCTION public.update_compliance_task(_id uuid, _payload jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.compliance_tasks SET
    task_name = COALESCE(_payload->>'task_name', task_name),
    category = COALESCE(_payload->>'category', category),
    due_date = COALESCE((_payload->>'due_date')::date, due_date),
    period_label = COALESCE(_payload->>'period_label', period_label),
    assigned_to = COALESCE(NULLIF(_payload->>'assigned_to','')::uuid, assigned_to),
    reminder_days_before = COALESCE((_payload->>'reminder_days_before')::int, reminder_days_before),
    notes = COALESCE(_payload->>'notes', notes),
    status = COALESCE(_payload->>'status', status),
    updated_at = now()
  WHERE id = _id AND status <> 'completed';
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'UPDATE','compliance_tasks',_id,_payload);
END $$;

REVOKE EXECUTE ON FUNCTION public.update_compliance_task(uuid,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_compliance_task(uuid,jsonb) TO authenticated;

-- ============= RPC: complete_compliance_task =============
CREATE OR REPLACE FUNCTION public.complete_compliance_task(_id uuid, _challan text, _amount numeric, _notes text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); t public.compliance_tasks%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops') OR public.has_role(v_uid,'accountant')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO t FROM public.compliance_tasks WHERE id=_id FOR UPDATE;
  IF t.status='completed' THEN RAISE EXCEPTION 'Task already completed'; END IF;
  UPDATE public.compliance_tasks SET
    status='completed', completed_date=CURRENT_DATE, completed_by=v_uid,
    challan_number=_challan, amount_paid=COALESCE(_amount,0),
    notes = COALESCE(_notes, notes), updated_at=now()
  WHERE id=_id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'COMPLETE','compliance_tasks',_id,
            jsonb_build_object('challan',_challan,'amount',_amount));
END $$;

REVOKE EXECUTE ON FUNCTION public.complete_compliance_task(uuid,text,numeric,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.complete_compliance_task(uuid,text,numeric,text) TO authenticated;

-- ============= RPC: seed_compliance_tasks =============
CREATE OR REPLACE FUNCTION public.seed_compliance_tasks(_from date, _to date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sandbox boolean := public.is_sandbox_env();
  v_month date := date_trunc('month', _from)::date;
  v_count integer := 0;
  v_label text;
  templates jsonb := '[
    {"code":"EPF_ECR","name":"EPF ECR Filing & Challan","cat":"EPF","day":15},
    {"code":"ESI_CHALLAN","name":"ESI Monthly Challan","cat":"ESI","day":15},
    {"code":"PT_RETURN","name":"Professional Tax Return","cat":"PT","day":10},
    {"code":"GST_GSTR1","name":"GSTR-1 Filing","cat":"GST","day":11},
    {"code":"GST_GSTR3B","name":"GSTR-3B Filing & Payment","cat":"GST","day":20},
    {"code":"TDS_PAYMENT","name":"TDS Monthly Payment","cat":"TDS","day":7}
  ]'::jsonb;
  tpl jsonb;
  v_due date;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can seed';
  END IF;
  WHILE v_month <= _to LOOP
    v_label := to_char(v_month,'Mon YYYY');
    FOR tpl IN SELECT * FROM jsonb_array_elements(templates) LOOP
      v_due := (v_month + ((tpl->>'day')::int - 1) * interval '1 day')::date;
      INSERT INTO public.compliance_tasks(
        task_code, task_name, category, frequency, due_date, period_label,
        status, reminder_days_before, created_by, is_sandbox
      ) VALUES (
        tpl->>'code', tpl->>'name', tpl->>'cat', 'monthly',
        v_due, v_label, 'pending', 7, v_uid, v_sandbox
      ) ON CONFLICT (task_code, period_label, is_sandbox) WHERE is_deleted=false DO NOTHING;
      v_count := v_count + 1;
    END LOOP;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;
  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_compliance_tasks(date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.seed_compliance_tasks(date,date) TO authenticated;