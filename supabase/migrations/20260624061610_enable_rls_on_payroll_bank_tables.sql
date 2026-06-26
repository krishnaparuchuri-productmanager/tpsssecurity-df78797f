
ALTER TABLE public.uniform_advance_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View uniform_advance_confirmations" ON public.uniform_advance_confirmations
  FOR SELECT TO authenticated
  USING (is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'ceo_admin'::app_role) OR
    has_role(auth.uid(), 'coo_ops'::app_role) OR
    has_role(auth.uid(), 'accountant'::app_role)
  ));

CREATE POLICY "Deny direct insert uniform_advance_confirmations" ON public.uniform_advance_confirmations
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Deny direct update uniform_advance_confirmations" ON public.uniform_advance_confirmations
  FOR UPDATE TO anon, authenticated USING (false);

CREATE POLICY "Deny direct delete uniform_advance_confirmations" ON public.uniform_advance_confirmations
  FOR DELETE TO anon, authenticated USING (false);

ALTER TABLE public.bank_payment_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View bank_payment_batches" ON public.bank_payment_batches
  FOR SELECT TO authenticated
  USING (is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'ceo_admin'::app_role) OR
    has_role(auth.uid(), 'coo_ops'::app_role) OR
    has_role(auth.uid(), 'accountant'::app_role)
  ));

CREATE POLICY "Deny direct insert bank_payment_batches" ON public.bank_payment_batches
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Deny direct update bank_payment_batches" ON public.bank_payment_batches
  FOR UPDATE TO anon, authenticated USING (false);

CREATE POLICY "Deny direct delete bank_payment_batches" ON public.bank_payment_batches
  FOR DELETE TO anon, authenticated USING (false);

ALTER TABLE public.bank_payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View bank_payment_records" ON public.bank_payment_records
  FOR SELECT TO authenticated
  USING (is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'ceo_admin'::app_role) OR
    has_role(auth.uid(), 'coo_ops'::app_role) OR
    has_role(auth.uid(), 'accountant'::app_role)
  ));

CREATE POLICY "Deny direct insert bank_payment_records" ON public.bank_payment_records
  FOR INSERT TO anon, authenticated WITH CHECK (false);

CREATE POLICY "Deny direct update bank_payment_records" ON public.bank_payment_records
  FOR UPDATE TO anon, authenticated USING (false);

CREATE POLICY "Deny direct delete bank_payment_records" ON public.bank_payment_records
  FOR DELETE TO anon, authenticated USING (false);

ALTER TABLE public.tpss_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View tpss_bank_accounts" ON public.tpss_bank_accounts
  FOR SELECT TO authenticated
  USING (is_active_user(auth.uid()) AND (
    has_role(auth.uid(), 'ceo_admin'::app_role) OR
    has_role(auth.uid(), 'accountant'::app_role)
  ));

CREATE POLICY "Manage tpss_bank_accounts" ON public.tpss_bank_accounts
  FOR ALL TO authenticated
  USING (is_active_user(auth.uid()) AND has_role(auth.uid(), 'ceo_admin'::app_role))
  WITH CHECK (is_active_user(auth.uid()) AND has_role(auth.uid(), 'ceo_admin'::app_role));

