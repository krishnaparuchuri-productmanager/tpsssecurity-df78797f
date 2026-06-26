-- =====================================================================
-- PHASE 2 — MILESTONE 1: DATABASE FOUNDATION
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE public.paysheet_status AS ENUM ('draft','submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','sent','partially_paid','paid','overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ledger_entry_type AS ENUM ('receipt','payment','journal','contra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.ledger_category AS ENUM (
    'client_billing','payment_received','epf_payment','esi_payment','gst_payment','pt_payment',
    'staff_salary','salary_advance','advance_recovery','admin_expense','vehicle_expense',
    'other_income','other_expense'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.client_type_enum AS ENUM ('individual_huf','company_firm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL, value text NOT NULL,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_config (key, value) VALUES ('environment','sandbox') ON CONFLICT (key) DO NOTHING;
CREATE POLICY "All active users read app_config" ON public.app_config FOR SELECT TO authenticated USING (public.is_active_user(auth.uid()));
CREATE POLICY "CEO insert app_config" ON public.app_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'ceo_admin') AND public.is_active_user(auth.uid()));
CREATE POLICY "CEO update app_config" ON public.app_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'ceo_admin') AND public.is_active_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.current_environment()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value FROM public.app_config WHERE key='environment' LIMIT 1),'sandbox')
$$;
CREATE OR REPLACE FUNCTION public.is_sandbox_env()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_environment() = 'sandbox'
$$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'company_firm',
  ADD COLUMN IF NOT EXISTS tds_rate numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS gst_rcm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_prefix text,
  ADD COLUMN IF NOT EXISTS pt_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS e_invoice_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
UPDATE public.clients SET tds_rate = COALESCE(tds_percentage,1.0) WHERE tds_rate = 1.0;
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT true;
ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS pf_code text,
  ADD COLUMN IF NOT EXISTS esi_code text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS bank_ifsc text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS iso_certification text DEFAULT 'ISO:9001:2015',
  ADD COLUMN IF NOT EXISTS invoice_location_code text DEFAULT 'NLR',
  ADD COLUMN IF NOT EXISTS jurisdiction text DEFAULT 'Subject to Nellore Jurisdiction';
UPDATE public.company_profile SET email = 'admin@tpsssecurity.com' WHERE email IS NULL OR email = '';

CREATE TABLE IF NOT EXISTS public.client_wage_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  designation text NOT NULL,
  basic numeric NOT NULL DEFAULT 0, da numeric NOT NULL DEFAULT 0,
  ta numeric NOT NULL DEFAULT 0, four_hour_ot_rate numeric NOT NULL DEFAULT 0,
  weekly_off_allowance numeric NOT NULL DEFAULT 0, washing_allowance numeric NOT NULL DEFAULT 0,
  conveyance_allowance numeric NOT NULL DEFAULT 0, spl_allowance numeric NOT NULL DEFAULT 0,
  bonus_amount numeric NOT NULL DEFAULT 0, relieving_charges numeric NOT NULL DEFAULT 0,
  leave_wages numeric NOT NULL DEFAULT 0, payable_gross numeric NOT NULL DEFAULT 0,
  epf_mw_wages numeric NOT NULL DEFAULT 0, esi_mw_wages numeric NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_to date,
  is_current boolean NOT NULL DEFAULT true, notes text,
  is_sandbox boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false, deleted_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_wage_config ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cwc_client ON public.client_wage_config(client_id, is_current);
CREATE POLICY "View wage_config by perm" ON public.client_wage_config FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'clients','view') AND public.is_active_user(auth.uid()) AND is_deleted = false);
CREATE POLICY "Create wage_config by perm" ON public.client_wage_config FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'clients','create') AND public.is_active_user(auth.uid()));
CREATE POLICY "Edit wage_config by perm" ON public.client_wage_config FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'clients','edit') AND public.is_active_user(auth.uid()));
CREATE TRIGGER trg_cwc_updated_at BEFORE UPDATE ON public.client_wage_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.client_billing_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL, description text NOT NULL, sac_code text,
  rate_per_month numeric NOT NULL DEFAULT 0, unit_label text NOT NULL DEFAULT 'Guard',
  is_active boolean NOT NULL DEFAULT true, sort_order integer NOT NULL DEFAULT 1,
  is_sandbox boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_billing_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cbl_client ON public.client_billing_lines(client_id);
