
-- =========================================================
-- PHASE 3A MIGRATION
-- =========================================================

-- ---------- Sequences ----------
CREATE SEQUENCE IF NOT EXISTS public.advance_seq;
CREATE SEQUENCE IF NOT EXISTS public.ffs_seq;

-- ---------- BRANCHES ----------
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_name text NOT NULL,
  branch_code text NOT NULL UNIQUE,
  branch_address text,
  is_head_office boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read branches" ON public.branches FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted = false);
CREATE POLICY "CEO/COO insert branches" ON public.branches FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE POLICY "CEO/COO update branches" ON public.branches FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE TRIGGER trg_branches_updated_at BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.branches (branch_name, branch_code, is_head_office)
  VALUES ('Nellore', 'NLR', true);

-- ---------- SHIFTS ----------
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_name text NOT NULL,
  shift_code text NOT NULL,
  shift_start_time time NOT NULL,
  shift_end_time time NOT NULL,
  shift_hours numeric NOT NULL DEFAULT 8,
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read shifts" ON public.shifts FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "CEO/COO insert shifts" ON public.shifts FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE POLICY "CEO/COO update shifts" ON public.shifts FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.shifts (shift_name, shift_code, shift_start_time, shift_end_time, shift_hours, branch_id)
SELECT 'Day Shift','DAY','07:00','19:00',8, id FROM public.branches WHERE branch_code='NLR';
INSERT INTO public.shifts (shift_name, shift_code, shift_start_time, shift_end_time, shift_hours, branch_id)
SELECT 'Night Shift','NIGHT','19:00','07:00',8, id FROM public.branches WHERE branch_code='NLR';

-- ---------- CLIENT_POSTS ----------
CREATE TABLE public.client_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  post_name text NOT NULL,
  unit_name text,
  is_active boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read client_posts" ON public.client_posts FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "CEO/COO insert client_posts" ON public.client_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE POLICY "CEO/COO update client_posts" ON public.client_posts FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE TRIGGER trg_client_posts_updated_at BEFORE UPDATE ON public.client_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- Retrofit clients/employees/invoices ----------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
UPDATE public.clients SET branch_id = (SELECT id FROM public.branches WHERE branch_code='NLR') WHERE branch_id IS NULL;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS max_advance_limit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS current_advance_balance numeric NOT NULL DEFAULT 0;
UPDATE public.employees SET branch_id = (SELECT id FROM public.branches WHERE branch_code='NLR') WHERE branch_id IS NULL;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS po_date date;

-- ---------- EMPLOYEE_DEPLOYMENTS ----------
CREATE TABLE public.employee_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  shift_id uuid NOT NULL REFERENCES public.shifts(id),
  post_id uuid REFERENCES public.client_posts(id),
  deployment_start_date date NOT NULL,
  deployment_end_date date,
  is_current boolean NOT NULL DEFAULT true,
  relieved_reason text,
  notes text,
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_one_current_deployment ON public.employee_deployments (employee_id)
  WHERE is_current = true AND is_deleted = false;
CREATE INDEX idx_deploy_client_current ON public.employee_deployments (client_id) WHERE is_current=true AND is_deleted=false;
ALTER TABLE public.employee_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View deployments" ON public.employee_deployments FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "CEO/COO insert deployments" ON public.employee_deployments FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE POLICY "CEO/COO update deployments" ON public.employee_deployments FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE TRIGGER trg_deploy_updated_at BEFORE UPDATE ON public.employee_deployments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- CLIENT_CONTRACTS ----------
CREATE TABLE public.client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  branch_id uuid REFERENCES public.branches(id),
  contract_start_date date NOT NULL,
  contract_end_date date,
  po_number text,
  po_date date,
  po_amount numeric,
  contract_document_url text,
  notes text,
  status text NOT NULL DEFAULT 'active',
  renewal_of uuid REFERENCES public.client_contracts(id),
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View contracts" ON public.client_contracts FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "CEO/COO insert contracts" ON public.client_contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE POLICY "CEO/COO update contracts" ON public.client_contracts FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE TRIGGER trg_contracts_updated_at BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- CONTRACT_RENEWALS ----------
CREATE TABLE public.contract_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_contract_id uuid NOT NULL REFERENCES public.client_contracts(id),
  new_contract_id uuid NOT NULL REFERENCES public.client_contracts(id),
  renewal_date date NOT NULL DEFAULT CURRENT_DATE,
  effective_month date NOT NULL,
  salary_revised boolean NOT NULL DEFAULT false,
  wage_config_id uuid,
  notes text,
  renewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contract_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View renewals" ON public.contract_renewals FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
