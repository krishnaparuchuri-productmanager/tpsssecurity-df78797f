## Phase 2 Gap Fix — Monthly Expenses & Compliance Calendar

Both routes (`/app/expenses`, `/app/compliance`) currently render `<Placeholder />`. This plan replaces only those two stubs and adds the minimum backend needed for compliance tracking. Phase 1, 2, 3A code remains untouched.

---

### Scope

**In scope**
1. `/app/expenses` → real **Monthly Expenses** module (entry + list + summary)
2. `/app/compliance` → real **Compliance Calendar** module (statutory due-date tracker)
3. One new table (`compliance_tasks`) + small RPCs for write operations
4. Two `App.tsx` route swaps (placeholders → real components)

**Out of scope** (untouched)
- All Phase 1 / 2 / 3A pages, RPCs, RLS, edge functions
- `MonthlySummary.tsx`, `FinancialDashboard.tsx`, `MomReport.tsx` (already done)
- GST/ECR/ESI challan generation (Phase 3B)
- Statement of Account / Aging (Phase 3B)

---

### 1. Monthly Expenses (`src/pages/app/expenses/`)

Single page with three tabs: **Add Expense**, **List**, **Monthly Summary**. All data flows through the existing `financial_ledger` table — **no new expense table needed** (the ledger already has every expense category in `ledger_category` enum and the right INSERT RLS for accountant/CEO/COO).

**Tab 1 — Add Expense (form)**
Fields:
- Date (default today)
- Category dropdown (filtered to expense categories: `epf_payment`, `esi_payment`, `gst_payment`, `pt_payment`, `staff_salary`, `salary_advance`, `admin_expense`, `vehicle_expense`, `other_expense`)
- Particulars (text, required)
- Amount (₹, required, > 0)
- Client (optional — only for client-attributable expenses)
- Reference number (optional — challan no., bill no., etc.)
- Notes (optional)

On submit: call new RPC `record_expense(_payload jsonb)` which:
- Generates voucher number via existing `gen_voucher_number()`
- Computes `balance_after` (max balance ≤ entry_date, minus amount)
- Inserts a debit row into `financial_ledger` with `entry_type='payment'`
- Writes audit_logs row
- Returns the new row id

**Tab 2 — List (filterable table)**
Columns: Date, Voucher #, Category, Particulars, Client, Amount, Reference, Created by
Filters: Month/year picker, Category multi-select, Client filter, search by particulars
Source: `financial_ledger` where `category IN (expense cats)` and `is_sandbox = env`, `is_deleted=false`
Export: Excel via `xlsx` (already in deps)

**Tab 3 — Monthly Summary**
- KPI tiles: Total this month, Total YTD, Largest category, Count of entries
- Bar chart: expenses by category for selected month (recharts)
- Line chart: monthly expense trend, last 12 months
(Reuses styling from `FinancialDashboard.tsx`)

**Permissions** — uses existing `expenses` screen permission (already seeded in `role_permissions`):
- Accountant: view/create/edit
- CEO: full
- COO: view/export only

---

### 2. Compliance Calendar (`src/pages/app/compliance/`)

A statutory due-date tracker for monthly/quarterly/annual filings (EPF ECR, ESI challan, GST returns, PT, TDS, etc.). One main page with a calendar grid view + an upcoming-tasks list.

**New table: `compliance_tasks`**
```text
id uuid pk
task_code text             -- e.g. 'EPF_ECR', 'GST_GSTR1', 'ESI_CHALLAN', 'PT_RETURN', 'TDS_24Q'
task_name text             -- display name
category text              -- 'EPF' | 'ESI' | 'GST' | 'PT' | 'TDS' | 'Other'
frequency text             -- 'monthly' | 'quarterly' | 'annual' | 'one_time'
due_date date              -- the actual deadline for this period
period_label text          -- e.g. 'May 2026', 'Q1 FY26-27'
status text                -- 'pending' | 'in_progress' | 'completed' | 'overdue'
completed_date date
completed_by uuid
challan_number text        -- optional reference once filed
amount_paid numeric        -- optional
notes text
assigned_to uuid           -- user_profiles.id
reminder_days_before int default 7
is_sandbox boolean default is_sandbox_env()
is_deleted boolean default false
created_by uuid, created_at, updated_at
```

