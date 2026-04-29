
-- Set search_path on the immutable / non-definer helpers that triggered the warning
ALTER FUNCTION public.fy_string(date) SET search_path = public;
ALTER FUNCTION public._iw_under_hundred(integer) SET search_path = public;
ALTER FUNCTION public.amount_in_words_inr(numeric) SET search_path = public;

-- Revoke PUBLIC execute on every SECURITY DEFINER function created in M1
REVOKE EXECUTE ON FUNCTION public.current_environment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_sandbox_env() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.guard_paysheet_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_paysheet_number(date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_receipt_number(date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_voucher_number(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.gen_invoice_number(uuid, date, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calc_invoice_fields() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_payment() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.after_payment_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.wipe_sandbox() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notify_env_change() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.version_wage_config() FROM PUBLIC, anon;

-- Grant explicit execute to authenticated for the few callable from the app
GRANT EXECUTE ON FUNCTION public.current_environment() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sandbox_env() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_sandbox() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_invoice_number(uuid, date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_paysheet_number(date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_receipt_number(date, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.amount_in_words_inr(numeric) TO authenticated;
