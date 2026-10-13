-- OF-01: never allow the last active Super Admin to be demoted, deleted,
-- deactivated or removed (that would lock everyone out of administration).

CREATE OR REPLACE FUNCTION public.guard_last_super_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
  v_losing boolean := false;
  v_others int;
BEGIN
  IF TG_TABLE_NAME = 'user_roles' THEN
    v_user := OLD.user_id;
    v_losing := OLD.role = 'super_admin'
      AND (TG_OP = 'DELETE' OR NEW.role <> 'super_admin' OR NEW.user_id <> OLD.user_id);
  ELSE -- user_profiles
    v_user := OLD.id;
    v_losing := EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.id AND role = 'super_admin')
      AND COALESCE(OLD.is_active, false) AND NOT COALESCE(OLD.is_removed, false)
      AND (NOT COALESCE(NEW.is_active, false) OR COALESCE(NEW.is_removed, false));
  END IF;

  IF v_losing THEN
    SELECT count(*) INTO v_others
      FROM public.user_roles r JOIN public.user_profiles p ON p.id = r.user_id
     WHERE r.role = 'super_admin' AND r.user_id <> v_user
       AND p.is_active AND NOT COALESCE(p.is_removed, false);
    IF v_others = 0 THEN
      RAISE EXCEPTION 'At least one active Super Admin is required. Assign Super Admin to another user first.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_last_super_admin_roles ON public.user_roles;
CREATE TRIGGER trg_guard_last_super_admin_roles
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_super_admin();

DROP TRIGGER IF EXISTS trg_guard_last_super_admin_profiles ON public.user_profiles;
CREATE TRIGGER trg_guard_last_super_admin_profiles
  BEFORE UPDATE OF is_active, is_removed ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_super_admin();
