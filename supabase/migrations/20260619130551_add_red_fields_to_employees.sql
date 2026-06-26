
-- Add the 4 red-marked mandatory fields from the Excel Employees sheet to the employees table.
-- These fields are mandatory per the source data spec and must reconcile with client_wage_config.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS four_hour_ot_rate   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_amount        numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relieving_charges   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leave_wages         numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.employees.four_hour_ot_rate  IS 'RED mandatory field: 4-Hr OT Rate (INR) per Excel employees sheet';
COMMENT ON COLUMN public.employees.bonus_amount       IS 'RED mandatory field: Bonus Amount (INR) per Excel employees sheet';
COMMENT ON COLUMN public.employees.relieving_charges  IS 'RED mandatory field: Relieving Charges (INR) per Excel employees sheet';
COMMENT ON COLUMN public.employees.leave_wages        IS 'RED mandatory field: Leave Wages (INR) per Excel employees sheet';

