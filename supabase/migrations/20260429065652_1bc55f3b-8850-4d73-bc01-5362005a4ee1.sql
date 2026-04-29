-- 1) Tighten clients UPDATE policy: prevent unauthorized soft-delete
DROP POLICY IF EXISTS "Edit clients by permission" ON public.clients;

CREATE POLICY "Edit clients by permission"
ON public.clients
FOR UPDATE
TO authenticated
USING (has_permission(auth.uid(), 'clients', 'edit') AND is_active_user(auth.uid()))
WITH CHECK (
  has_permission(auth.uid(), 'clients', 'edit')
  AND is_active_user(auth.uid())
  -- Only CEO admins may toggle is_deleted (soft-delete)
  AND (
    is_deleted = (SELECT c.is_deleted FROM public.clients c WHERE c.id = clients.id)
    OR has_role(auth.uid(), 'ceo_admin')
  )
);

-- 2) Revoke EXECUTE from anon/public on SECURITY DEFINER functions exposed via PostgREST.
-- Keep authenticated execute for functions the app actually calls from the client.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_active_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_environment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_sandbox_env() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.amount_in_words_inr(numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.fy_string(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_voucher_number(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_paysheet_number(date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_receipt_number(date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_invoice_number(uuid, date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_paysheet(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_paysheet(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_paysheet(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wipe_sandbox() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._iw_under_hundred(integer) FROM PUBLIC, anon;