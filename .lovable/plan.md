## Phase 3B Plan — Finance, Compliance, Backup

All additions are **net-new routes, tables, RPCs, and edge functions**. No Phase 1/2/3A files are modified except `App.tsx` (route registrations) and `AppLayout.tsx` (sidebar entries).

### Reconciling overlap with Phase 2

Phase 2 already shipped:
- `/app/expenses` → uses `financial_ledger` directly (no `expenses` table)
- `/app/compliance` → `compliance_tasks` table (manual seed model)

Phase 3B replaces these with proper domain tables. Approach:

- Keep Phase 2 routes alive but add a **deprecation note** banner pointing to the new routes.
- New `expenses` table is the source of truth going forward; old direct-ledger entries remain visible in Cash Book/Summary (they were already in `financial_ledger`).
- `compliance_tasks` (manual ad-hoc tasks) stays. New `/app/compliance/calendar` uses **deterministic monthly deadlines** (computed in code, not seeded rows) and **`compliance_payments`** for actuals. No data migration.

---

### 1. Database (one migration)

**New tables (all with `is_sandbox`, `is_deleted`, RLS, audit triggers):**

`expense_categories` — id, category_name (unique), is_active, sort_order, created_at
- Seed 19 default categories per spec
- RLS: read = active user; write = ceo_admin only

`expenses` — id, expense_number (EXP-MMMYYYY-NNN), expense_date, branch_id, category_id, description, amount (>0 trigger), payment_mode (enum-text), reference_number, receipt_url, recorded_by, approved_by, status ('draft'|'approved'), is_sandbox, is_deleted, timestamps
- RLS: SELECT all active users (sandbox-scoped); INSERT/UPDATE via RPC only (deny direct)
- Validation trigger: amount > 0; status transitions only forward

`compliance_payments` — id, payment_type ('EPF'|'ESI'|'GST'|'PT'|'TDS'|'OTHER'), payment_month (date, day=1), payment_date, branch_id, amount, challan_number, bank_name, reference_number, late_fee, interest, total_paid (computed col), paysheet_id, notes, recorded_by, is_sandbox, is_deleted, created_at
- RLS: same pattern — SELECT for active users, writes via RPC

`invoice_followups` — id, invoice_id, client_id, followup_date, contacted_by, contact_mode, response (max 1000), promise_date, next_followup_date, status ('open'|'in_progress'|'promised'|'closed'), closed_reason, is_sandbox, is_deleted, created_by, timestamps
- RLS: SELECT for active users; writes via RPC

`backup_logs` — id, backup_type ('auto_cron'|'manual'), triggered_by, backup_date, file_path, file_size_kb, tables_included (jsonb), status, error_message, created_at
- RLS: SELECT/INSERT via service role only; CEO can SELECT

