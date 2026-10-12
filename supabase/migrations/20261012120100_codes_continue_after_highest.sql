-- Client / employee codes: continue after the highest existing code.
-- Refines 20261012120000 so new codes never fill gaps in imported numbering.
--
-- Bug: codes come from a sequence (CLT-001, EMP-001, ...). Records imported
-- with explicit codes never advanced the sequence, so the next generated code
-- could already exist and the insert failed with
--   duplicate key value violates unique constraint "clients_client_code_key".
-- (Sandbox: clients_code_seq at 3 vs CLT-034; employees_code_seq at 24 vs EMP-189.)
--
-- Fix: if the sequence is behind the highest existing code, move it past that
-- code (so numbering keeps increasing instead of filling old gaps), then keep
-- drawing until the code is unused. SECURITY DEFINER so the checks see every
-- row regardless of RLS (the unique index covers all rows, incl. soft-deleted).

CREATE OR REPLACE FUNCTION public.gen_client_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_max bigint;
  v_code text;
BEGIN
  IF NEW.client_code IS NULL OR NEW.client_code = '' THEN
    SELECT COALESCE(MAX((substring(client_code FROM '^CLT-(\d+)$'))::bigint), 0)
      INTO v_max FROM public.clients;
    LOOP
      v_code := 'CLT-' || LPAD(nextval('public.clients_code_seq')::TEXT, 3, '0');
      IF (substring(v_code FROM '^CLT-(\d+)$'))::bigint <= v_max THEN
        PERFORM setval('public.clients_code_seq', v_max, true);
        CONTINUE;
      END IF;
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
  v_max bigint;
  v_code text;
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    SELECT COALESCE(MAX((substring(employee_code FROM '^EMP-(\d+)$'))::bigint), 0)
      INTO v_max FROM public.employees;
    LOOP
      v_code := 'EMP-' || LPAD(nextval('public.employees_code_seq')::TEXT, 3, '0');
      IF (substring(v_code FROM '^EMP-(\d+)$'))::bigint <= v_max THEN
        PERFORM setval('public.employees_code_seq', v_max, true);
        CONTINUE;
      END IF;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_code = v_code);
    END LOOP;
    NEW.employee_code := v_code;
  END IF;
  RETURN NEW;
END; $function$;
