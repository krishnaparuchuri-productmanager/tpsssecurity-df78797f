-- financial_ledger.balance_after was computed by each posting function as
-- MAX(balance_after) +/- amount (the highest balance ever, not the latest), and
-- approve_expense posted 0. A BEFORE INSERT trigger now sets it to the true
-- running total (sum of credits - debits of non-deleted entries in the same
-- environment, in posting order), whatever the caller passed. Existing rows are
-- recomputed once. (Cash Book computes its own running balance; this column is
-- not shown in the UI, but backups/exports use it.)

CREATE OR REPLACE FUNCTION public.ledger_set_balance_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Serialise postings per environment so concurrent inserts don't share a base.
  PERFORM pg_advisory_xact_lock(hashtext('financial_ledger_balance'), CASE WHEN NEW.is_sandbox THEN 1 ELSE 0 END);
  SELECT COALESCE(SUM(credit_amount - debit_amount), 0)
         + COALESCE(NEW.credit_amount, 0) - COALESCE(NEW.debit_amount, 0)
    INTO NEW.balance_after
    FROM public.financial_ledger
   WHERE is_sandbox = NEW.is_sandbox AND is_deleted = false;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ledger_set_balance_after ON public.financial_ledger;
CREATE TRIGGER trg_ledger_set_balance_after
  BEFORE INSERT ON public.financial_ledger
  FOR EACH ROW EXECUTE FUNCTION public.ledger_set_balance_after();

-- One-time recompute of existing non-deleted rows, in posting order.
WITH running AS (
  SELECT id, SUM(credit_amount - debit_amount)
           OVER (PARTITION BY is_sandbox ORDER BY created_at, id) AS bal
    FROM public.financial_ledger
   WHERE is_deleted = false
)
UPDATE public.financial_ledger fl SET balance_after = r.bal
  FROM running r
 WHERE fl.id = r.id AND fl.balance_after IS DISTINCT FROM r.bal;