CREATE POLICY "CEO/COO insert renewals" ON public.contract_renewals FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));

-- ---------- EMPLOYEE_ADVANCES ----------
CREATE TABLE public.employee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_number text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  client_id uuid REFERENCES public.clients(id),
  advance_type text NOT NULL,
  advance_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL,
  amount_remaining numeric NOT NULL DEFAULT 0,
  monthly_deduction numeric NOT NULL,
  max_advance_limit numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  recovery_start_month date NOT NULL,
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View advances" ON public.employee_advances FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE TRIGGER trg_adv_updated_at BEFORE UPDATE ON public.employee_advances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- ADVANCE_RECOVERY_SCHEDULE ----------
CREATE TABLE public.advance_recovery_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.employee_advances(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  recovery_month date NOT NULL,
  scheduled_amount numeric NOT NULL,
  actual_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paysheet_id uuid REFERENCES public.paysheets(id),
  deducted_at timestamptz,
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ars_emp_month ON public.advance_recovery_schedule (employee_id, recovery_month) WHERE status='pending';
ALTER TABLE public.advance_recovery_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View advance schedule" ON public.advance_recovery_schedule FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);

-- ---------- EMPLOYEE_FFS ----------
CREATE TABLE public.employee_ffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ffs_number text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  client_id uuid REFERENCES public.clients(id),
  relieving_date date NOT NULL,
  last_working_day date NOT NULL,
  reason_for_leaving text NOT NULL,
  reason_details text,
  earned_wages_pending numeric NOT NULL DEFAULT 0,
  leave_encashment_days numeric NOT NULL DEFAULT 0,
  leave_encashment_amount numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0,
  gratuity_applicable boolean NOT NULL DEFAULT false,
  gratuity_years_of_service numeric,
  gratuity_basic numeric,
  gratuity_amount numeric,
  advance_outstanding numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  other_deductions_label text,
  total_earnings numeric NOT NULL DEFAULT 0,
  total_deductions_ffs numeric NOT NULL DEFAULT 0,
  net_payable numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  submitted_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  payment_date date,
  payment_mode text,
  payment_reference text,
  notes text,
  is_sandbox boolean NOT NULL DEFAULT public.is_sandbox_env(),
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employee_ffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View ffs" ON public.employee_ffs FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE TRIGGER trg_ffs_updated_at BEFORE UPDATE ON public.employee_ffs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- FUNCTIONS
-- =========================================================

CREATE OR REPLACE FUNCTION public.gen_advance_number(_d date, _sandbox boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prefix text := CASE WHEN _sandbox THEN 'TEST-ADV-' ELSE 'ADV-' END;
        mm text := upper(to_char(_d,'MonYYYY'));
        n integer := nextval('public.advance_seq');
BEGIN
  RETURN prefix || mm || '-' || lpad(n::text,3,'0');
END $$;

CREATE OR REPLACE FUNCTION public.gen_ffs_number(_d date, _sandbox boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prefix text := CASE WHEN _sandbox THEN 'TEST-FFS-' ELSE 'FFS-' END;
        mm text := upper(to_char(_d,'MonYYYY'));
        n integer := nextval('public.ffs_seq');
BEGIN
  RETURN prefix || mm || '-' || lpad(n::text,3,'0');
END $$;

CREATE OR REPLACE FUNCTION public.gen_contract_number(_client_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_code text; v_n integer;
BEGIN
  SELECT client_code INTO v_code FROM public.clients WHERE id=_client_id;
  SELECT COALESCE(COUNT(*),0)+1 INTO v_n FROM public.client_contracts WHERE client_id=_client_id;
  RETURN 'CNT-' || COALESCE(v_code,'X') || '-' || lpad(v_n::text,3,'0');
END $$;

-- request_advance: accountant submits, validates limit
CREATE OR REPLACE FUNCTION public.request_advance(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_emp uuid := (_payload->>'employee_id')::uuid;
  v_amt numeric := (_payload->>'total_amount')::numeric;
  v_monthly numeric := (_payload->>'monthly_deduction')::numeric;
  v_type text := _payload->>'advance_type';
  v_date date := COALESCE((_payload->>'advance_date')::date, CURRENT_DATE);
  v_start date := (_payload->>'recovery_start_month')::date;
  v_reason text := _payload->>'reason';
  v_client uuid;
  v_limit numeric;
  v_current numeric;
  v_sandbox boolean := public.is_sandbox_env();
  v_id uuid;
  v_num text;
  r record;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;
  IF NOT public.has_role(v_uid,'accountant') AND NOT public.has_role(v_uid,'ceo_admin') THEN
    RAISE EXCEPTION 'Only accountants can request advances';
  END IF;
  IF v_amt <= 0 OR v_monthly <= 0 THEN RAISE EXCEPTION 'Amounts must be positive'; END IF;
  IF length(coalesce(v_reason,'')) > 500 THEN RAISE EXCEPTION 'Reason too long'; END IF;

  SELECT client_id, max_advance_limit, current_advance_balance INTO v_client, v_limit, v_current
    FROM public.employees WHERE id=v_emp;

  IF v_limit > 0 AND (COALESCE(v_current,0) + v_amt) > v_limit THEN
    RAISE EXCEPTION 'Advance limit exceeded. Current balance: %. Limit: %.', v_current, v_limit;
  END IF;

  v_num := public.gen_advance_number(v_date, v_sandbox);
  INSERT INTO public.employee_advances(
    advance_number, employee_id, client_id, advance_type, advance_date,
    total_amount, amount_remaining, monthly_deduction, max_advance_limit,
    reason, status, requested_by, recovery_start_month, is_sandbox
  ) VALUES (
    v_num, v_emp, v_client, v_type, v_date,
    v_amt, v_amt, v_monthly, COALESCE(v_limit,0),
    v_reason, 'pending', v_uid, date_trunc('month',v_start)::date, v_sandbox
  ) RETURNING id INTO v_id;

  -- Notify CEO/COO
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
    JOIN public.user_profiles up ON up.id=ur.user_id AND up.is_active=true
    WHERE ur.role IN ('ceo_admin','coo_ops')
  LOOP
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (r.user_id, 'Advance requested',
      '💵 Advance request ₹' || v_amt::text || ' (' || v_type || ') for review.',
      'advance', v_id, v_sandbox);
  END LOOP;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'CREATE','employee_advances',v_id, jsonb_build_object('amount',v_amt));

  RETURN v_id;
END $$;

-- generate_recovery_schedule
CREATE OR REPLACE FUNCTION public.generate_recovery_schedule(_advance_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  a public.employee_advances%ROWTYPE;
  v_remaining numeric;
  v_month date;
  v_amt numeric;
BEGIN
  SELECT * INTO a FROM public.employee_advances WHERE id=_advance_id;
  v_remaining := a.total_amount;
  v_month := a.recovery_start_month;
  WHILE v_remaining > 0 LOOP
    v_amt := LEAST(a.monthly_deduction, v_remaining);
    INSERT INTO public.advance_recovery_schedule(
      advance_id, employee_id, recovery_month, scheduled_amount, status, is_sandbox
    ) VALUES (a.id, a.employee_id, v_month, v_amt, 'pending', a.is_sandbox);
    v_remaining := v_remaining - v_amt;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;
END $$;

-- approve_advance
CREATE OR REPLACE FUNCTION public.approve_advance(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  a public.employee_advances%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can approve advances';
  END IF;
  SELECT * INTO a FROM public.employee_advances WHERE id=_id FOR UPDATE;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'Only pending advances can be approved'; END IF;
  IF a.requested_by = v_uid THEN RAISE EXCEPTION 'Cannot approve own request'; END IF;

  UPDATE public.employee_advances
    SET status='active', approved_by=v_uid, approved_at=now()
    WHERE id=_id;
  PERFORM public.generate_recovery_schedule(_id);

  UPDATE public.employees
    SET current_advance_balance = COALESCE(current_advance_balance,0) + a.total_amount
    WHERE id = a.employee_id;

  IF a.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (a.requested_by, 'Advance approved',
      '✅ Advance ' || a.advance_number || ' approved.', 'advance', _id, a.is_sandbox);
  END IF;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'APPROVE','employee_advances',_id, jsonb_build_object('status','active'));
END $$;

-- reject_advance
CREATE OR REPLACE FUNCTION public.reject_advance(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); a public.employee_advances%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can reject';
  END IF;
  IF length(coalesce(_reason,'')) < 10 OR length(_reason) > 200 THEN
    RAISE EXCEPTION 'Rejection reason must be 10-200 characters';
  END IF;
  SELECT * INTO a FROM public.employee_advances WHERE id=_id FOR UPDATE;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'Only pending advances can be rejected'; END IF;

  UPDATE public.employee_advances
    SET status='rejected', rejection_reason=_reason, approved_by=v_uid, approved_at=now()
    WHERE id=_id;

  IF a.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (a.requested_by, 'Advance rejected',
      '❌ Advance ' || a.advance_number || ' rejected: ' || _reason, 'advance', _id, a.is_sandbox);
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'REJECT','employee_advances',_id, jsonb_build_object('reason',_reason));
END $$;

-- cancel_advance (accountant on own pending)
CREATE OR REPLACE FUNCTION public.cancel_advance(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); a public.employee_advances%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.employee_advances WHERE id=_id FOR UPDATE;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'Only pending advances can be cancelled'; END IF;
  IF a.requested_by <> v_uid AND NOT public.has_role(v_uid,'ceo_admin') THEN
    RAISE EXCEPTION 'Only requester or CEO can cancel';
  END IF;
  UPDATE public.employee_advances SET status='cancelled' WHERE id=_id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id) VALUES (v_uid,'CANCEL','employee_advances',_id);
END $$;

-- get_active_advance_deductions for paysheet
CREATE OR REPLACE FUNCTION public.get_active_advance_deductions(_client_id uuid, _month_date date)
RETURNS TABLE(employee_id uuid, schedule_id uuid, advance_id uuid, scheduled_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT ars.employee_id, ars.id, ars.advance_id, ars.scheduled_amount
  FROM public.advance_recovery_schedule ars
  JOIN public.employee_advances ea ON ea.id = ars.advance_id
  WHERE ea.status = 'active'
    AND ars.status = 'pending'
    AND ars.is_deleted = false
    AND ars.recovery_month = date_trunc('month',_month_date)::date
    AND (ea.client_id = _client_id OR ea.client_id IS NULL)
    AND ars.is_sandbox = public.is_sandbox_env();
$$;

-- apply_advance_deductions_on_approve
CREATE OR REPLACE FUNCTION public.apply_advance_deductions_on_approve(_paysheet_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  ps public.paysheets%ROWTYPE;
  rec record;
  v_remaining numeric;
  r record;
BEGIN
  SELECT * INTO ps FROM public.paysheets WHERE id=_paysheet_id;
  -- For each paysheet employee with advance_deduction>0 and matching pending schedule row
  FOR rec IN
    SELECT pe.employee_id, pe.advance_deduction
      FROM public.paysheet_employees pe
     WHERE pe.paysheet_id = _paysheet_id
       AND pe.employee_id IS NOT NULL
       AND pe.advance_deduction > 0
  LOOP
    -- Apply to oldest pending schedule rows (FIFO)
    v_remaining := rec.advance_deduction;
    FOR r IN
      SELECT ars.id, ars.advance_id, ars.scheduled_amount
        FROM public.advance_recovery_schedule ars
        JOIN public.employee_advances ea ON ea.id=ars.advance_id
       WHERE ars.employee_id = rec.employee_id
         AND ars.status='pending'
         AND ars.is_deleted=false
         AND ea.status='active'
         AND ars.is_sandbox = ps.is_sandbox
       ORDER BY ars.recovery_month
    LOOP
      EXIT WHEN v_remaining <= 0;
      DECLARE v_apply numeric := LEAST(r.scheduled_amount, v_remaining);
      BEGIN
        UPDATE public.advance_recovery_schedule
           SET status='deducted', actual_amount=v_apply, deducted_at=now(), paysheet_id=_paysheet_id
         WHERE id=r.id;
        UPDATE public.employee_advances
           SET amount_remaining = GREATEST(0, amount_remaining - v_apply),
               status = CASE WHEN amount_remaining - v_apply <= 0 THEN 'fully_recovered' ELSE status END
         WHERE id=r.advance_id;
        UPDATE public.employees
           SET current_advance_balance = GREATEST(0, COALESCE(current_advance_balance,0) - v_apply)
         WHERE id = rec.employee_id;
        v_remaining := v_remaining - v_apply;

        -- Notify if fully recovered
        IF (SELECT amount_remaining FROM public.employee_advances WHERE id=r.advance_id) = 0 THEN
          INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
          SELECT DISTINCT ur.user_id, 'Advance fully recovered',
            '✅ Advance fully recovered for employee.', 'advance', r.advance_id, ps.is_sandbox
          FROM public.user_roles ur JOIN public.user_profiles up ON up.id=ur.user_id AND up.is_active=true
          WHERE ur.role IN ('ceo_admin','coo_ops','accountant');
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Override approve_paysheet to call advance deduction
CREATE OR REPLACE FUNCTION public.approve_paysheet(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); v_ps public.paysheets%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO or COO can approve';
  END IF;
  SELECT * INTO v_ps FROM public.paysheets WHERE id=_id FOR UPDATE;
  IF v_ps.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted paysheets can be approved'; END IF;
  IF v_ps.submitted_by = v_uid THEN RAISE EXCEPTION 'Cannot approve own submission'; END IF;

  UPDATE public.paysheets SET status='approved', approved_by=v_uid, approved_at=now(), updated_at=now() WHERE id=_id;

  PERFORM public.apply_advance_deductions_on_approve(_id);

  IF v_ps.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (v_ps.submitted_by, 'Paysheet approved',
      'Paysheet ' || v_ps.paysheet_number || ' has been approved.', 'paysheet', _id, v_ps.is_sandbox);
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'APPROVE','paysheets',_id, jsonb_build_object('status','approved'));
END $$;

-- compute_ffs (server-side preview)
CREATE OR REPLACE FUNCTION public.compute_ffs(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_emp uuid := (_payload->>'employee_id')::uuid;
  v_doj date;
  v_relieving date := COALESCE((_payload->>'relieving_date')::date, CURRENT_DATE);
  v_years numeric;
  v_basic numeric := COALESCE((_payload->>'gratuity_basic')::numeric, 0);
  v_grat_apply boolean := COALESCE((_payload->>'gratuity_applicable')::boolean, false);
  v_grat numeric := 0;
  v_earned numeric := COALESCE((_payload->>'earned_wages_pending')::numeric,0);
  v_lea numeric := COALESCE((_payload->>'leave_encashment_amount')::numeric,0);
  v_bonus numeric := COALESCE((_payload->>'bonus_amount')::numeric,0);
  v_other numeric := COALESCE((_payload->>'other_deductions')::numeric,0);
  v_outstanding numeric := 0;
  v_total_e numeric; v_total_d numeric; v_net numeric;
BEGIN
  SELECT date_of_joining INTO v_doj FROM public.employees WHERE id=v_emp;
  v_years := ROUND(EXTRACT(EPOCH FROM (v_relieving::timestamp - v_doj::timestamp))/(365.25*86400), 2);

  IF v_grat_apply AND v_years >= 5 AND v_basic > 0 THEN
    v_grat := ROUND(v_basic * 4.81/100 * v_years, 2);
  END IF;

  SELECT COALESCE(SUM(amount_remaining),0) INTO v_outstanding
    FROM public.employee_advances
    WHERE employee_id=v_emp AND status='active' AND is_deleted=false;

  v_total_e := v_earned + v_lea + v_bonus + v_grat;
  v_total_d := v_outstanding + v_other;
  v_net := v_total_e - v_total_d;

  RETURN jsonb_build_object(
    'years_of_service', v_years,
    'gratuity_eligible', v_years >= 5,
    'gratuity_amount', v_grat,
    'advance_outstanding', v_outstanding,
    'total_earnings', v_total_e,
    'total_deductions_ffs', v_total_d,
    'net_payable', v_net
  );
END $$;

-- save_ffs
CREATE OR REPLACE FUNCTION public.save_ffs(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid := NULLIF(_payload->>'id','')::uuid;
  v_status text := COALESCE(_payload->>'status','draft');
  v_sandbox boolean := public.is_sandbox_env();
  v_calc jsonb := public.compute_ffs(_payload);
  v_emp uuid := (_payload->>'employee_id')::uuid;
  v_client uuid;
  v_num text;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;
  IF NOT (public.has_role(v_uid,'accountant') OR public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT client_id INTO v_client FROM public.employees WHERE id=v_emp;

  IF v_id IS NULL THEN
    v_num := public.gen_ffs_number(COALESCE((_payload->>'relieving_date')::date, CURRENT_DATE), v_sandbox);
    INSERT INTO public.employee_ffs(
      ffs_number, employee_id, client_id, relieving_date, last_working_day,
      reason_for_leaving, reason_details,
      earned_wages_pending, leave_encashment_days, leave_encashment_amount, bonus_amount,
      gratuity_applicable, gratuity_years_of_service, gratuity_basic, gratuity_amount,
      advance_outstanding, other_deductions, other_deductions_label,
      total_earnings, total_deductions_ffs, net_payable,
      status, submitted_by, created_by, is_sandbox, notes
    ) VALUES (
      v_num, v_emp, v_client,
      (_payload->>'relieving_date')::date,
      COALESCE((_payload->>'last_working_day')::date,(_payload->>'relieving_date')::date),
      _payload->>'reason_for_leaving', _payload->>'reason_details',
      COALESCE((_payload->>'earned_wages_pending')::numeric,0),
      COALESCE((_payload->>'leave_encashment_days')::numeric,0),
      COALESCE((_payload->>'leave_encashment_amount')::numeric,0),
      COALESCE((_payload->>'bonus_amount')::numeric,0),
      COALESCE((_payload->>'gratuity_applicable')::boolean,false),
      (v_calc->>'years_of_service')::numeric,
      COALESCE((_payload->>'gratuity_basic')::numeric,0),
      (v_calc->>'gratuity_amount')::numeric,
      (v_calc->>'advance_outstanding')::numeric,
      COALESCE((_payload->>'other_deductions')::numeric,0),
      _payload->>'other_deductions_label',
      (v_calc->>'total_earnings')::numeric,
      (v_calc->>'total_deductions_ffs')::numeric,
      (v_calc->>'net_payable')::numeric,
      v_status, CASE WHEN v_status='submitted' THEN v_uid ELSE NULL END,
      v_uid, v_sandbox, _payload->>'notes'
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.employee_ffs SET
      relieving_date=(_payload->>'relieving_date')::date,
      last_working_day=COALESCE((_payload->>'last_working_day')::date,(_payload->>'relieving_date')::date),
      reason_for_leaving=_payload->>'reason_for_leaving',
      reason_details=_payload->>'reason_details',
      earned_wages_pending=COALESCE((_payload->>'earned_wages_pending')::numeric,0),
      leave_encashment_days=COALESCE((_payload->>'leave_encashment_days')::numeric,0),
      leave_encashment_amount=COALESCE((_payload->>'leave_encashment_amount')::numeric,0),
      bonus_amount=COALESCE((_payload->>'bonus_amount')::numeric,0),
      gratuity_applicable=COALESCE((_payload->>'gratuity_applicable')::boolean,false),
      gratuity_years_of_service=(v_calc->>'years_of_service')::numeric,
      gratuity_basic=COALESCE((_payload->>'gratuity_basic')::numeric,0),
      gratuity_amount=(v_calc->>'gratuity_amount')::numeric,
      advance_outstanding=(v_calc->>'advance_outstanding')::numeric,
      other_deductions=COALESCE((_payload->>'other_deductions')::numeric,0),
      other_deductions_label=_payload->>'other_deductions_label',
      total_earnings=(v_calc->>'total_earnings')::numeric,
      total_deductions_ffs=(v_calc->>'total_deductions_ffs')::numeric,
      net_payable=(v_calc->>'net_payable')::numeric,
      status=v_status,
      submitted_by=CASE WHEN v_status='submitted' AND status<>'submitted' THEN v_uid ELSE submitted_by END,
      notes=_payload->>'notes',
      updated_at=now()
    WHERE id=v_id;
  END IF;

  IF v_status='submitted' THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    SELECT DISTINCT ur.user_id, 'FFS submitted',
      '📋 FFS ' || (SELECT ffs_number FROM public.employee_ffs WHERE id=v_id) || ' submitted - Net ₹' || (v_calc->>'net_payable'),
      'ffs', v_id, v_sandbox
    FROM public.user_roles ur JOIN public.user_profiles up ON up.id=ur.user_id AND up.is_active=true
    WHERE ur.role IN ('ceo_admin','coo_ops');
  END IF;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid, CASE WHEN v_status='submitted' THEN 'SUBMIT' ELSE 'SAVE' END,'employee_ffs',v_id, jsonb_build_object('status',v_status));

  RETURN v_id;
END $$;

-- approve_ffs
CREATE OR REPLACE FUNCTION public.approve_ffs(_id uuid, _payment jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid(); f public.employee_ffs%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can approve';
  END IF;
  SELECT * INTO f FROM public.employee_ffs WHERE id=_id FOR UPDATE;
  IF f.status NOT IN ('submitted') THEN RAISE EXCEPTION 'Only submitted FFS can be approved'; END IF;
  IF f.submitted_by = v_uid THEN RAISE EXCEPTION 'Cannot approve own submission'; END IF;

  UPDATE public.employee_ffs SET
    status = CASE WHEN _payment IS NOT NULL THEN 'paid' ELSE 'approved' END,
    approved_by=v_uid, approved_at=now(),
    payment_date = (_payment->>'payment_date')::date,
    payment_mode = _payment->>'payment_mode',
    payment_reference = _payment->>'payment_reference'
    WHERE id=_id;

  -- End deployment, mark employee relieved
  UPDATE public.employee_deployments
    SET is_current=false, deployment_end_date=f.last_working_day, relieved_reason=f.reason_for_leaving, updated_at=now()
    WHERE employee_id=f.employee_id AND is_current=true;
  UPDATE public.employees SET status='Relieved', date_of_leaving=f.last_working_day WHERE id=f.employee_id;
  -- write off any remaining advances
  UPDATE public.employee_advances SET status='fully_recovered', amount_remaining=0
    WHERE employee_id=f.employee_id AND status='active';
  UPDATE public.employees SET current_advance_balance=0 WHERE id=f.employee_id;

  IF f.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (f.submitted_by,'FFS approved','✅ FFS ' || f.ffs_number || ' approved.','ffs',_id,f.is_sandbox);
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'APPROVE','employee_ffs',_id, jsonb_build_object('status','approved'));
END $$;

-- create_contract
CREATE OR REPLACE FUNCTION public.create_contract(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_client uuid := (_payload->>'client_id')::uuid;
  v_branch uuid;
  v_id uuid;
  v_num text;
  v_sandbox boolean := public.is_sandbox_env();
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can create contracts';
  END IF;
  SELECT branch_id INTO v_branch FROM public.clients WHERE id=v_client;
  v_num := public.gen_contract_number(v_client);
  INSERT INTO public.client_contracts(
    contract_number, client_id, branch_id,
    contract_start_date, contract_end_date,
    po_number, po_date, po_amount, contract_document_url, notes,
    status, created_by, is_sandbox
  ) VALUES (
    v_num, v_client, v_branch,
    (_payload->>'contract_start_date')::date,
    NULLIF(_payload->>'contract_end_date','')::date,
    _payload->>'po_number',
    NULLIF(_payload->>'po_date','')::date,
    NULLIF(_payload->>'po_amount','')::numeric,
    _payload->>'contract_document_url', _payload->>'notes',
    'active', v_uid, v_sandbox
  ) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'CREATE','client_contracts',v_id, jsonb_build_object('contract_number',v_num));
  RETURN v_id;
END $$;

-- renew_contract
CREATE OR REPLACE FUNCTION public.renew_contract(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_orig uuid := (_payload->>'original_contract_id')::uuid;
  v_new uuid;
  v_orig_row public.client_contracts%ROWTYPE;
  v_eff date := (_payload->>'effective_month')::date;
  v_revised boolean := COALESCE((_payload->>'salary_revised')::boolean,false);
  v_wage_id uuid;
  v_sandbox boolean := public.is_sandbox_env();
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can renew contracts';
  END IF;
  SELECT * INTO v_orig_row FROM public.client_contracts WHERE id=v_orig;
  IF v_eff < v_orig_row.contract_start_date OR v_eff > date_trunc('month',CURRENT_DATE)::date THEN
    RAISE EXCEPTION 'Effective month must be between contract start and current month';
  END IF;

  v_new := public.create_contract(_payload || jsonb_build_object('client_id', v_orig_row.client_id::text));
  UPDATE public.client_contracts SET renewal_of=v_orig WHERE id=v_new;

  IF v_revised AND _payload ? 'wage_config' THEN
    INSERT INTO public.client_wage_config(
      client_id, designation, basic, da, ta, payable_gross, epf_mw_wages, esi_mw_wages,
      effective_from, is_current, created_by, is_sandbox
    )
    SELECT v_orig_row.client_id,
           wc->>'designation',
           COALESCE((wc->>'basic')::numeric,0),
           COALESCE((wc->>'da')::numeric,0),
           COALESCE((wc->>'ta')::numeric,0),
           COALESCE((wc->>'payable_gross')::numeric,0),
           COALESCE((wc->>'epf_mw_wages')::numeric,15000),
           COALESCE((wc->>'esi_mw_wages')::numeric,21000),
           v_eff, true, v_uid, v_sandbox
      FROM jsonb_array_elements(_payload->'wage_config') wc;
  END IF;

  INSERT INTO public.contract_renewals(
    original_contract_id, new_contract_id, effective_month, salary_revised,
    notes, renewed_by
  ) VALUES (v_orig, v_new, v_eff, v_revised, _payload->>'notes', v_uid);

  UPDATE public.client_contracts SET status='renewed' WHERE id=v_orig;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'RENEW','client_contracts',v_new, jsonb_build_object('original',v_orig));

  RETURN v_new;
END $$;

-- contract status + expiry notifications (daily)
CREATE OR REPLACE FUNCTION public.mark_contract_status_and_notify()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record; r record; days_left integer; v_count integer := 0; v_client text;
BEGIN
  -- Mark expired
  UPDATE public.client_contracts SET status='expired'
    WHERE status='active' AND contract_end_date IS NOT NULL AND contract_end_date < CURRENT_DATE;

  FOR c IN
    SELECT cc.id, cc.contract_number, cc.client_id, cc.contract_end_date, cc.is_sandbox,
           cl.client_name
      FROM public.client_contracts cc
      JOIN public.clients cl ON cl.id = cc.client_id
     WHERE cc.is_deleted=false
       AND cc.status='active'
       AND cc.contract_end_date IS NOT NULL
       AND cc.contract_end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
  LOOP
    days_left := (c.contract_end_date - CURRENT_DATE)::integer;
    IF days_left NOT IN (30,15,7) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.notifications
       WHERE related_record_id=c.id AND type='contract_expiry'
         AND created_at::date = CURRENT_DATE) THEN CONTINUE; END IF;
    FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
      JOIN public.user_profiles up ON up.id=ur.user_id AND up.is_active=true
      WHERE ur.role IN ('ceo_admin','coo_ops')
    LOOP
      INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
      VALUES (r.user_id, 'Contract expiring',
        '⚠️ Contract for ' || c.client_name || ' expires in ' || days_left || ' days.',
        'contract_expiry', c.id, c.is_sandbox);
    END LOOP;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- Override wipe_sandbox to include new tables
CREATE OR REPLACE FUNCTION public.wipe_sandbox()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'ceo_admin') THEN RAISE EXCEPTION 'Only CEO can wipe sandbox'; END IF;
  IF public.current_environment() <> 'sandbox' THEN RAISE EXCEPTION 'Wipe only allowed in sandbox mode'; END IF;
  DELETE FROM public.advance_recovery_schedule WHERE is_sandbox=true;
  DELETE FROM public.employee_advances WHERE is_sandbox=true;
  DELETE FROM public.employee_ffs WHERE is_sandbox=true;
  DELETE FROM public.employee_deployments WHERE is_sandbox=true;
  DELETE FROM public.contract_renewals WHERE new_contract_id IN (SELECT id FROM public.client_contracts WHERE is_sandbox=true);
  DELETE FROM public.client_contracts WHERE is_sandbox=true;
  DELETE FROM public.payments WHERE is_sandbox=true;
  DELETE FROM public.financial_ledger WHERE is_sandbox=true;
  DELETE FROM public.invoices WHERE is_sandbox=true;
  DELETE FROM public.paysheet_employees WHERE is_sandbox=true;
  DELETE FROM public.paysheets WHERE is_sandbox=true;
  DELETE FROM public.client_billing_lines WHERE is_sandbox=true;
  DELETE FROM public.client_wage_config WHERE is_sandbox=true;
  DELETE FROM public.invoice_number_seq WHERE is_sandbox=true;
  INSERT INTO public.audit_logs(user_id,action,table_name) VALUES (auth.uid(),'DELETE','sandbox_wipe');
END $$;

-- Deployment helper
CREATE OR REPLACE FUNCTION public.create_deployment(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_emp uuid := (_payload->>'employee_id')::uuid;
  v_start date := (_payload->>'deployment_start_date')::date;
  v_id uuid;
  v_sandbox boolean := public.is_sandbox_env();
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can deploy';
  END IF;
  -- end any current deployment
  UPDATE public.employee_deployments
    SET is_current=false, deployment_end_date = v_start - 1, updated_at=now()
    WHERE employee_id=v_emp AND is_current=true;
  INSERT INTO public.employee_deployments(
    employee_id, client_id, shift_id, post_id, deployment_start_date, notes,
    is_current, created_by, is_sandbox
  ) VALUES (
    v_emp, (_payload->>'client_id')::uuid, (_payload->>'shift_id')::uuid,
    NULLIF(_payload->>'post_id','')::uuid, v_start, _payload->>'notes',
    true, v_uid, v_sandbox
  ) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id) VALUES (v_uid,'CREATE','employee_deployments',v_id);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.relieve_deployment(_id uuid, _end date, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can relieve';
  END IF;
  UPDATE public.employee_deployments
    SET is_current=false, deployment_end_date=_end, relieved_reason=_reason, updated_at=now()
    WHERE id=_id;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'RELIEVE','employee_deployments',_id, jsonb_build_object('end',_end));
END $$;

