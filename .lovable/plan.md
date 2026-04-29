## Phase 3A — Advances, Contracts, Deployments, FFS

Adds four new modules on top of Phase 1/2 without touching existing UI, routes, or tables (only retrofit columns where required). Follows existing patterns: RLS, `is_sandbox`, `is_deleted`, soft deletes, server-side calculations via SECURITY DEFINER RPCs, audit logging, sandbox-aware filtering, notifications via existing `notifications` table.

---

### 1. Database migrations

**New tables** (all with RLS, `is_sandbox`, `is_deleted`, `set_updated_at` trigger where appropriate):

- `branches` — seed `{Nellore, NLR, head_office=true}`
- `shifts` — seed Day (07:00–19:00, 8h) and Night (19:00–07:00, 8h) for Nellore
- `client_posts`
- `employee_deployments` — one current deployment per employee enforced via partial unique index `(employee_id) WHERE is_current AND NOT is_deleted`
- `client_contracts` — server-generated `CNT-{client_code}-NNN`
- `contract_renewals`
- `employee_advances` — server-generated `ADV-MMMYYYY-NNN`
- `advance_recovery_schedule`
- `employee_ffs` — server-generated `FFS-MMMYYYY-NNN`

**Retrofits** (additive only, all nullable/defaulted; existing rows untouched):

- `clients.branch_id` → defaults to Nellore branch via post-migration update
- `employees.branch_id` → same default
- `employees.max_advance_limit numeric default 0`
- `employees.current_advance_balance numeric default 0`
- `invoices.po_number text`, `invoices.po_date date`

**New sequences:** `advance_seq`, `ffs_seq`, `contract_seq` (per-client via subquery count).

**RLS pattern (per spec):**

- SELECT for `is_active_user(auth.uid())` filtered by `is_deleted=false`
- INSERT advances → accountant only (`has_role(...,'accountant')`)
- UPDATE advance status pending→approved/rejected → ceo/coo only, with check `approved_by <> requested_by` enforced in trigger
- UPDATE advance amount_remaining → blocked except via SECURITY DEFINER function (RLS denies generic UPDATE on those columns; RPC bypasses)
- Deployments / shifts / branches / posts / contracts CRUD → ceo/coo (view all)
- FFS INSERT → accountant; APPROVE → ceo/coo

**New SECURITY DEFINER functions:**

- `gen_advance_number(_d date, _sandbox bool)` → `ADV-MMMYYYY-NNN`
- `gen_ffs_number(_d date, _sandbox bool)` → `FFS-MMMYYYY-NNN`
- `gen_contract_number(_client_id uuid)` → `CNT-{client_code}-NNN`
- `request_advance(_payload jsonb)` → validates against `max_advance_limit`, inserts row, notifies CEO/COO, audit log
- `approve_advance(_id uuid)` → role + non-self-approve check, sets status=`active`, calls `generate_recovery_schedule(_id)`, updates `employees.current_advance_balance`, notifies accountant
- `reject_advance(_id uuid, _reason text)` → 10–200 char reason, notifies accountant
- `generate_recovery_schedule(_advance_id uuid)` → inserts N rows; final row carries remainder
- `apply_advance_deductions_on_approve(_paysheet_id uuid)` → wired into existing `approve_paysheet`: marks scheduled rows `deducted`, decrements `amount_remaining`, flips to `fully_recovered`, recomputes `current_advance_balance`
- `compute_ffs(_payload jsonb) returns jsonb` — server-side total earnings/deductions/net, gratuity = `ROUND(basic*4.81/100*years,2)` only if years>=5; pulls live `advance_outstanding` from `employee_advances`
- `save_ffs(_payload jsonb)` → upsert draft/submitted; recomputes server-side
- `approve_ffs(_id uuid, _payment jsonb)` → ceo/coo, sets employee `status='relieved'`, ends current deployment, advances marked settled, notifies accountant
- `renew_contract(_payload jsonb)` → creates new contract + optional new `client_wage_config`, links via `contract_renewals`, marks old `status='renewed'`
- `mark_contract_status_and_notify()` → daily; sets `expired`, sends 30/15/7-day expiry notifications (dedupe by date)

**Existing function update:** extend `approve_paysheet(_id)` to call `apply_advance_deductions_on_approve(_id)` after status flip.

**Existing function update:** `save_paysheet` continues to accept `advance_deduction` per row (already supported); UI will pre-fill via new RPC `get_active_advance_deductions(_client_id, _month_date)` returning `[{employee_id, scheduled_amount, schedule_id}]`.

---

### 2. Edge functions + cron

