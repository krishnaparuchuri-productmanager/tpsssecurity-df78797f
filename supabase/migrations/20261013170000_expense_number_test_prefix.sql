-- OF-16: sandbox expense numbers get the TEST- prefix (like receipts, invoices,
-- paysheets): TEST-EXP-OCT2026-001 in sandbox, EXP-OCT2026-001 in production.
-- The sequence is counted per prefix + month. Existing numbers are unchanged.
CREATE OR REPLACE FUNCTION public.gen_expense_number(_date date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sandbox boolean := public.is_sandbox_env();
  v_prefix text := CASE WHEN public.is_sandbox_env() THEN 'TEST-EXP-' ELSE 'EXP-' END;
  v_label text := upper(to_char(_date,'MonYYYY'));
  v_next int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(substring(expense_number FROM '-([0-9]+)$'), '')::int), 0) + 1
    INTO v_next
    FROM public.expenses
   WHERE is_sandbox = v_sandbox
     AND expense_number LIKE v_prefix || v_label || '-%';
  RETURN v_prefix || v_label || '-' || lpad(v_next::text, 3, '0');
END
$function$;
