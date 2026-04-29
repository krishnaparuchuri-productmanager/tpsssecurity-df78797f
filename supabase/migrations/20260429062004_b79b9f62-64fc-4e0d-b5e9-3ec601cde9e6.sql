
-- save_paysheet: creates or updates a paysheet + employee rows from a JSON payload, with server-side calc.
CREATE OR REPLACE FUNCTION public.save_paysheet(_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid := NULLIF(_payload->>'id','')::uuid;
  v_client_id uuid := (_payload->>'client_id')::uuid;
  v_month_date date := (_payload->>'month_date')::date;
  v_total_days integer := COALESCE((_payload->>'total_days_in_month')::integer, extract(day from (date_trunc('month',v_month_date)+interval '1 month - 1 day'))::integer);
  v_status public.paysheet_status := COALESCE((_payload->>'status')::public.paysheet_status, 'draft');
  v_sandbox boolean := public.is_sandbox_env();
  v_uid uuid := auth.uid();
  v_emp_count integer := 0;
  v_total_earned numeric := 0;
  v_total_epf_e numeric := 0; v_total_epf_er numeric := 0;
  v_total_esi_e numeric := 0; v_total_esi_er numeric := 0;
  v_total_pt numeric := 0; v_total_adv numeric := 0;
  v_total_net numeric := 0; v_anomaly_count integer := 0;
  emp jsonb;
  v_basic numeric; v_da numeric; v_ta numeric;
  v_no_of_duties numeric; v_wd integer;
  v_payable_gross numeric; v_earned numeric;
  v_epf_mw numeric; v_esi_mw numeric;
  v_epf_emp numeric; v_epf_er numeric;
  v_esi_wages numeric; v_esi_emp numeric; v_esi_er numeric;
  v_pt numeric; v_adv numeric; v_net numeric; v_final numeric;
  v_pt_app boolean;
  v_anomalies jsonb;
BEGIN
  IF NOT public.is_active_user(v_uid) THEN RAISE EXCEPTION 'Inactive user'; END IF;

  -- Lookup PT applicability for client
  SELECT pt_applicable INTO v_pt_app FROM public.clients WHERE id = v_client_id;

  IF v_id IS NULL THEN
    INSERT INTO public.paysheets(
      paysheet_number, client_id, month, month_date, total_days_in_month,
      status, created_by, is_sandbox
    ) VALUES (
      public.gen_paysheet_number(v_month_date, v_sandbox),
      v_client_id,
      to_char(v_month_date,'Mon YYYY'),
      v_month_date,
      v_total_days,
      v_status,
      v_uid,
      v_sandbox
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.paysheets SET
      total_days_in_month = v_total_days,
      status = v_status,
      submitted_by = CASE WHEN v_status='submitted' THEN v_uid ELSE submitted_by END,
      submitted_at = CASE WHEN v_status='submitted' AND status<>'submitted' THEN now() ELSE submitted_at END,
      updated_at = now()
    WHERE id = v_id;
    DELETE FROM public.paysheet_employees WHERE paysheet_id = v_id;
  END IF;

  -- Insert each employee row with server-computed fields
  FOR emp IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'employees','[]'::jsonb)) LOOP
    v_basic := COALESCE((emp->>'basic')::numeric, 0);
    v_da := COALESCE((emp->>'da')::numeric, 0);
    v_ta := COALESCE((emp->>'ta')::numeric, 0);
    v_no_of_duties := COALESCE((emp->>'no_of_duties')::numeric, 0);
    v_wd := COALESCE((emp->>'working_days')::integer, v_total_days);
    v_payable_gross := COALESCE((emp->>'payable_gross')::numeric, v_basic + v_da + v_ta);
    v_earned := round(v_payable_gross * v_no_of_duties / NULLIF(v_wd,0), 2);
    v_epf_mw := COALESCE((emp->>'epf_mw_wages')::numeric, 15000);
    v_esi_mw := COALESCE((emp->>'esi_mw_wages')::numeric, 21000);

    -- EPF on min(epf_mw, earned), 12% employee + 13% employer (3.67 EPF + ~9.49 EPS+admin)
    v_epf_emp := round(LEAST(v_epf_mw, v_earned) * 0.12, 2);
    v_epf_er  := round(LEAST(v_epf_mw, v_earned) * 0.13, 2);

    -- ESI eligible only if earned <= esi_mw cap
    v_esi_wages := CASE WHEN v_earned <= v_esi_mw THEN v_earned ELSE 0 END;
    v_esi_emp := round(v_esi_wages * 0.0075, 2);
    v_esi_er  := round(v_esi_wages * 0.0325, 2);

    -- PT slabs (Andhra Pradesh): <15k=0, 15001-20k=150, >20k=200; only if client opt-in
    v_pt := CASE
      WHEN COALESCE(v_pt_app,false) = false THEN 0
      WHEN v_earned <= 15000 THEN 0
      WHEN v_earned <= 20000 THEN 150
      ELSE 200
    END;
    v_adv := COALESCE((emp->>'advance_deduction')::numeric, 0);

    v_net := v_earned - v_epf_emp - v_esi_emp - v_pt;
    v_final := v_net - v_adv;

    -- Simple anomaly detection (mirrors client preview)
    v_anomalies := '[]'::jsonb;
    IF v_no_of_duties > v_wd THEN
      v_anomalies := v_anomalies || jsonb_build_array(jsonb_build_object('severity','high','code','duties_gt_working_days','msg','Duties exceed working days'));
    END IF;
    IF v_earned <= 0 THEN
      v_anomalies := v_anomalies || jsonb_build_array(jsonb_build_object('severity','medium','code','zero_wages','msg','Earned wages are zero'));
    END IF;
    IF jsonb_array_length(v_anomalies) > 0 THEN
      v_anomaly_count := v_anomaly_count + jsonb_array_length(v_anomalies);
    END IF;

    INSERT INTO public.paysheet_employees(
      paysheet_id, employee_id, employee_name, designation, uan_number, esi_number,
      basic, da, ta, weekly_off, four_hour_ot, bonus, leave_wages, relieving_charges,
      conveyance_allowance, washing_allowance, spl_allowance, payable_gross,
      working_days, no_of_duties, earned_wages,
      epf_mw_wages, epf_wages, epf_employee_deduction, epf_employer_contribution,
      esi_wages, esi_employee_deduction, esi_employer_contribution,
      pt_deduction, advance_deduction, net_salary, final_net_salary,
      is_new_joiner, anomaly_flags, notes, is_sandbox
    ) VALUES (
      v_id,
      NULLIF(emp->>'employee_id','')::uuid,
      emp->>'employee_name',
      emp->>'designation',
      emp->>'uan_number',
      emp->>'esi_number',
      v_basic, v_da, v_ta,
      COALESCE((emp->>'weekly_off')::numeric, 0),
      COALESCE((emp->>'four_hour_ot')::numeric, 0),
      COALESCE((emp->>'bonus')::numeric, 0),
      COALESCE((emp->>'leave_wages')::numeric, 0),
      COALESCE((emp->>'relieving_charges')::numeric, 0),
      COALESCE((emp->>'conveyance_allowance')::numeric, 0),
      COALESCE((emp->>'washing_allowance')::numeric, 0),
      COALESCE((emp->>'spl_allowance')::numeric, 0),
      v_payable_gross,
      v_wd, v_no_of_duties, v_earned,
      v_epf_mw, LEAST(v_epf_mw, v_earned), v_epf_emp, v_epf_er,
      v_esi_wages, v_esi_emp, v_esi_er,
      v_pt, v_adv, v_net, v_final,
      COALESCE((emp->>'is_new_joiner')::boolean, false),
      v_anomalies,
      emp->>'notes',
      v_sandbox
    );
    v_emp_count := v_emp_count + 1;
    v_total_earned := v_total_earned + v_earned;
    v_total_epf_e := v_total_epf_e + v_epf_emp;
    v_total_epf_er := v_total_epf_er + v_epf_er;
    v_total_esi_e := v_total_esi_e + v_esi_emp;
    v_total_esi_er := v_total_esi_er + v_esi_er;
    v_total_pt := v_total_pt + v_pt;
    v_total_adv := v_total_adv + v_adv;
    v_total_net := v_total_net + v_final;
  END LOOP;

  UPDATE public.paysheets SET
    total_employees = v_emp_count,
    total_earned_wages = v_total_earned,
    total_epf_employee = v_total_epf_e,
    total_epf_employer = v_total_epf_er,
    total_esi_employee = v_total_esi_e,
    total_esi_employer = v_total_esi_er,
    total_pt_deduction = v_total_pt,
    total_advance_deductions = v_total_adv,
    total_net_salary = v_total_net,
    anomaly_count = v_anomaly_count,
    updated_at = now()
  WHERE id = v_id;

  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, CASE WHEN v_status='submitted' THEN 'SUBMIT' ELSE 'SAVE' END, 'paysheets', v_id,
          jsonb_build_object('status', v_status, 'employees', v_emp_count));

  RETURN v_id;
