
ALTER TABLE public.paysheet_employees DISABLE TRIGGER trg_guard_paysheet_employees_status;

UPDATE public.paysheet_employees
SET earned_wages = 11054.00, net_salary = 10508.00, final_net_salary = 10008.00
WHERE id = 'c1b716ec-394d-414c-be06-e838a1275fb5'; -- A.SHYAM

UPDATE public.paysheet_employees
SET earned_wages = 11054.00, net_salary = 10508.00, final_net_salary = 9508.00
WHERE id = '21df17ed-f252-4ffe-9bb1-a82c50448d05'; -- G.SANDEEP

UPDATE public.paysheet_employees
SET earned_wages = 713.16, net_salary = 678.16, final_net_salary = 678.16
WHERE id = '3fd1cfc3-ca6e-4cd0-84c3-678045373101'; -- K.VENKATESWARLU

ALTER TABLE public.paysheet_employees ENABLE TRIGGER trg_guard_paysheet_employees_status;

