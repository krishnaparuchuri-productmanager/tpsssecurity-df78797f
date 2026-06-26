-- 1. cron_secrets: explicit CEO-only policies (currently no policies = effectively locked, but make intent explicit)
CREATE POLICY "CEO read cron_secrets" ON public.cron_secrets
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ceo_admin'::app_role) AND is_active_user(auth.uid()));

CREATE POLICY "Deny insert cron_secrets" ON public.cron_secrets
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Deny update cron_secrets" ON public.cron_secrets
  FOR UPDATE TO authenticated, anon USING (false);

CREATE POLICY "Deny delete cron_secrets" ON public.cron_secrets
  FOR DELETE TO authenticated, anon USING (false);

-- 2. employee_advances: explicit deny-all write policies (writes go through SECURITY DEFINER RPCs)
CREATE POLICY "Deny direct insert employee_advances" ON public.employee_advances
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Deny direct update employee_advances" ON public.employee_advances
  FOR UPDATE TO authenticated, anon USING (false);

CREATE POLICY "Deny direct delete employee_advances" ON public.employee_advances
  FOR DELETE TO authenticated, anon USING (false);

-- 3. employee_ffs: same pattern
CREATE POLICY "Deny direct insert employee_ffs" ON public.employee_ffs
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Deny direct update employee_ffs" ON public.employee_ffs
  FOR UPDATE TO authenticated, anon USING (false);

CREATE POLICY "Deny direct delete employee_ffs" ON public.employee_ffs
  FOR DELETE TO authenticated, anon USING (false);

-- 4. advance_recovery_schedule: same pattern
CREATE POLICY "Deny direct insert advance_recovery_schedule" ON public.advance_recovery_schedule
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Deny direct update advance_recovery_schedule" ON public.advance_recovery_schedule
  FOR UPDATE TO authenticated, anon USING (false);

CREATE POLICY "Deny direct delete advance_recovery_schedule" ON public.advance_recovery_schedule
  FOR DELETE TO authenticated, anon USING (false);

-- 5. invoice_number_seq: explicit deny on writes (already has deny SELECT)
CREATE POLICY "Deny insert invoice_number_seq" ON public.invoice_number_seq
  FOR INSERT TO authenticated, anon WITH CHECK (false);

CREATE POLICY "Deny update invoice_number_seq" ON public.invoice_number_seq
  FOR UPDATE TO authenticated, anon USING (false);

CREATE POLICY "Deny delete invoice_number_seq" ON public.invoice_number_seq
  FOR DELETE TO authenticated, anon USING (false);

-- 6. Revoke EXECUTE on SECURITY DEFINER functions from anon (only authenticated users may call)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_environment() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_sandbox_env() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gen_voucher_number(date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gen_paysheet_number(date, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gen_receipt_number(date, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gen_invoice_number(uuid, date, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gen_advance_number(date, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gen_ffs_number(date, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gen_contract_number(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.wipe_sandbox() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_paysheet(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_paysheet(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_paysheet(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.request_advance(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_advance(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_advance(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_advance(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_recovery_schedule(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.apply_advance_deductions_on_approve(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_active_advance_deductions(uuid, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.compute_ffs(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_ffs(jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.approve_ffs(uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_invoices() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.amount_in_words_inr(numeric) FROM anon, public;
