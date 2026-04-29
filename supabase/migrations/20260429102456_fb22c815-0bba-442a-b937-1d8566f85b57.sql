CREATE OR REPLACE FUNCTION public.run_compliance_daily_checks()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_overdue int := 0;
  v_reminded int := 0;
  t record;
  r record;
BEGIN
  -- 1. mark overdue
  UPDATE public.compliance_tasks
    SET status = 'overdue', updated_at = now()
    WHERE status IN ('pending','in_progress')
      AND due_date < CURRENT_DATE
      AND is_deleted = false;
  GET DIAGNOSTICS v_overdue = ROW_COUNT;

  -- 2. reminders: tasks where (due_date - today) = reminder_days_before
  FOR t IN
    SELECT id, task_name, period_label, due_date, assigned_to, is_sandbox, category
      FROM public.compliance_tasks
     WHERE is_deleted = false
       AND status IN ('pending','in_progress')
       AND (due_date - CURRENT_DATE) = reminder_days_before
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notifications
       WHERE related_record_id = t.id
         AND type = 'compliance_reminder'
         AND created_at::date = CURRENT_DATE
    ) THEN CONTINUE; END IF;

    IF t.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
      VALUES (t.assigned_to, '⏰ Compliance reminder',
              t.task_name || ' (' || t.period_label || ') due on ' || t.due_date,
              'compliance_reminder', t.id, t.is_sandbox);
    ELSE
      FOR r IN
        SELECT DISTINCT ur.user_id
          FROM public.user_roles ur
          JOIN public.user_profiles up ON up.id = ur.user_id AND up.is_active = true
         WHERE ur.role IN ('ceo_admin','coo_ops','accountant')
      LOOP
        INSERT INTO public.notifications(user_id,title,message,type,related_record_id,is_sandbox)
        VALUES (r.user_id, '⏰ Compliance reminder',
                t.task_name || ' (' || t.period_label || ') due on ' || t.due_date,
                'compliance_reminder', t.id, t.is_sandbox);
      END LOOP;
    END IF;
    v_reminded := v_reminded + 1;
  END LOOP;

  RETURN jsonb_build_object('overdue', v_overdue, 'reminded', v_reminded);
END $$;

REVOKE EXECUTE ON FUNCTION public.run_compliance_daily_checks() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.run_compliance_daily_checks() TO authenticated;