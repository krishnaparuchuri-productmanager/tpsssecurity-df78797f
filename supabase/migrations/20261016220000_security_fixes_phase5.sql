-- Phase 5 security fixes (docs/testing/TESTING_CHECKPOINT.md, S-1 … S-13). Same migration for both databases.
-- Pattern for S-1/S-2/S-4: the new checks apply only to edits made directly from a user's session
-- (current_user = authenticated/anon). The app's own steps run in SECURITY DEFINER functions owned by
-- postgres, so approvals, cancellations, receipts, reversals and overdue marking keep working unchanged.

-- S-1 / S-2: paysheets — no direct approval/rejection/cancellation, approved and cancelled paysheets locked,
-- system fields not editable, and a paysheet can only be submitted in your own name.
CREATE OR REPLACE FUNCTION public.enforce_paysheet_direct_edits()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF OLD.status IN ('approved', 'cancelled') THEN
    RAISE EXCEPTION 'Approved or cancelled paysheets can only be changed through Cancel / Re-create';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Paysheet status "%" can only be set through the approval, rejection or cancellation steps', NEW.status;
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.cancelled_by IS DISTINCT FROM OLD.cancelled_by OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.replaced_by_id IS DISTINCT FROM OLD.replaced_by_id OR NEW.replaces_id IS DISTINCT FROM OLD.replaces_id
     OR NEW.is_sandbox IS DISTINCT FROM OLD.is_sandbox THEN
    RAISE EXCEPTION 'Approval, cancellation, replacement and environment fields are set by the system only';
  END IF;
  IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' AND NEW.submitted_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A paysheet can only be submitted in your own name';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_enforce_paysheet_direct_edits ON public.paysheets;
CREATE TRIGGER trg_enforce_paysheet_direct_edits BEFORE UPDATE ON public.paysheets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_paysheet_direct_edits();

-- S-4: invoices — the amount received and payment statuses change only by recording or reversing a receipt;
-- cancelled invoices are locked; system fields not editable.
CREATE OR REPLACE FUNCTION public.enforce_invoice_payment_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled invoices can''t be changed (use Re-create)';
  END IF;
  IF NEW.amount_received IS DISTINCT FROM OLD.amount_received THEN
    RAISE EXCEPTION 'Amount received is updated only by recording or reversing a receipt';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND (NEW.status IN ('paid', 'partially_paid', 'overdue', 'cancelled') OR OLD.status IN ('paid', 'partially_paid')) THEN
    RAISE EXCEPTION 'Invoice status "%" is set by receipts, reversals, cancellation or the overdue check only', NEW.status;
  END IF;
  IF NEW.replaced_by_id IS DISTINCT FROM OLD.replaced_by_id OR NEW.replaces_id IS DISTINCT FROM OLD.replaces_id
     OR NEW.is_sandbox IS DISTINCT FROM OLD.is_sandbox THEN
    RAISE EXCEPTION 'Replacement and environment fields are set by the system only';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_payment_fields ON public.invoices;
CREATE TRIGGER trg_enforce_invoice_payment_fields BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoice_payment_fields();

REVOKE EXECUTE ON FUNCTION public.enforce_paysheet_direct_edits(), public.enforce_invoice_payment_fields() FROM PUBLIC, anon, authenticated;

-- S-7: cash-book (ledger) entries only through the app's own functions (receipts, reversals, expenses,
-- salary batches, compliance payments, invoice cancellation). No screen writes the ledger directly.
DROP POLICY IF EXISTS "Create ledger" ON public.financial_ledger;

-- S-5 / S-6: CRM follows the permission table (screen "crm_leads") and requires an active account.
DROP POLICY IF EXISTS auth_read_crm_leads ON public.crm_leads;
DROP POLICY IF EXISTS auth_insert_crm_leads ON public.crm_leads;
DROP POLICY IF EXISTS auth_update_crm_leads ON public.crm_leads;
CREATE POLICY crm_leads_select ON public.crm_leads FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'view'));
CREATE POLICY crm_leads_insert ON public.crm_leads FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'create'));
CREATE POLICY crm_leads_update ON public.crm_leads FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'edit'))
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'edit'));

DROP POLICY IF EXISTS auth_read_crm_activities ON public.crm_lead_activities;
DROP POLICY IF EXISTS auth_insert_crm_activities ON public.crm_lead_activities;
DROP POLICY IF EXISTS auth_update_crm_activities ON public.crm_lead_activities;
CREATE POLICY crm_activities_select ON public.crm_lead_activities FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'view'));
CREATE POLICY crm_activities_insert ON public.crm_lead_activities FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND (public.has_permission(auth.uid(), 'crm_leads', 'create') OR public.has_permission(auth.uid(), 'crm_leads', 'edit')));
CREATE POLICY crm_activities_update ON public.crm_lead_activities FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'edit'))
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'edit'));

DROP POLICY IF EXISTS auth_read_crm_quotations ON public.crm_lead_quotations;
DROP POLICY IF EXISTS auth_insert_crm_quotations ON public.crm_lead_quotations;
DROP POLICY IF EXISTS auth_update_crm_quotations ON public.crm_lead_quotations;
CREATE POLICY crm_quotations_select ON public.crm_lead_quotations FOR SELECT TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'view'));
CREATE POLICY crm_quotations_insert ON public.crm_lead_quotations FOR INSERT TO authenticated
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'edit'));
CREATE POLICY crm_quotations_update ON public.crm_lead_quotations FOR UPDATE TO authenticated
  USING (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'edit'))
  WITH CHECK (public.is_active_user(auth.uid()) AND public.has_permission(auth.uid(), 'crm_leads', 'edit'));

-- S-10 / S-11 / S-13: internal and scheduled functions are no longer callable by signed-in users.
-- (generate_recovery_schedule / apply_advance_deductions_on_approve run inside approve_advance /
-- approve_paysheet; the others run from the scheduled jobs with the service role.)
-- auto_open_followups and seed_compliance_tasks stay available: the Follow-ups and Compliance screens use them.
REVOKE EXECUTE ON FUNCTION
  public.generate_recovery_schedule(uuid),
  public.apply_advance_deductions_on_approve(uuid),
  public.record_backup_log(jsonb),
  public.mark_contract_status_and_notify(),
  public.run_compliance_daily_checks(),
  public.mark_overdue_invoices(),
  public.get_user_role(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.generate_recovery_schedule(uuid),
  public.apply_advance_deductions_on_approve(uuid),
  public.record_backup_log(jsonb),
  public.mark_contract_status_and_notify(),
  public.run_compliance_daily_checks(),
  public.mark_overdue_invoices(),
  public.get_user_role(uuid)
TO service_role;

-- S-12: these three storage rules were named "Deny … on backups bucket" but ALLOWED anyone (incl. signed-out
-- visitors) to upload/change/delete files in every other bucket. With them removed, no user session can write
-- to storage at all; the monthly backup job uses the service role and is unaffected.
DROP POLICY IF EXISTS "Deny insert on backups bucket" ON storage.objects;
DROP POLICY IF EXISTS "Deny update on backups bucket" ON storage.objects;
DROP POLICY IF EXISTS "Deny delete on backups bucket" ON storage.objects;
