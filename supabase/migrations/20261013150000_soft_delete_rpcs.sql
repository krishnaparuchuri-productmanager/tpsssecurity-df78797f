-- Soft deletes from the browser fail under RLS: the SELECT policies only show
-- rows with is_deleted = false, so UPDATE ... SET is_deleted = true is rejected
-- ("new row violates row-level security policy"). Client edit ignored that error
-- and re-inserted its billing lines, duplicating them on every save.
-- These SECURITY DEFINER functions do the soft delete server-side with the same
-- permission checks the RLS policies apply.

-- Replace a client's billing lines atomically (soft-delete current, insert new).
-- _lines: [{description, sac_code, rate_per_month, unit_label, sort_order, is_active}]
CREATE OR REPLACE FUNCTION public.replace_client_billing_lines(_client_id uuid, _lines jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_sandbox boolean;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT (public.has_permission(v_uid, 'clients', 'edit') OR public.has_permission(v_uid, 'clients', 'create')) THEN
    RAISE EXCEPTION 'You do not have permission to edit client billing lines';
  END IF;

  SELECT is_sandbox INTO v_sandbox FROM public.clients WHERE id = _client_id AND is_deleted = false;
  IF v_sandbox IS NULL THEN RAISE EXCEPTION 'Client not found'; END IF;

  UPDATE public.client_billing_lines SET is_deleted = true, updated_at = now()
   WHERE client_id = _client_id AND is_deleted = false;

  INSERT INTO public.client_billing_lines
    (client_id, description, sac_code, rate_per_month, unit_label, sort_order, is_active, is_sandbox)
  SELECT _client_id, trim(e.j->>'description'), nullif(trim(coalesce(e.j->>'sac_code', '')), ''),
         coalesce((e.j->>'rate_per_month')::numeric, 0),
         coalesce(nullif(trim(coalesce(e.j->>'unit_label', '')), ''), 'Guard'),
         coalesce((e.j->>'sort_order')::int, e.ord::int), coalesce((e.j->>'is_active')::boolean, true), v_sandbox
    FROM jsonb_array_elements(coalesce(_lines, '[]'::jsonb)) WITH ORDINALITY AS e(j, ord)
   WHERE coalesce(trim(e.j->>'description'), '') <> '';
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_client_billing_lines(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_client_billing_lines(uuid, jsonb) TO authenticated;

-- Soft-delete a branch (CEO/COO, same as the branches UPDATE policy; Super Admin
-- counts as CEO via has_role). Refuses while clients or employees are linked.
CREATE OR REPLACE FUNCTION public.soft_delete_branch(_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_clients int;
  v_employees int;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT (public.has_role(v_uid, 'ceo_admin') OR public.has_role(v_uid, 'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can delete branches';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = _id AND is_deleted = false) THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  SELECT count(*) INTO v_clients FROM public.clients WHERE branch_id = _id AND is_deleted = false;
  SELECT count(*) INTO v_employees FROM public.employees WHERE branch_id = _id AND is_deleted = false;
  IF v_clients > 0 OR v_employees > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % clients and % employees are linked.', v_clients, v_employees;
  END IF;

  UPDATE public.branches SET is_deleted = true, is_active = false WHERE id = _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_branch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_branch(uuid) TO authenticated;
