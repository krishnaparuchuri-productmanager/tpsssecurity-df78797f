
-- Restrict paysheet_employees mutations to finance roles
DROP POLICY IF EXISTS "Manage paysheet_employees" ON public.paysheet_employees;
CREATE POLICY "Manage paysheet_employees" ON public.paysheet_employees
  FOR ALL TO authenticated
  USING (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'ceo_admin'::app_role)
      OR has_role(auth.uid(), 'coo_ops'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid())
    AND (
      has_role(auth.uid(), 'ceo_admin'::app_role)
      OR has_role(auth.uid(), 'coo_ops'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );

-- Guard trigger: prevent changes to paysheet_employees rows whose parent paysheet is approved
CREATE OR REPLACE FUNCTION public.guard_paysheet_employees_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_status text;
  parent_id uuid;
BEGIN
  parent_id := COALESCE(NEW.paysheet_id, OLD.paysheet_id);
  IF parent_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT status::text INTO parent_status FROM public.paysheets WHERE id = parent_id;
  IF parent_status = 'approved' THEN
    RAISE EXCEPTION 'Cannot modify paysheet_employees: parent paysheet is approved';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_paysheet_employees_status ON public.paysheet_employees;
CREATE TRIGGER trg_guard_paysheet_employees_status
  BEFORE INSERT OR UPDATE OR DELETE ON public.paysheet_employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_paysheet_employees_status();

-- Restrict invoice updates to finance roles
DROP POLICY IF EXISTS "Update invoices" ON public.invoices;
CREATE POLICY "Update invoices" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    is_active_user(auth.uid())
    AND is_deleted = false
    AND (
      has_role(auth.uid(), 'ceo_admin'::app_role)
      OR has_role(auth.uid(), 'coo_ops'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  )
  WITH CHECK (
    is_active_user(auth.uid())
    AND is_deleted = false
    AND (
      has_role(auth.uid(), 'ceo_admin'::app_role)
      OR has_role(auth.uid(), 'coo_ops'::app_role)
      OR has_role(auth.uid(), 'accountant'::app_role)
    )
  );
