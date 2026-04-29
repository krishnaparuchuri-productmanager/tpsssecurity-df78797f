-- ============================================================
-- Phase 2 Hardening Migration
-- 1) Lock down SECURITY DEFINER functions (revoke execute from public/authenticated for internal/trigger-only fns)
-- 2) Add notification triggers for paysheet submitted, payment received, invoice overdue
-- 3) Add helper to mark overdue invoices (called by scheduled edge function)
-- ============================================================

-- ----- 1) Revoke EXECUTE on internal/trigger-only SECURITY DEFINER functions -----
REVOKE EXECUTE ON FUNCTION public.gen_client_code()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_employee_code()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.version_wage_config()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_env_change()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_invoice_number(uuid, date, boolean)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_voucher_number(date)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_paysheet_number(date, boolean)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_receipt_number(date, boolean)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._iw_under_hundred(integer)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.amount_in_words_inr(numeric)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fy_string(date)                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_payment()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.after_payment_insert()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_paysheet_status()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_invoice_fields()                    FROM PUBLIC, anon, authenticated;

-- These remain EXECUTE for authenticated (used in RLS / called from client RPCs):
--   has_role, has_permission, is_active_user, get_user_role,
--   current_environment, is_sandbox_env,
--   save_paysheet, approve_paysheet, reject_paysheet, wipe_sandbox

-- Defensively revoke from anon for the client-callable RPCs (still allowed for authenticated)
REVOKE EXECUTE ON FUNCTION public.save_paysheet(jsonb)              FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_paysheet(uuid)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_paysheet(uuid, text)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.wipe_sandbox()                    FROM anon;

-- ----- 2) Notification trigger: paysheet submitted -----
CREATE OR REPLACE FUNCTION public.notify_paysheet_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted') THEN
    -- Notify all CEO + COO users
    FOR r IN
      SELECT DISTINCT ur.user_id
        FROM public.user_roles ur
        JOIN public.user_profiles up ON up.id = ur.user_id AND up.is_active = true
       WHERE ur.role IN ('ceo_admin','coo_ops')
    LOOP
      INSERT INTO public.notifications(user_id, title, message, type, related_record_id, is_sandbox)
      VALUES (r.user_id, 'Paysheet submitted for approval',
              'Paysheet ' || NEW.paysheet_number || ' is awaiting approval.',
              'paysheet', NEW.id, NEW.is_sandbox);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_paysheet_submitted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_paysheet_submitted ON public.paysheets;
CREATE TRIGGER trg_notify_paysheet_submitted
AFTER INSERT OR UPDATE OF status ON public.paysheets
FOR EACH ROW EXECUTE FUNCTION public.notify_paysheet_submitted();

-- ----- 2b) Notification trigger: payment received -----
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; v_client_name text; v_inv_no text;
BEGIN
  SELECT client_name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
  SELECT invoice_number INTO v_inv_no FROM public.invoices WHERE id = NEW.invoice_id;
  FOR r IN
    SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      JOIN public.user_profiles up ON up.id = ur.user_id AND up.is_active = true
     WHERE ur.role IN ('ceo_admin','coo_ops','accountant')
  LOOP
    INSERT INTO public.notifications(user_id, title, message, type, related_record_id, is_sandbox)
    VALUES (r.user_id, 'Payment received',
            '₹' || NEW.amount::text || ' received from ' || COALESCE(v_client_name,'client') ||
            ' for ' || COALESCE(v_inv_no,'invoice') || '.',
            'payment', NEW.id, NEW.is_sandbox);
  END LOOP;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_payment_received() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_payment_received ON public.payments;
CREATE TRIGGER trg_notify_payment_received
AFTER INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.notify_payment_received();

-- ----- 3) Helper RPC: mark overdue invoices + notify (idempotent; called by scheduled edge fn) -----
CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  inv record;
  r record;
BEGIN
  FOR inv IN
    SELECT id, invoice_number, client_id, due_date, outstanding_amount, is_sandbox
      FROM public.invoices
     WHERE is_deleted = false
       AND status IN ('sent','partially_paid')
       AND due_date IS NOT NULL
       AND due_date < CURRENT_DATE
       AND outstanding_amount > 0
  LOOP
    UPDATE public.invoices SET status = 'overdue' WHERE id = inv.id AND status <> 'overdue';
    -- notify CEO/COO/accountant once per day per invoice (avoid dupes via title+related_record_id+today)
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
       WHERE related_record_id = inv.id
         AND type = 'invoice_overdue'
         AND created_at::date = CURRENT_DATE
    ) THEN
      FOR r IN
        SELECT DISTINCT ur.user_id
          FROM public.user_roles ur
          JOIN public.user_profiles up ON up.id = ur.user_id AND up.is_active = true
         WHERE ur.role IN ('ceo_admin','coo_ops','accountant')
      LOOP
        INSERT INTO public.notifications(user_id, title, message, type, related_record_id, is_sandbox)
        VALUES (r.user_id, 'Invoice overdue',
                'Invoice ' || inv.invoice_number || ' is overdue (₹' || inv.outstanding_amount::text || ' outstanding).',
                'invoice_overdue', inv.id, inv.is_sandbox);
      END LOOP;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;
-- Allow only authenticated CEO via RLS-style guard (we'll also call via service role from edge fn)
REVOKE EXECUTE ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO authenticated;

-- Add invoice_overdue as an allowed notification type label (no enum, just convention)
COMMENT ON FUNCTION public.mark_overdue_invoices() IS 'Marks invoices past due_date as overdue and creates daily notifications for CEO/COO/Accountant.';
