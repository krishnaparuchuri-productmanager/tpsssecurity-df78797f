-- guard_paysheet_status re-ran the approval checks ("Accountants cannot approve",
-- "Cannot approve own submission") on EVERY update of an already-approved
-- paysheet, blocking unrelated updates (e.g. a label-only data fix). Run them
-- only when the paysheet becomes approved. Other rules unchanged; search_path pinned.
CREATE OR REPLACE FUNCTION public.guard_paysheet_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_acc boolean := public.has_role(uid,'accountant');
  is_ceo boolean := public.has_role(uid,'ceo_admin');
  is_coo boolean := public.has_role(uid,'coo_ops');
  becomes_approved boolean := NEW.status = 'approved'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved');
BEGIN
  IF becomes_approved AND is_acc AND NOT is_ceo AND NOT is_coo THEN
    RAISE EXCEPTION 'Accountants cannot approve paysheets';
  END IF;
  IF becomes_approved AND NEW.approved_by IS NOT NULL AND NEW.submitted_by IS NOT NULL
     AND NEW.approved_by = NEW.submitted_by AND NOT is_ceo THEN
    RAISE EXCEPTION 'Cannot approve own submission';
  END IF;
  -- Cancelled is terminal: only allow setting replaced_by_id, nothing else
  IF TG_OP = 'UPDATE' AND OLD.status = 'cancelled' THEN
    IF NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Cancelled paysheets are immutable';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('submitted','approved','rejected') AND is_acc
     AND NOT is_ceo AND NOT is_coo
     AND NEW.status NOT IN ('draft')
     AND OLD.status <> 'rejected' THEN
    IF NOT (OLD.status='rejected' AND NEW.status='draft') THEN
      RAISE EXCEPTION 'Submitted paysheets cannot be edited by accountant';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;