CREATE POLICY "View billing_lines by perm" ON public.client_billing_lines FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'clients','view') AND public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Create billing_lines by perm" ON public.client_billing_lines FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'clients','create') AND public.is_active_user(auth.uid()));
CREATE POLICY "Edit billing_lines by perm" ON public.client_billing_lines FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'clients','edit') AND public.is_active_user(auth.uid()));
CREATE TRIGGER trg_cbl_updated_at BEFORE UPDATE ON public.client_billing_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.invoice_deduction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE, template_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_deduction_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View deduction_templates by perm" ON public.invoice_deduction_templates FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'clients','view') AND public.is_active_user(auth.uid()));
CREATE POLICY "Create deduction_templates by perm" ON public.invoice_deduction_templates FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'clients','create') AND public.is_active_user(auth.uid()));
CREATE POLICY "Edit deduction_templates by perm" ON public.invoice_deduction_templates FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'clients','edit') AND public.is_active_user(auth.uid()));
CREATE TRIGGER trg_idt_updated_at BEFORE UPDATE ON public.invoice_deduction_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.paysheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paysheet_number text UNIQUE NOT NULL, client_id uuid NOT NULL,
  month text NOT NULL, month_date date NOT NULL, total_days_in_month integer NOT NULL,
  total_employees integer NOT NULL DEFAULT 0, total_earned_wages numeric NOT NULL DEFAULT 0,
  total_epf_employee numeric NOT NULL DEFAULT 0, total_epf_employer numeric NOT NULL DEFAULT 0,
  total_esi_employee numeric NOT NULL DEFAULT 0, total_esi_employer numeric NOT NULL DEFAULT 0,
  total_pt_deduction numeric NOT NULL DEFAULT 0, total_advance_deductions numeric NOT NULL DEFAULT 0,
  total_net_salary numeric NOT NULL DEFAULT 0, anomaly_count integer NOT NULL DEFAULT 0,
  status public.paysheet_status NOT NULL DEFAULT 'draft',
  submitted_by uuid, submitted_at timestamptz, approved_by uuid, approved_at timestamptz,
  rejection_reason text,
  is_sandbox boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false, deleted_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_approver_diff CHECK (approved_by IS NULL OR submitted_by IS NULL OR approved_by <> submitted_by),
  CONSTRAINT chk_rejection_len CHECK (rejection_reason IS NULL OR (length(rejection_reason) BETWEEN 10 AND 200))
);
ALTER TABLE public.paysheets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_paysheets_client_month ON public.paysheets(client_id, month_date);
CREATE INDEX IF NOT EXISTS idx_paysheets_status ON public.paysheets(status);
CREATE POLICY "View paysheets" ON public.paysheets FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Create paysheets" ON public.paysheets FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'ceo_admin')) AND status='draft');
CREATE POLICY "Update paysheets" ON public.paysheets FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE TRIGGER trg_paysheets_updated_at BEFORE UPDATE ON public.paysheets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_paysheet_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); is_acc boolean := public.has_role(uid,'accountant');
  is_ceo boolean := public.has_role(uid,'ceo_admin'); is_coo boolean := public.has_role(uid,'coo_ops');
