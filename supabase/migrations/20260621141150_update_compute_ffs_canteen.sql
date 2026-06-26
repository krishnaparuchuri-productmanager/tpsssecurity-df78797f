CREATE OR REPLACE FUNCTION public.compute_ffs(_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_emp uuid := (_payload->>'employee_id')::uuid;
  v_doj date;
  v_relieving date := COALESCE((_payload->>'relieving_date')::date, CURRENT_DATE);
  v_years numeric;
  v_basic numeric := COALESCE((_payload->>'gratuity_basic')::numeric, 0);
  v_grat_apply boolean := COALESCE((_payload->>'gratuity_applicable')::boolean, false);
  v_grat numeric := 0;
  v_earned numeric := COALESCE((_payload->>'earned_wages_pending')::numeric,0);
  v_lea numeric := COALESCE((_payload->>'leave_encashment_amount')::numeric,0);
  v_bonus numeric := COALESCE((_payload->>'bonus_amount')::numeric,0);
  v_other numeric := COALESCE((_payload->>'other_deductions')::numeric,0);
  v_canteen numeric := COALESCE((_payload->>'canteen_deduction')::numeric,0);
  v_outstanding numeric := 0;
  v_total_e numeric; v_total_d numeric; v_net numeric;
BEGIN
  SELECT date_of_joining INTO v_doj FROM public.employees WHERE id=v_emp;
  v_years := ROUND(EXTRACT(EPOCH FROM (v_relieving::timestamp - v_doj::timestamp))/(365.25*86400), 2);

  IF v_grat_apply AND v_years >= 5 AND v_basic > 0 THEN
    v_grat := ROUND(v_basic * 4.81/100 * v_years, 2);
  END IF;

  SELECT COALESCE(SUM(amount_remaining),0) INTO v_outstanding
    FROM public.employee_advances
    WHERE employee_id=v_emp AND status='active' AND is_deleted=false;

  v_total_e := v_earned + v_lea + v_bonus + v_grat;
  v_total_d := v_outstanding + v_other + v_canteen;
  v_net := v_total_e - v_total_d;

  RETURN jsonb_build_object(
    'years_of_service', v_years,
    'gratuity_eligible', v_years >= 5,
    'gratuity_amount', v_grat,
    'advance_outstanding', v_outstanding,
    'canteen_deduction', v_canteen,
    'total_earnings', v_total_e,
    'total_deductions_ffs', v_total_d,
    'net_payable', v_net
  );
END $$;
