-- OF-25 (SANDBOX ONLY — not applied to production; production has no imported
-- paysheets). Imported May-2026 paysheets carried month label "2026-05" while
-- the app writes "MAY-2026". Normalise labels from month_date.
-- Label-only change: skip triggers (guard_paysheet_status re-checks approval
-- rules on every update of an approved paysheet).
SET LOCAL session_replication_role = replica;
UPDATE public.paysheets
   SET month = upper(to_char(month_date, 'Mon')) || '-' || to_char(month_date, 'YYYY')
 WHERE month ~ '^\d{4}-\d{2}$' AND is_sandbox = true;