BEGIN
  IF NEW.status = 'approved' AND is_acc AND NOT is_ceo AND NOT is_coo THEN
    RAISE EXCEPTION 'Accountants cannot approve paysheets'; END IF;
  IF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL AND NEW.submitted_by IS NOT NULL
     AND NEW.approved_by = NEW.submitted_by THEN RAISE EXCEPTION 'Cannot approve own submission'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('submitted','approved','rejected') AND is_acc
     AND NOT is_ceo AND NOT is_coo AND NEW.status NOT IN ('draft') AND OLD.status <> 'rejected' THEN
    IF NOT (OLD.status='rejected' AND NEW.status='draft') THEN
      RAISE EXCEPTION 'Submitted paysheets cannot be edited by accountant'; END IF; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_paysheet_status BEFORE UPDATE ON public.paysheets FOR EACH ROW EXECUTE FUNCTION public.guard_paysheet_status();

CREATE TABLE IF NOT EXISTS public.paysheet_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paysheet_id uuid NOT NULL REFERENCES public.paysheets(id) ON DELETE CASCADE,
  employee_id uuid, uan_number text, esi_number text,
  employee_name text NOT NULL, designation text NOT NULL,
  basic numeric NOT NULL DEFAULT 0, da numeric NOT NULL DEFAULT 0,
  ta numeric NOT NULL DEFAULT 0, four_hour_ot numeric NOT NULL DEFAULT 0,
  weekly_off numeric NOT NULL DEFAULT 0, bonus numeric NOT NULL DEFAULT 0,
  relieving_charges numeric NOT NULL DEFAULT 0, leave_wages numeric NOT NULL DEFAULT 0,
  conveyance_allowance numeric NOT NULL DEFAULT 0, washing_allowance numeric NOT NULL DEFAULT 0,
  spl_allowance numeric NOT NULL DEFAULT 0, payable_gross numeric NOT NULL DEFAULT 0,
  working_days integer NOT NULL DEFAULT 30, no_of_duties numeric NOT NULL DEFAULT 0,
  earned_wages numeric NOT NULL DEFAULT 0, epf_mw_wages numeric NOT NULL DEFAULT 0,
  epf_wages numeric NOT NULL DEFAULT 0, epf_employee_deduction numeric NOT NULL DEFAULT 0,
  epf_employer_contribution numeric NOT NULL DEFAULT 0, esi_wages numeric NOT NULL DEFAULT 0,
  esi_employee_deduction numeric NOT NULL DEFAULT 0, esi_employer_contribution numeric NOT NULL DEFAULT 0,
  pt_deduction numeric NOT NULL DEFAULT 0, net_salary numeric NOT NULL DEFAULT 0,
  advance_deduction numeric NOT NULL DEFAULT 0, final_net_salary numeric NOT NULL DEFAULT 0,
  is_new_joiner boolean NOT NULL DEFAULT false, anomaly_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text, is_sandbox boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.paysheet_employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pse_paysheet ON public.paysheet_employees(paysheet_id);
CREATE POLICY "View paysheet_employees" ON public.paysheet_employees FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Manage paysheet_employees" ON public.paysheet_employees FOR ALL TO authenticated
  USING (public.is_active_user(auth.uid())) WITH CHECK (public.is_active_user(auth.uid()));