END $$;

-- approve_paysheet
CREATE OR REPLACE FUNCTION public.approve_paysheet(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ps public.paysheets%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO or COO can approve';
  END IF;
  SELECT * INTO v_ps FROM public.paysheets WHERE id = _id FOR UPDATE;
  IF v_ps.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted paysheets can be approved'; END IF;
  IF v_ps.submitted_by = v_uid THEN RAISE EXCEPTION 'Cannot approve own submission'; END IF;

  UPDATE public.paysheets SET
    status='approved', approved_by=v_uid, approved_at=now(), updated_at=now()
  WHERE id = _id;

  IF v_ps.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, related_record_id, is_sandbox)
    VALUES (v_ps.submitted_by, 'Paysheet approved',
      'Paysheet ' || v_ps.paysheet_number || ' has been approved.', 'paysheet', _id, v_ps.is_sandbox);
  END IF;

  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'APPROVE', 'paysheets', _id, jsonb_build_object('status','approved'));
END $$;

-- reject_paysheet
CREATE OR REPLACE FUNCTION public.reject_paysheet(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ps public.paysheets%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_uid,'ceo_admin') OR public.has_role(v_uid,'coo_ops')) THEN
    RAISE EXCEPTION 'Only CEO or COO can reject';
  END IF;
  IF length(coalesce(_reason,'')) < 10 OR length(_reason) > 200 THEN
    RAISE EXCEPTION 'Rejection reason must be 10-200 characters';
  END IF;
  SELECT * INTO v_ps FROM public.paysheets WHERE id = _id FOR UPDATE;
  IF v_ps.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted paysheets can be rejected'; END IF;

  UPDATE public.paysheets SET
    status='rejected', rejection_reason=_reason, approved_by=v_uid, approved_at=now(), updated_at=now()
  WHERE id = _id;

  IF v_ps.submitted_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, related_record_id, is_sandbox)
    VALUES (v_ps.submitted_by, 'Paysheet rejected',
      'Paysheet ' || v_ps.paysheet_number || ' was rejected: ' || _reason, 'paysheet', _id, v_ps.is_sandbox);
  END IF;

  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_values)
  VALUES (v_uid, 'REJECT', 'paysheets', _id, jsonb_build_object('status','rejected','reason',_reason));
END $$;
