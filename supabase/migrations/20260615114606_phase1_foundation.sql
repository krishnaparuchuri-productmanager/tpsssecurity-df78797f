-- ============================================================================
-- PHASE 1: Internal Admin App Foundation
-- ============================================================================
CREATE TYPE public.app_role AS ENUM ('ceo_admin', 'coo_ops', 'accountant');

CREATE TABLE public.user_profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'ceo_admin' THEN 1 WHEN 'coo_ops' THEN 2 WHEN 'accountant' THEN 3 END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _screen TEXT, _action TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role; _allowed BOOLEAN;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT can_%I FROM public.role_permissions WHERE role = $1 AND screen_name = $2 LIMIT 1', _action)
  INTO _allowed USING _role, _screen;
  RETURN COALESCE(_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_active FROM public.user_profiles WHERE id = _user_id), false)
$$;

CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  screen_name TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_approve BOOLEAN NOT NULL DEFAULT false,
  can_export BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, screen_name)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'Trinetra Professional Security Services',
  entity_type TEXT NOT NULL DEFAULT 'Proprietorship',
  pan_number TEXT, gst_number TEXT, gst_effective_from DATE, cin_number TEXT,
  registered_address TEXT, state TEXT NOT NULL DEFAULT 'Andhra Pradesh',
  logo_url TEXT, phone TEXT, email TEXT, website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE public.clients_code_seq START 1;
CREATE SEQUENCE public.employees_code_seq START 1;

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  service_type TEXT NOT NULL DEFAULT 'Security',
  contract_value NUMERIC(14,2) DEFAULT 0,
  contract_start_date DATE, contract_end_date DATE,
  tds_percentage NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  gst_applicable BOOLEAN NOT NULL DEFAULT false,
  gst_percentage NUMERIC(5,2) NOT NULL DEFAULT 18.0,
  gst_number TEXT, billing_frequency TEXT NOT NULL DEFAULT 'Monthly',
  state TEXT NOT NULL DEFAULT 'Andhra Pradesh',
  address TEXT, contact_person TEXT, contact_phone TEXT, contact_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true, notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_mw_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  designation TEXT NOT NULL,
  basic NUMERIC(12,2) NOT NULL DEFAULT 0, da NUMERIC(12,2) NOT NULL DEFAULT 0,
  ta NUMERIC(12,2) NOT NULL DEFAULT 0, epf_mw_wages NUMERIC(12,2) NOT NULL DEFAULT 0,
  esi_mw_wages NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE, effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_mw_rates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_client_mw_rates_client ON public.client_mw_rates(client_id);

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
  uan_number TEXT, esi_number TEXT, designation TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  basic NUMERIC(12,2) NOT NULL DEFAULT 0, da NUMERIC(12,2) NOT NULL DEFAULT 0,
  ta NUMERIC(12,2) NOT NULL DEFAULT 0,
  weekly_off_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  washing_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  conveyance_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  spl_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
  payable_gross NUMERIC(14,2) GENERATED ALWAYS AS (
    COALESCE(basic,0)+COALESCE(da,0)+COALESCE(ta,0)+COALESCE(weekly_off_allowance,0)
    +COALESCE(washing_allowance,0)+COALESCE(conveyance_allowance,0)+COALESCE(spl_allowance,0)
  ) STORED,
  date_of_joining DATE NOT NULL DEFAULT CURRENT_DATE, date_of_leaving DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  bank_account_number TEXT, bank_ifsc TEXT, bank_name TEXT,
  aadhaar_number TEXT, mobile TEXT,
  is_new_joiner BOOLEAN NOT NULL DEFAULT false,
  epf_exempt BOOLEAN NOT NULL DEFAULT false, esi_exempt BOOLEAN NOT NULL DEFAULT false,
  notes TEXT, created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_employees_client ON public.employees(client_id);
CREATE INDEX idx_employees_status ON public.employees(status);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, message TEXT NOT NULL, type TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false, related_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, table_name TEXT, record_id UUID,
  old_values JSONB, new_values JSONB, ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_company_profile_updated BEFORE UPDATE ON public.company_profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.gen_client_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
    NEW.client_code := 'CLT-' || LPAD(nextval('public.clients_code_seq')::TEXT, 3, '0');
  END IF; RETURN NEW;