**RPCs (SECURITY DEFINER, audit-logged):**
- `gen_expense_number(_date date) → text`
- `record_expense(_payload jsonb) → uuid` (creates draft)
- `approve_expense(_id uuid) → void` — sets status, inserts ledger DEBIT row mapping category → ledger_category, writes audit
- `record_compliance_payment(_payload jsonb) → uuid` — inserts row + ledger DEBIT (epf/esi/gst/pt_payment)
- `create_followup(_payload jsonb) → uuid`
- `update_followup(_id uuid, _payload jsonb) → void`
- `auto_open_followups() → int` — for each invoice where due_date < today AND outstanding > 0 AND no open followup → create row + notify accountant + COO
- `auto_close_followups(_invoice_id uuid)` — called from payment-recording flow (we'll add a trigger on `payments` insert that calls this when invoice outstanding becomes 0; closes open followups, notifies)
- `manage_expense_category(_payload jsonb) → uuid` (CEO only)

**Storage bucket:** `backups` (private). RLS: only service role writes; CEO reads via signed URLs.

---

### 2. Edge functions

`monthly-backup` (new)
- Triggered by pg_cron on 1st of month 00:30 IST and on-demand by CEO
- Iterates whitelist of tables → CSV per table → zips → uploads to `backups/{auto|manual}/YYYY-MM/backup_{stamp}.zip`
- Inserts `backup_logs` row, notifies CEO
- pg_cron schedule installed via `cron_secrets`-driven SQL (per project rules — runs through insert tool, not migration)

`daily-followup-sweep` (new)
- Calls `auto_open_followups()` daily at 06:00 IST
- pg_cron entry

Existing `daily-contract-checks` is **not modified**.

---

### 3. Frontend — new files only

**Expenses module (Phase 3B replacement)**
```
src/pages/app/finance/expenses/ExpensesList.tsx        → /app/finance/expenses/list
src/pages/app/finance/expenses/ExpenseNew.tsx          → /app/finance/expenses/new
src/pages/app/finance/expenses/ExpenseRow.tsx
src/pages/app/finance/compliance-payments/Index.tsx    → /app/finance/compliance-payments
src/pages/app/finance/compliance-payments/PaymentDialog.tsx
src/pages/app/masters/ExpenseCategories.tsx            → /app/masters/expense-categories  (CEO only, drag-reorder via @dnd-kit/core)
```

**Follow-ups**
```
src/pages/app/finance/followups/FollowupsList.tsx      → /app/finance/followups
src/pages/app/finance/followups/FollowupDialog.tsx     (add note modal)
src/pages/app/finance/followups/FollowupTimeline.tsx   (history per invoice)
```
- Color coding by days-overdue; sort default desc
- Per-row "Add Note" modal posts via `create_followup`

**Statement of Account**
```
src/pages/app/finance/StatementOfAccount.tsx           → /app/finance/statement
src/lib/soaPdf.ts   (jsPDF + jspdf-autotable; pulls company_profile letterhead)
```
- Client + date range selectors
- On-screen ledger view (debit = invoices, credit = payments) + opening/closing balance
- PDF + Excel download (xlsx already in deps)

**Aging Report**
```
src/pages/app/finance/AgingReport.tsx                  → /app/finance/aging
```
- Bucketing 0-30 / 31-60 / 61-90 / 90+ from invoices.outstanding_amount + invoice_date
- Branch filter; client drill-down (expandable row → invoice list)
- Excel export (CEO/COO)

**GST Report**
```
src/pages/app/finance/GstReport.tsx                    → /app/finance/gst-report
```
- Two tabs (GSTR-1 forward charge, RCM); month/branch filter; Excel exports per tab

**ECR generator**
```
src/pages/app/compliance/EcrGenerate.tsx               → /app/compliance/ecr
src/lib/ecrFile.ts   (text serializer, EPFO 2.0 format)
```
- Paysheet picker → editable preview table → `.txt` download
- Excludes rows with missing UAN (highlighted red)
- ECR history table queries past `audit_logs` entries tagged `ecr_generated`

**ESI challan**
```
src/pages/app/compliance/EsiChallan.tsx                → /app/compliance/esi-challan
src/lib/esiChallan.ts  (xlsx serializer)
```

**Compliance Calendar (new — deadline-driven)**
```
src/pages/app/compliance/CalendarV2.tsx                → /app/compliance/calendar
```
- Computes 6 fixed monthly deadlines in code (EPF 15, ESI 15, GSTR-1 11, GSTR-3B 20, PT month-end, TDS 7-of-next)
- Joins with `compliance_payments` to compute Done/Pending status
- Calendar grid + list view + "Mark as Done" → opens PaymentDialog
- 7d/2d/0d/overdue notifications handled by `daily-followup-sweep` (extended to also sweep deadlines)

**Backup admin**
```
src/pages/app/admin/Backup.tsx                         → /app/admin/backup  (CEO only)
```
- backup_logs table view, Download via signed URL, [Run Manual Backup] invokes edge fn

---

### 4. Routing & navigation

`src/App.tsx` — append 12 new `<Route>` entries inside existing `/app` shell. Keep Phase 2 `/app/expenses` and `/app/compliance` routes intact.

`src/components/app-shell/AppLayout.tsx` — extend the `NAV` array:
- **Finance** group → add Follow-ups, Statement of Account, Aging Report, GST Report, Expenses (new), Compliance Payments
- **Compliance** group → add Compliance Calendar (new), ECR Generation, ESI Challan
- **Masters** group → add Expense Categories (CEO only)
- **Administration** group → add Backup (CEO only)

Old Phase 2 entries stay (they still work) — banner inside those screens points to new versions.

---

### 5. Permissions / role_permissions seeds

Add screen codes (insert via insert tool, not migration):
`expenses_v2`, `compliance_payments`, `followups`, `statement`, `aging`, `gst_report`, `ecr`, `esi_challan`, `compliance_calendar_v2`, `expense_categories`, `backup`

Defaults:
- ceo_admin: full on all
- coo_ops: view/edit on finance + compliance, no expense_categories/backup
- accountant: view/create/edit on expenses_v2, compliance_payments, followups, statement, aging, gst_report, ecr, esi_challan, compliance_calendar_v2

---

### 6. Deliberately deferred (Phase 3C)

MoM/comparative reports, annual CA export, user activity log, billing history, employee history, Phase 3C dashboard widgets — **not built**.

---

### Technical notes

- All writes use SECURITY DEFINER RPCs (consistent with existing security memory rule).
- Validation triggers (not CHECK constraints) for amount/date/status invariants.
- `expense_number` and `receipt_number`-style sequencing reuses the `gen_voucher_number()` pattern.
- pg_cron + pg_net enabled for backup + followup-sweep schedules; cron SQL inserted via insert tool (not migration) per project rules.
- Storage bucket `backups` is private; downloads use 60-min signed URLs.
- `xlsx`, `jspdf`, `jspdf-autotable` already present from earlier phases; will add `@dnd-kit/core` for category reorder.
- Every new screen respects `useEnvironment()` sandbox scoping and `useAuth().can()` permissions.

Approve and I'll implement in one pass: migration → seeds → RPCs → edge functions → cron → screens → routes → sidebar.
