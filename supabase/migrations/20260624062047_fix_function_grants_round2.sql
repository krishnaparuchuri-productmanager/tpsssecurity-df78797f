
REVOKE EXECUTE ON FUNCTION public.confirm_uniform_advance(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalise_payment_batch(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_uniform_advance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalise_payment_batch(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.guard_paysheet_employees_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_create_uniform_advance_confirmations() FROM PUBLIC, anon, authenticated;

