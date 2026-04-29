-- 1. Revoke EXECUTE on internal trigger function (still runs as table owner via trigger)
REVOKE EXECUTE ON FUNCTION public.set_invoice_branch_from_client() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_invoice_branch_from_client() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_invoice_branch_from_client() FROM authenticated;

-- 2. Explicit deny policies for the `backups` storage bucket
-- (Service role bypasses RLS, so the monthly-backup edge function continues to work.)
CREATE POLICY "Deny insert on backups bucket"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id <> 'backups');

CREATE POLICY "Deny update on backups bucket"
  ON storage.objects
  FOR UPDATE
  TO anon, authenticated
  USING (bucket_id <> 'backups');

CREATE POLICY "Deny delete on backups bucket"
  ON storage.objects
  FOR DELETE
  TO anon, authenticated
  USING (bucket_id <> 'backups');