CREATE TRIGGER trg_pse_updated_at BEFORE UPDATE ON public.paysheet_employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL, client_id uuid NOT NULL,
  paysheet_id uuid REFERENCES public.paysheets(id),
  month text NOT NULL, month_date date NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE, due_date date,
  service_period_from date, service_period_to date,
  billing_lines jsonb NOT NULL DEFAULT '[]'::jsonb, billing_amount numeric NOT NULL DEFAULT 0,
  tds_percentage numeric NOT NULL DEFAULT 1, tds_amount numeric NOT NULL DEFAULT 0,
  gst_applicable boolean NOT NULL DEFAULT false, gst_rcm boolean NOT NULL DEFAULT false,
  gst_percentage numeric NOT NULL DEFAULT 18, gst_amount numeric NOT NULL DEFAULT 0,
  total_taxable_value numeric NOT NULL DEFAULT 0, total_invoice_value numeric NOT NULL DEFAULT 0,
  amount_receivable numeric NOT NULL DEFAULT 0, deduction_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_deductions numeric NOT NULL DEFAULT 0, net_margin numeric NOT NULL DEFAULT 0,
  amount_received numeric NOT NULL DEFAULT 0, outstanding_amount numeric NOT NULL DEFAULT 0,
  amount_in_words text, invoice_notes text, template_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.invoice_status NOT NULL DEFAULT 'draft', irn_number text, qr_code_data text,
  is_sandbox boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false, deleted_at timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_gst_pct CHECK (gst_percentage BETWEEN 0 AND 100),
  CONSTRAINT chk_tds_pct CHECK (tds_percentage BETWEEN 0 AND 100)
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE POLICY "View invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Create invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND
    (public.has_role(auth.uid(),'accountant') OR public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops')));
CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL, client_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount > 0), payment_mode text NOT NULL,
  reference_number text, bank_name text, notes text, recorded_by uuid,
  is_sandbox boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE POLICY "View payments" ON public.payments FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Create payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND
    (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops') OR public.has_role(auth.uid(),'accountant')));

CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number text UNIQUE NOT NULL, entry_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_type public.ledger_entry_type NOT NULL, category public.ledger_category NOT NULL,
  particulars text NOT NULL CHECK (length(particulars) <= 500), client_id uuid,
  debit_amount numeric NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
  credit_amount numeric NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  balance_after numeric NOT NULL DEFAULT 0, reference_id uuid, reference_type text,
  created_by uuid, is_sandbox boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ledger_date ON public.financial_ledger(entry_date);
CREATE POLICY "View ledger" ON public.financial_ledger FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND is_deleted=false);
CREATE POLICY "Create ledger" ON public.financial_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND
    (public.has_role(auth.uid(),'ceo_admin') OR public.has_role(auth.uid(),'coo_ops') OR public.has_role(auth.uid(),'accountant')));

CREATE SEQUENCE IF NOT EXISTS public.paysheet_seq;
CREATE SEQUENCE IF NOT EXISTS public.receipt_seq;
CREATE SEQUENCE IF NOT EXISTS public.voucher_seq;

