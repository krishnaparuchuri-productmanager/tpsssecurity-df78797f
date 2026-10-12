-- Make auto-generated client / employee codes collision-safe.
--
-- Bug: codes come from a sequence (CLT-001, EMP-001, ...). Records imported
-- with explicit codes never advanced the sequence, so the next generated code
-- could already exist and the insert failed with
--   duplicate key value violates unique constraint "clients_client_code_key".
-- (Sandbox: clients_code_seq at 3 vs CLT-034; employees_code_seq at 24 vs EMP-189.)
--
-- Fix: keep drawing from the sequence until the code is unused. SECURITY DEFINER
-- so the existence check sees every row regardless of RLS (the unique index
-- covers all rows, including soft-deleted ones).
-- Superseded by 20261012120100 (numbering continues after the highest code).

CREATE OR REPLACE FUNCTION public.gen_client_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
BEGIN
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
    LOOP
      v_code := 'CLT-' || LPAD(nextval('public.clients_code_seq')::TEXT, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE client_code = v_code);
    END LOOP;
    NEW.client_code := v_code;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.gen_employee_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_code text;
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    LOOP
      v_code := 'EMP-' || LPAD(nextval('public.employees_code_seq')::TEXT, 3, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_code = v_code);
    END LOOP;
    NEW.employee_code := v_code;
  END IF;
  RETURN NEW;
END; $function$;
