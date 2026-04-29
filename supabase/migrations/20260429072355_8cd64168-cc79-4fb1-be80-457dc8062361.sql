CREATE TABLE IF NOT EXISTS public.cron_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_secrets ENABLE ROW LEVEL SECURITY;
-- No policies = no access from PostgREST (anon or authenticated). Only superuser/cron can read.
REVOKE ALL ON public.cron_secrets FROM PUBLIC, anon, authenticated;