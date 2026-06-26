CREATE OR REPLACE FUNCTION public.save_ffs(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid := NULLIF(_payload->>'id','')::uuid;
  v_status text := COALESCE(_payload->>'status','draft');
  v_sandbox boolean := public.is_sandbox_env();
  v_calc jsonb := public.compute_ffs(_payload);
  v_emp uuid := (_payload->>'employee_id')::uuid;
  v_client uuid;
  v_num text;
  v_canteen numeric := COALESCE((_payload->>'canteen_deduction')::numeric, 0);
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
      advance_outstanding, other_deductions, other_deductions_label, canteen_deduction,
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
      v_canteen,
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
      canteen_deduction=v_canteen,
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