END; $$;
CREATE TRIGGER trg_clients_code BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.gen_client_code();

CREATE OR REPLACE FUNCTION public.gen_employee_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    NEW.employee_code := 'EMP-' || LPAD(nextval('public.employees_code_seq')::TEXT, 3, '0');
  END IF; RETURN NEW;
END; $$;
CREATE TRIGGER trg_employees_code BEFORE INSERT ON public.employees FOR EACH ROW EXECUTE FUNCTION public.gen_employee_code();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email)
  ON CONFLICT (id) DO NOTHING; RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
CREATE POLICY "Users read own profile" ON public.user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins read all profiles" ON public.user_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ceo_admin'));
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins update all profiles" ON public.user_profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ceo_admin'));
CREATE POLICY "Admins insert profiles" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ceo_admin'));

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ceo_admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ceo_admin')) WITH CHECK (public.has_role(auth.uid(), 'ceo_admin'));

CREATE POLICY "Authenticated read permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update permissions" ON public.role_permissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ceo_admin'));
CREATE POLICY "Admins insert permissions" ON public.role_permissions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ceo_admin'));

CREATE POLICY "Authenticated read company" ON public.company_profile FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update company" ON public.company_profile FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ceo_admin'));
CREATE POLICY "Admins insert company" ON public.company_profile FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ceo_admin'));

CREATE POLICY "View clients by permission" ON public.clients FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'clients', 'view'));
CREATE POLICY "Create clients by permission" ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'clients', 'create'));
CREATE POLICY "Edit clients by permission" ON public.clients FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'clients', 'edit'));

CREATE POLICY "View mw rates by permission" ON public.client_mw_rates FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'clients', 'view'));
CREATE POLICY "Create mw rates by permission" ON public.client_mw_rates FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'clients', 'create'));
CREATE POLICY "Edit mw rates by permission" ON public.client_mw_rates FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'clients', 'edit'));
CREATE POLICY "Delete mw rates by permission" ON public.client_mw_rates FOR DELETE TO authenticated USING (public.has_permission(auth.uid(), 'clients', 'edit'));

CREATE POLICY "View employees by permission" ON public.employees FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'employees', 'view'));
CREATE POLICY "Create employees by permission" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'employees', 'create'));
CREATE POLICY "Edit employees by permission" ON public.employees FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'employees', 'edit'));

CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Authenticated insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ceo_admin'));

-- Seed data
INSERT INTO public.role_permissions (role, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_export) VALUES
  ('ceo_admin','dashboard',true,true,true,true,true,true),('ceo_admin','clients',true,true,true,true,true,true),
  ('ceo_admin','employees',true,true,true,true,true,true),('ceo_admin','company_profile',true,true,true,true,true,true),
  ('ceo_admin','payroll',true,true,true,true,true,true),('ceo_admin','reports',true,true,true,true,true,true),
  ('ceo_admin','expenses',true,true,true,true,true,true),('ceo_admin','compliance',true,true,true,true,true,true),
  ('ceo_admin','users',true,true,true,true,true,true),('ceo_admin','permissions',true,true,true,true,true,true),
  ('ceo_admin','audit_logs',true,false,false,false,false,true),
  ('coo_ops','dashboard',true,false,false,false,false,true),('coo_ops','clients',true,false,false,false,true,true),
  ('coo_ops','employees',true,false,false,false,true,true),('coo_ops','company_profile',true,false,false,false,false,true),
  ('coo_ops','payroll',true,false,false,false,true,true),('coo_ops','reports',true,false,false,false,false,true),
  ('coo_ops','expenses',true,false,false,false,true,true),('coo_ops','compliance',true,false,false,false,true,true),
  ('accountant','dashboard',true,false,false,false,false,false),('accountant','clients',true,false,false,false,false,false),
  ('accountant','employees',true,false,false,false,false,false),('accountant','payroll',true,true,true,false,false,false),
  ('accountant','expenses',true,true,true,false,false,false),('accountant','compliance',true,false,false,false,false,false);

INSERT INTO public.company_profile (company_name, entity_type, registered_address, state, phone, email, website)
VALUES ('Trinetra Professional Security Services','Proprietorship','Andhra Pradesh, India','Andhra Pradesh','','info@tpsssecurity.com','https://www.tpsssecurity.com');