- New edge function `daily-contract-checks` → calls `mark_contract_status_and_notify()`. Same auth pattern as existing `check-overdue-invoices` (uses `x-cron-secret`).
- Add pg_cron job (via insert tool, not migration — contains URL/anon key per docs) to invoke daily at 06:00 IST.

---

### 3. Frontend — new routes (added to existing `App.tsx` Routes block; existing routes untouched)

**Advances**
- `/app/employees/advances/list` — `AdvancesList.tsx` (filters: employee, client, status, month)
- `/app/employees/advances/new` — `AdvanceForm.tsx`
- `/app/employees/advances/approvals` — `AdvanceApprovals.tsx` (ceo/coo via `requireRoles`)
- `/app/masters/employees/:id/advances` — tab on employee detail (history + running balance)

**FFS**
- `/app/employees/ffs/list` — `FfsList.tsx`
- `/app/employees/ffs/new` — `FfsForm.tsx` (3-step wizard, server preview via `compute_ffs`)
- `/app/employees/ffs/approvals` — `FfsApprovals.tsx` (ceo/coo)
- `/app/employees/ffs/:id/view` — `FfsView.tsx` + PDF (jsPDF, mirrors existing `exportPaysheet` pattern)

**Contracts**
- `/app/masters/contracts/list` — `ContractsList.tsx` (ceo/coo, filters: status/branch/expiry month)
- `/app/masters/clients/:id` — extend existing client detail with **Contracts** and **Deployments** tabs (additive — no rewrite of existing `ClientForm`; new `ClientDetail` route or tabbed extension)
- `ContractRenewWizard.tsx` modal: 3 steps (details → wage revision → confirm)

**Deployments / Shifts / Branches**
- `/app/masters/branches` — `BranchesList.tsx` (ceo/coo CRUD)
- `/app/masters/deployments` — `DeploymentsList.tsx` + `DeploymentForm.tsx` + Relieve dialog
- `/app/masters/deployments/shifts` — `ShiftsList.tsx` (ceo/coo)

**Employee master retrofit** (additive fields in existing `EmployeeForm.tsx`):
- Append a "Limits" section: `max_advance_limit` input, read-only `current_advance_balance` display. No layout rewrite.

**Paysheet integration** (minimal patch to existing `PaysheetCreate.tsx`):
- After loading client + month, call `get_active_advance_deductions` and `employee_deployments` (current rows for client) → pre-fill rows with deployed employees and pre-fill `advance_deduction`. Each pre-filled employee badged "Deployed ✅" or "⚠️ Ad-hoc". All values remain editable; overrides logged via existing audit pattern.

---

### 4. Dashboard additions (additive cards in existing `Dashboard.tsx`)

Insert new KPI tiles into existing grid (no removals):
- Active Deployments (count)
- Advances Outstanding (₹ total)

New alert cards below existing approval banner:
- Contracts expiring in 30 days (list)
- Pending Advance Approvals (ceo/coo)
- Pending FFS Approvals (ceo/coo)

---

### 5. Navigation additions in `AppLayout.tsx`

Append (do not remove) under existing groups:

- **Masters**: Branches, Shifts, Deployments, Contracts
- **New group "Employee Lifecycle"** (so the existing Employees nav item stays untouched): Advances, Advance Approvals, Full & Final, FFS Approvals — approval items gated by `requireRoles=["ceo_admin","coo_ops"]` and show pending-count badge fetched in sidebar.

---

### 6. Notifications

All seven notification types from spec inserted via existing `notifications` table inside the new RPCs / cron function. Reuses existing `Read own notifications` RLS.

---

### 7. Out of scope (Phase 3B/3C — not built)

Expenses, payment follow-up, SoA/Aging, GST/ECR/ESI challans, compliance calendar, backup, MoM, user activity, annual CA export.

---

### Technical notes

- Advance limit enforced both client-side (form validation) and server-side (`request_advance` raises exception → toast).
- Recovery schedule uses `monthly_deduction` per row; final row computed as `total_amount - sum(prior)`.
- Gratuity displayed only if `years_of_service >= 5`; toggle disabled otherwise; calculation done server-side in `compute_ffs`.
- Contract expiry notifications dedupe by `(related_record_id, type, created_at::date)` — same pattern as `mark_overdue_invoices`.
- Deployment uniqueness uses partial unique index, not a check constraint, so it is restore-safe.
- All new tables include `is_sandbox` defaulted from `is_sandbox_env()`; client filters every query by current env (matches existing pattern).
- `wipe_sandbox()` extended to also delete sandbox rows from the new tables.

After approval, I'll run the migration, deploy the edge function, register the cron job, and add the new UI files.