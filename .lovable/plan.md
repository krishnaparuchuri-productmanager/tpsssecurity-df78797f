## Phase 3C — Post-scan hardening

Two small defense-in-depth fixes flagged by the security scan. No app-code changes; one SQL migration only.

### 1. Revoke EXECUTE on trigger function

`public.set_invoice_branch_from_client()` is a trigger function (fires inside the DB on insert/update of `invoices`). PostgreSQL grants EXECUTE to PUBLIC by default, which makes it appear as an anon-callable SECURITY DEFINER function in the scanner.

Migration:
```sql
REVOKE EXECUTE ON FUNCTION public.set_invoice_branch_from_client() FROM PUBLIC, anon, authenticated;
-- Trigger execution is unaffected; triggers run as table owner regardless of EXECUTE grants.
```

### 2. Explicit deny policies on `backups` storage bucket

The bucket already only has a CEO SELECT policy. Supabase denies writes by default, but the scanner recommends explicit deny policies for parity with our hardened tables (`audit_logs`, `cron_secrets`).

Migration:
```sql
CREATE POLICY "Deny insert backups bucket" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id <> 'backups');

CREATE POLICY "Deny update backups bucket" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id <> 'backups');

CREATE POLICY "Deny delete backups bucket" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id <> 'backups');
```

These policies coexist additively with any existing storage policies (PostgreSQL OR-combines permissive policies). They scope to the `backups` bucket only — uploads to other buckets are unaffected. Service role + the `monthly-backup` edge function (which uses service role) bypass RLS and continue to work.

### Files changed

```
supabase/migrations/<ts>_phase3c_hardening.sql   (new)
```

No frontend changes. No risk to existing functionality.

### Verification

After applying, re-run the security scan. Expected: 55 → 52 warnings (the 2 anon-executable + 1 storage finding gone).

Approve to apply.