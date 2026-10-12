-- Bank Payment: allow authorised users to record batches.
--
-- 20260624061610 enabled RLS on bank_payment_batches / bank_payment_records
-- with "deny direct insert" policies, but the Bank Payment screen writes both
-- tables directly, so every "Finalise & Generate Excel" failed with
--   new row violates row-level security policy for table "bank_payment_batches".
--
-- Inserts are now allowed for the same roles finalise_payment_batch() accepts
-- (CEO / COO / Accountant; Super Admin via has_role inheritance). A batch must
-- be stamped with the caller as generated_by. Update/delete remain denied, so
-- recorded payments stay immutable.

DROP POLICY IF EXISTS "Deny direct insert bank_payment_batches" ON public.bank_payment_batches;
CREATE POLICY "Create bank_payment_batches" ON public.bank_payment_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    is_active_user(auth.uid())
    AND generated_by = auth.uid()
    AND (has_role(auth.uid(), 'ceo_admin'::app_role)
      OR has_role(auth.uid(), 'coo_ops'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role))
  );

DROP POLICY IF EXISTS "Deny direct insert bank_payment_records" ON public.bank_payment_records;
CREATE POLICY "Create bank_payment_records" ON public.bank_payment_records
  FOR INSERT TO authenticated
  WITH CHECK (
    is_active_user(auth.uid())
    AND (has_role(auth.uid(), 'ceo_admin'::app_role)
      OR has_role(auth.uid(), 'coo_ops'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.bank_payment_batches b
      WHERE b.id = batch_id AND b.generated_by = auth.uid()
    )
  );
