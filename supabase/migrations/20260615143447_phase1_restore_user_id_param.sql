-- Honor _user_id in has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Honor _user_id in get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role WHEN 'ceo_admin' THEN 1 WHEN 'coo_ops' THEN 2 WHEN 'accountant' THEN 3 END LIMIT 1
$$;

-- Honor _user_id in is_active_user
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_active FROM public.user_profiles WHERE id = _user_id), false)
$$;

-- Replace dynamic EXECUTE with a safe static CASE lookup
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _screen text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE _action
        WHEN 'view'    THEN rp.can_view
        WHEN 'create'  THEN rp.can_create
        WHEN 'edit'    THEN rp.can_edit
        WHEN 'delete'  THEN rp.can_delete
        WHEN 'approve' THEN rp.can_approve
        WHEN 'export'  THEN rp.can_export
        ELSE false END
     FROM public.role_permissions rp
     JOIN public.user_roles ur ON ur.role = rp.role
     WHERE ur.user_id = _user_id AND rp.screen_name = _screen LIMIT 1),
    false)
$$;

