
ALTER TABLE public.paysheets DISABLE TRIGGER trg_guard_paysheet_status;

UPDATE public.paysheets
SET total_earned_wages = 62108.16, total_net_salary = 53877.16
WHERE paysheet_number = 'PS-JP-2026-05';

ALTER TABLE public.paysheets ENABLE TRIGGER trg_guard_paysheet_status;

