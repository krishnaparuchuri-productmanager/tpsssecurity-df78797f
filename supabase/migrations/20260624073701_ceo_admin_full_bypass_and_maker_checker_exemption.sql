
-- 1. has_permission: ceo_admin always passes, regardless of role_permissions rows
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _screen text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'ceo_admin'::app_role) THEN true
    ELSE COALESCE(
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
  END
$$;

-- 2. approve_advance: ceo_admin exempt from self-approval (maker-checker) block
CREATE OR REPLACE FUNCTION public.approve_advance(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  a public.employee_advances%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can approve advances';
  END IF;
  SELECT * INTO a FROM public.employee_advances WHERE id=_id FOR UPDATE;
  IF a.status <> 'pending' THEN RAISE EXCEPTION 'Only pending advances can be approved'; END IF;
  IF a.requested_by = v_uid AND NOT public.has_role(v_uid,'ceo_admin') THEN RAISE EXCEPTION 'Cannot approve own request'; END IF;

  UPDATE public.employee_advances
    SET status='active', approved_by=v_uid, approved_at=now()
    WHERE id=_id;
  PERFORM public.generate_recovery_schedule(_id);

  IF a.advance_type = 'uniform_advance' THEN
    UPDATE public.employees
      SET uniform_advance_balance = COALESCE(uniform_advance_balance,0) + a.total_amount
      WHERE id = a.employee_id;
  ELSE
    UPDATE public.employees
      SET current_advance_balance = COALESCE(current_advance_balance,0) + a.total_amount
      WHERE id = a.employee_id;
  END IF;

  IF a.requested_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (a.requested_by, 'Advance approved',
      '✅ Advance ' || a.advance_number || ' approved.', 'advance', _id, a.is_sandbox);
  END IF;

  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'APPROVE','employee_advances',_id, jsonb_build_object('status','active'));
END
$$;

-- 3. approve_ffs: ceo_admin exempt from self-approval block
CREATE OR REPLACE FUNCTION public.approve_ffs(_id uuid, _payment jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_uid uuid := auth.uid(); f public.employee_ffs%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO/COO can approve';
  END IF;
  SELECT * INTO f FROM public.employee_ffs WHERE id=_id FOR UPDATE;
  IF f.status NOT IN ('submitted') THEN RAISE EXCEPTION 'Only submitted FFS can be approved'; END IF;
  IF f.submitted_by = v_uid AND NOT public.has_role(v_uid,'ceo_admin') THEN RAISE EXCEPTION 'Cannot approve own submission'; END IF;

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
END
$$;

-- 4. approve_paysheet: ceo_admin exempt from self-approval block
CREATE OR REPLACE FUNCTION public.approve_paysheet(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_uid uuid := auth.uid(); v_ps public.paysheets%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO or COO can approve';
  END IF;
  SELECT * INTO v_ps FROM public.paysheets WHERE id=_id FOR UPDATE;
  IF v_ps.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted paysheets can be approved'; END IF;
  IF v_ps.submitted_by = v_uid AND NOT public.has_role(v_uid,'ceo_admin') THEN RAISE EXCEPTION 'Cannot approve own submission'; END IF;

  UPDATE public.paysheets SET status='approved', approved_by=v_uid, approved_at=now(), updated_at=now() WHERE id=_id;

  PERFORM public.apply_advance_deductions_on_approve(_id);

  IF v_ps.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
    VALUES (v_ps.submitted_by, 'Paysheet approved',
      'Paysheet ' || v_ps.paysheet_number || ' has been approved.', 'paysheet', _id, v_ps.is_sandbox);
  END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_values)
    VALUES (v_uid,'APPROVE','paysheets',_id, jsonb_build_object('status','approved'));
END
$$;

-- 5. guard_paysheet_status trigger: ceo_admin exempt from self-approval block (already computes is_ceo)
CREATE OR REPLACE FUNCTION public.guard_paysheet_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  uid uuid := auth.uid();
  is_acc boolean := public.has_role(uid,'accountant');
  is_ceo boolean := public.has_role(uid,'ceo_admin');
  is_coo boolean := public.has_role(uid,'coo_ops');
BEGIN
  IF NEW.status = 'approved' AND is_acc AND NOT is_ceo AND NOT is_coo THEN
    RAISE EXCEPTION 'Accountants cannot approve paysheets';
  END IF;
  IF NEW.status = 'approved' AND NEW.approved_by IS NOT NULL AND NEW.submitted_by IS NOT NULL
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
$$;

