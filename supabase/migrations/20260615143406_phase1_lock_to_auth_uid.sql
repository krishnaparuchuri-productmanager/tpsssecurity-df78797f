-- Lock down SECURITY DEFINER helpers to always use auth.uid()
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'ceo_admin' THEN 1 WHEN 'coo_ops' THEN 2 WHEN 'accountant' THEN 3 END LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _screen text, _action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _role public.app_role; _allowed boolean;
BEGIN
  SELECT role INTO _role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF _role IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT can_%I FROM public.role_permissions WHERE role = $1 AND screen_name = $2 LIMIT 1', _action)
  INTO _allowed USING _role, _screen;
  RETURN COALESCE(_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_active FROM public.user_profiles WHERE id = auth.uid()), false)
$$;

-- Audit logs
DROP POLICY IF EXISTS "Insert audit as self" ON public.audit_logs;
CREATE POLICY "Insert audit as self" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins read audit" ON public.audit_logs;
CREATE POLICY "Admins read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));

-- Employees delete policy
DROP POLICY IF EXISTS "Delete employees by permission" ON public.employees;
CREATE POLICY "Delete employees by permission" ON public.employees FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'employees', 'delete') AND public.is_active_user(auth.uid()));

-- client_mw_rates with is_active
DROP POLICY IF EXISTS "View mw rates by permission" ON public.client_mw_rates;
CREATE POLICY "View mw rates by permission" ON public.client_mw_rates FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'clients', 'view') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Create mw rates by permission" ON public.client_mw_rates;
CREATE POLICY "Create mw rates by permission" ON public.client_mw_rates FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'clients', 'create') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Edit mw rates by permission" ON public.client_mw_rates;
CREATE POLICY "Edit mw rates by permission" ON public.client_mw_rates FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'clients', 'edit') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Delete mw rates by permission" ON public.client_mw_rates;
CREATE POLICY "Delete mw rates by permission" ON public.client_mw_rates FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'clients', 'edit') AND public.is_active_user(auth.uid()));

-- clients with is_active
DROP POLICY IF EXISTS "View clients by permission" ON public.clients;
CREATE POLICY "View clients by permission" ON public.clients FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'clients', 'view') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Create clients by permission" ON public.clients;
CREATE POLICY "Create clients by permission" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'clients', 'create') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Edit clients by permission" ON public.clients;
CREATE POLICY "Edit clients by permission" ON public.clients FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'clients', 'edit') AND public.is_active_user(auth.uid()));

-- company_profile with is_active
DROP POLICY IF EXISTS "Authenticated read company" ON public.company_profile;
CREATE POLICY "Authenticated read company" ON public.company_profile FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins insert company" ON public.company_profile;
CREATE POLICY "Admins insert company" ON public.company_profile FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins update company" ON public.company_profile;
CREATE POLICY "Admins update company" ON public.company_profile FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));

-- employees with is_active
DROP POLICY IF EXISTS "View employees by permission" ON public.employees;
CREATE POLICY "View employees by permission" ON public.employees FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'employees', 'view') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Create employees by permission" ON public.employees;
CREATE POLICY "Create employees by permission" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'employees', 'create') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Edit employees by permission" ON public.employees;
CREATE POLICY "Edit employees by permission" ON public.employees FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'employees', 'edit') AND public.is_active_user(auth.uid()));

-- notifications with is_active
DROP POLICY IF EXISTS "Read own notifications" ON public.notifications;
CREATE POLICY "Read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Update own notifications" ON public.notifications;
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Insert notifications for self or by admin" ON public.notifications;
CREATE POLICY "Insert notifications for self or by admin" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'ceo_admin') OR public.has_role(auth.uid(), 'coo_ops')));

-- role_permissions with is_active
DROP POLICY IF EXISTS "Authenticated read permissions" ON public.role_permissions;
CREATE POLICY "Authenticated read permissions" ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins insert permissions" ON public.role_permissions;
CREATE POLICY "Admins insert permissions" ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins update permissions" ON public.role_permissions;
CREATE POLICY "Admins update permissions" ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));

-- user_profiles with is_active
DROP POLICY IF EXISTS "Users read own profile" ON public.user_profiles;
CREATE POLICY "Users read own profile" ON public.user_profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Users update own profile" ON public.user_profiles;
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.is_active_user(auth.uid())) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Admins read all profiles" ON public.user_profiles;
CREATE POLICY "Admins read all profiles" ON public.user_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins insert profiles" ON public.user_profiles;
CREATE POLICY "Admins insert profiles" ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins update all profiles" ON public.user_profiles;
CREATE POLICY "Admins update all profiles" ON public.user_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));

-- user_roles with is_active
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins read all roles" ON public.user_roles;
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'ceo_admin') AND public.is_active_user(auth.uid()));

