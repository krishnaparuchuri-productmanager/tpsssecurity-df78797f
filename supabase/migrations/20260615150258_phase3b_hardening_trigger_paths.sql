
ALTER FUNCTION public.expenses_validate() SET search_path = public;
ALTER FUNCTION public.compliance_payments_validate() SET search_path = public;
ALTER FUNCTION public.followups_validate() SET search_path = public;
ALTER FUNCTION public.payments_after_insert() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.gen_expense_number(date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.auto_close_followups_for_invoice(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_backup_log(jsonb) FROM anon, public;