**RLS** (mirrors existing patterns)
- SELECT: `is_active_user(auth.uid()) AND is_deleted=false`
- Direct INSERT/UPDATE/DELETE denied for `anon,authenticated` (writes via RPC only)

**Seed**: insert ~12 standard recurring task templates for the next 12 months on first load (server-side function `seed_compliance_tasks(_from date, _to date)` callable by CEO/COO).

**RPCs**
- `create_compliance_task(_payload jsonb)` — manual one-off task (CEO/COO/accountant)
- `complete_compliance_task(_id uuid, _challan text, _amount numeric, _notes text)` — marks done, audit log
- `update_compliance_task(_id uuid, _payload jsonb)` — edit pending tasks

**Daily cron extension**: extend existing `daily-contract-checks` edge function to also:
- Mark tasks `overdue` where `due_date < today AND status != 'completed'`
- Notify `assigned_to` (or all CEO/COO/accountant if unassigned) when `due_date - today = reminder_days_before`

**UI**
- **Header**: month/year selector, category filter, status filter, "+ New Task" button
- **Calendar grid**: month view with colored dots per task (red=overdue, amber=pending ≤7d, green=completed). Click a day → drawer with that day's tasks.
- **Upcoming list** (sidebar/below): next 30 days of pending tasks, grouped by week
- **Row actions**: Mark complete (opens dialog for challan #, amount), Edit, View history
- **KPI tiles**: Overdue count, Due this week, Completed this month, Compliance rate %

**Permissions** — uses existing `compliance` screen permission already seeded.

---

### 3. App.tsx wiring

```text
- <Route path="expenses"   element={<Placeholder title="Monthly Expenses" />} />
- <Route path="compliance" element={<Placeholder title="Compliance Calendar" />} />
+ <Route path="expenses"   element={<ExpensesIndex />} />
+ <Route path="compliance" element={<ComplianceCalendar />} />
```
Plus 2 new imports.

---

### Files

**New components**
- `src/pages/app/expenses/ExpensesIndex.tsx` (tabs container)
- `src/pages/app/expenses/ExpenseForm.tsx`
- `src/pages/app/expenses/ExpensesList.tsx`
- `src/pages/app/expenses/ExpensesSummary.tsx`
- `src/pages/app/compliance/ComplianceCalendar.tsx`
- `src/pages/app/compliance/ComplianceTaskDialog.tsx` (create/edit)
- `src/pages/app/compliance/CompleteTaskDialog.tsx`

**New migration** (single file)
- `compliance_tasks` table + RLS + RPCs + seed function + initial seed for next 12 months

**Edited (minimal)**
- `src/App.tsx` — swap 2 placeholders + 2 imports
- `supabase/functions/daily-contract-checks/index.ts` — append compliance overdue/reminder logic (one extra block, existing flow preserved)

---

### Technical notes

- All writes flow through SECURITY DEFINER RPCs (consistent with the security memory rule established when fixing scan findings).
- Expense entries are pure ledger inserts — no new domain table needed; `financial_ledger` already has UPDATE/DELETE blocked at RLS, which is the desired immutable-ledger behavior.
- Compliance task completion is a state change, not a financial entry; if the user paid a challan it should be entered separately under Expenses (linked via `challan_number` reference).
- All new pages respect `useEnvironment()` sandbox/live filtering.
- No new secrets, no new external services.

After this gap fix, **Phase 2 is fully complete** and Phase 3B (SoA/Aging, ECR/ESI generation, payment follow-up) and 3C (backup, activity log, annual CA export) can proceed cleanly.

Approve this and I'll implement both modules in one pass.