CREATE OR REPLACE FUNCTION public.gen_paysheet_number(_month_date date, _sandbox boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prefix text := CASE WHEN _sandbox THEN 'TEST-PS-' ELSE 'PS-' END;
  mm text := upper(to_char(_month_date,'MonYYYY')); n integer := nextval('public.paysheet_seq');
BEGIN RETURN prefix || mm || '-' || lpad(n::text, 3, '0'); END $$;

CREATE OR REPLACE FUNCTION public.gen_receipt_number(_d date, _sandbox boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prefix text := CASE WHEN _sandbox THEN 'TEST-REC-' ELSE 'REC-' END;
  mm text := upper(to_char(_d,'MonYYYY')); n integer := nextval('public.receipt_seq');
BEGIN RETURN prefix || mm || '-' || lpad(n::text, 3, '0'); END $$;

CREATE OR REPLACE FUNCTION public.gen_voucher_number(_d date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := nextval('public.voucher_seq');
BEGIN RETURN 'VCH-' || to_char(_d,'YYYYMMDD') || '-' || lpad(n::text, 3, '0'); END $$;

CREATE TABLE IF NOT EXISTS public.invoice_number_seq (
  prefix text NOT NULL, fy text NOT NULL, is_sandbox boolean NOT NULL,
  last_number integer NOT NULL DEFAULT 0, PRIMARY KEY (prefix, fy, is_sandbox)
);
ALTER TABLE public.invoice_number_seq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct access" ON public.invoice_number_seq FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.fy_string(_d date)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN extract(month from _d) >= 4 THEN
    to_char(_d,'YY') || '-' || to_char(_d + interval '1 year','YY')
  ELSE to_char(_d - interval '1 year','YY') || '-' || to_char(_d,'YY') END
$$;

CREATE OR REPLACE FUNCTION public.gen_invoice_number(_client_id uuid, _invoice_date date, _sandbox boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefix text; v_fy text := public.fy_string(_invoice_date); v_n integer;
BEGIN
  SELECT COALESCE(NULLIF(c.invoice_prefix,''), (SELECT invoice_location_code FROM public.company_profile LIMIT 1), 'INV')
    INTO v_prefix FROM public.clients c WHERE c.id = _client_id;
  INSERT INTO public.invoice_number_seq(prefix, fy, is_sandbox, last_number)
    VALUES (v_prefix, v_fy, _sandbox, 1)
    ON CONFLICT (prefix, fy, is_sandbox)
    DO UPDATE SET last_number = public.invoice_number_seq.last_number + 1
    RETURNING last_number INTO v_n;
  RETURN CASE WHEN _sandbox THEN 'TEST-' ELSE '' END
    || v_prefix || '/' || v_fy || '/' || lpad(v_n::text, 3, '0');
END $$;

CREATE OR REPLACE FUNCTION public._iw_under_hundred(n integer)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  ones text[] := ARRAY['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  tens text[] := ARRAY['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
BEGIN
  IF n < 20 THEN RETURN ones[n+1]; END IF;
  RETURN trim(tens[(n/10)+1] || CASE WHEN n%10>0 THEN ' '||ones[(n%10)+1] ELSE '' END);
END $$;

CREATE OR REPLACE FUNCTION public.amount_in_words_inr(amt numeric)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  rupees bigint := floor(amt)::bigint; paise integer := round((amt - floor(amt))*100)::integer;
  crore bigint; lakh integer; thou integer; hund integer; rest integer; out text := '';
BEGIN
  IF rupees = 0 THEN out := 'Zero'; ELSE
    crore := rupees / 10000000; rest := (rupees % 10000000)::integer;
    lakh := rest / 100000; rest := rest % 100000;
    thou := rest / 1000; rest := rest % 1000;
    hund := rest / 100; rest := rest % 100;
    IF crore > 0 THEN out := out || public.amount_in_words_inr(crore) || ' Crore '; END IF;
    IF lakh > 0 THEN out := out || public._iw_under_hundred(lakh) || ' Lakh '; END IF;
    IF thou > 0 THEN out := out || public._iw_under_hundred(thou) || ' Thousand '; END IF;
    IF hund > 0 THEN out := out || public._iw_under_hundred(hund) || ' Hundred '; END IF;
    IF rest > 0 THEN
      IF (crore+lakh+thou+hund) > 0 THEN out := out || 'and '; END IF;
      out := out || public._iw_under_hundred(rest) || ' '; END IF; END IF;
  out := trim(regexp_replace(out,'\s+',' ','g')) || ' Rupees';
  IF paise > 0 THEN out := out || ' and ' || public._iw_under_hundred(paise) || ' Paise'; END IF;
  RETURN out || ' only';
END $$;

CREATE OR REPLACE FUNCTION public.calc_invoice_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  NEW.outstanding_amount := NEW.net_margin - COALESCE(NEW.amount_received,0);
  NEW.amount_in_words := public.amount_in_words_inr(NEW.total_invoice_value);
  IF TG_OP = 'INSERT' AND (NEW.invoice_number IS NULL OR NEW.invoice_number='') THEN
    NEW.invoice_number := public.gen_invoice_number(NEW.client_id, NEW.invoice_date, COALESCE(NEW.is_sandbox, public.is_sandbox_env()));
  END IF;
  IF NEW.service_period_from IS NULL THEN NEW.service_period_from := date_trunc('month', NEW.month_date)::date; END IF;
  IF NEW.service_period_to IS NULL THEN NEW.service_period_to := (date_trunc('month', NEW.month_date) + interval '1 month - 1 day')::date; END IF;
  IF NEW.due_date IS NULL THEN NEW.due_date := NEW.invoice_date + 30; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_calc_invoice BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.calc_invoice_fields();

CREATE OR REPLACE FUNCTION public.handle_new_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv public.invoices%ROWTYPE; v_received numeric; v_status public.invoice_status; v_balance numeric;
BEGIN
  IF NEW.receipt_number IS NULL OR NEW.receipt_number = '' THEN
    NEW.receipt_number := public.gen_receipt_number(NEW.payment_date, COALESCE(NEW.is_sandbox, public.is_sandbox_env()));
  END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_before BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.handle_new_payment();

CREATE OR REPLACE FUNCTION public.after_payment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.invoices%ROWTYPE; v_received numeric; v_status public.invoice_status;
  v_balance numeric; v_voucher text;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
  v_received := COALESCE(v_inv.amount_received, 0) + NEW.amount;
  IF v_received >= v_inv.net_margin THEN v_status := 'paid';
  ELSIF v_received > 0 THEN v_status := 'partially_paid';
  ELSE v_status := v_inv.status; END IF;
  UPDATE public.invoices SET amount_received = v_received,
    outstanding_amount = v_inv.net_margin - v_received, status = v_status WHERE id = NEW.invoice_id;
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
END $$;
CREATE TRIGGER trg_payment_after AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.after_payment_insert();

CREATE OR REPLACE FUNCTION public.wipe_sandbox()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'ceo_admin') THEN RAISE EXCEPTION 'Only CEO can wipe sandbox'; END IF;
  IF public.current_environment() <> 'sandbox' THEN RAISE EXCEPTION 'Wipe only allowed in sandbox mode'; END IF;
  DELETE FROM public.payments WHERE is_sandbox = true;
  DELETE FROM public.financial_ledger WHERE is_sandbox = true;
  DELETE FROM public.invoices WHERE is_sandbox = true;
  DELETE FROM public.paysheet_employees WHERE is_sandbox = true;
  DELETE FROM public.paysheets WHERE is_sandbox = true;
  DELETE FROM public.client_billing_lines WHERE is_sandbox = true;
  DELETE FROM public.client_wage_config WHERE is_sandbox = true;
  DELETE FROM public.invoice_number_seq WHERE is_sandbox = true;
  INSERT INTO public.audit_logs(user_id, action, table_name) VALUES (auth.uid(), 'DELETE', 'sandbox_wipe');
END $$;

CREATE OR REPLACE FUNCTION public.notify_env_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor_name text;
BEGIN
  IF NEW.key <> 'environment' OR (TG_OP='UPDATE' AND OLD.value = NEW.value) THEN RETURN NEW; END IF;
  SELECT COALESCE(full_name, email) INTO actor_name FROM public.user_profiles WHERE id = NEW.updated_by;
  INSERT INTO public.notifications(user_id, title, message, type, is_sandbox)
    SELECT id, 'Environment switched',
      '🔄 Switched to ' || upper(NEW.value) || ' by ' || COALESCE(actor_name,'system'),
      'system', (NEW.value = 'sandbox')
    FROM public.user_profiles WHERE is_active = true;
  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, old_values, new_values)
    VALUES (NEW.updated_by, 'UPDATE', 'app_config', NEW.id,
      CASE WHEN TG_OP='UPDATE' THEN jsonb_build_object('value', OLD.value) ELSE NULL END,
      jsonb_build_object('value', NEW.value));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_env_change AFTER UPDATE OR INSERT ON public.app_config FOR EACH ROW EXECUTE FUNCTION public.notify_env_change();

CREATE OR REPLACE FUNCTION public.version_wage_config()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.client_wage_config
      SET is_current = false, effective_to = COALESCE(effective_to, NEW.effective_from - 1)
      WHERE client_id = NEW.client_id AND designation = NEW.designation
        AND id <> NEW.id AND is_current = true; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_version_wage_config AFTER INSERT ON public.client_wage_config FOR EACH ROW EXECUTE FUNCTION public.version_wage_config();

