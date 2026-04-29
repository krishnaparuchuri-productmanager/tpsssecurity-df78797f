## Phase 3C — Reports, Activity Log, Multi-Branch Foundation

Strictly additive on top of 3A/3B. New tables follow existing patterns (RLS, `is_deleted`, `is_sandbox`, audit).

---

### 1. Database changes (one migration)

**New table `user_activity_log`**
- Columns: `id`, `user_id`, `activity_type`, `page_url`, `ip_address`, `device_info`, `details (jsonb)`, `created_at`
- Allowed `activity_type`: `login | logout | login_failed | export | approve | reject | create | update | delete | page_view`
- RLS: SELECT for `ceo_admin` only. INSERT only via SECURITY DEFINER RPC `log_activity`. No UPDATE/DELETE policies.
- Index on `(user_id, created_at desc)` and `(activity_type, created_at desc)`

**New RPCs (SECURITY DEFINER, granted to authenticated only)**
- `log_activity(_type, _page_url, _ip, _device, _details)` — inserts row using `auth.uid()`.
- `log_failed_login(_email, _ip, _device)` — looks up user_id by email (if exists) and inserts a `login_failed` row; returns count of failures in last hour for that user.
- `get_branch_summary()` — returns per-branch counts (clients, employees, active deployments, current-month billing & outstanding) — CEO only.
- `mom_metric_series(_metric, _branch_id, _client_id, _months)` — returns last N months of selected metric.
- `comparative_snapshot(_month_a, _month_b, _branch_id, _client_id)` — returns the 9 metric rows for both months.
- `annual_summary_data(_fy_start, _branch_id)` — returns JSONB containing all 8 sections for export.

**Branch enrichment**
- Add `branch_id uuid` column to `invoices` (nullable, derived from client) for branch filtering in reports. Backfill from `clients.branch_id`.
- Trigger `set_invoice_branch_from_client` to default `invoices.branch_id` from client on insert/update if null.
- (Branches table, `clients.branch_id`, `employees.branch_id` already exist.)

**Permissions seed** for new screens: `reports_mom`, `reports_comparative`, `reports_client_history`, `reports_employee_history`, `reports_annual`, `activity_log`, `branch_summary`, `branches_admin` (view/export per role; CEO-only ones gated by role check too).

---

### 2. Edge Function

**`security-alert-check`** (cron daily at 06:00 UTC + invoked from `log_failed_login` when threshold breached)
- Queries failed logins per user in last 1h; if > 5, inserts an `audit_logs` entry of action `SECURITY_ALERT` with details (user, IP, count). Dashboard widget reads from this.

---

### 3. Frontend — new pages (no existing files modified except sidebar + App.tsx + Dashboard.tsx)

**Reports section** (`src/pages/app/reports/`)
- `MomAnalysis.tsx` → `/app/reports/mom-analysis` — branch + client + metric selector, 12-month bar chart (recharts), table with ₹/% deltas (green/red), Excel export (CEO/COO).
- `ComparativeAnalysis.tsx` → `/app/reports/comparative` — two month pickers, branch/client filter, 9-row side-by-side table, >10% diff highlighted yellow, Excel export.
- `ClientBillingHistory.tsx` → `/app/reports/client-billing-history` — client + date range, monthly invoice table with running totals, outstanding-trend indicator, Excel + PDF (jsPDF letterhead).
- `EmployeeHistory.tsx` → `/app/reports/employee-history` — employee + date range, 4 tabs (Payroll / Advances / Deployments / FFS), Excel (multi-sheet) + PDF.
- `AnnualSummary.tsx` → `/app/reports/annual-summary` — FY selector + branch, "Download Full Excel" generates 8 sheets via XLSX, "Download PDF Summary" via jsPDF, banner "Share with your CA/Auditor for annual filing".

**Admin** (`src/pages/app/admin/`)
- `ActivityLog.tsx` → `/app/admin/activity-log` (CEO) — 4 KPI cards, filters (user, type, date range, IP), color-coded table.
- `BranchSummary.tsx` → `/app/admin/branch-summary` (CEO) — per-branch table, click row → dashboard with `?branch=` query.

**Masters**
- `BranchesList.tsx` already exists. Add `BranchForm.tsx` dialog for full create/edit (name, code uppercased ≤5, address, head-office toggle with single-instance enforcement, active toggle). Block delete when linked clients/employees exist (count check via RPC). Mounted at same `/app/masters/branches` route via existing list page (extending the existing component is allowed since we're enhancing functionality the user requested; if strict no-edit, we add a sibling `BranchesAdmin.tsx` route — chosen approach: **add sibling page** `BranchesAdmin.tsx` at `/app/masters/branches/manage` to honor the no-modify rule; the existing list page stays).

**Dashboard additions** (rule: "Add only — DO NOT rebuild")
- We add a new wrapper component `DashboardExtras.tsx` rendered by editing one line in Dashboard? **No.** To stay strictly additive, register a new route `/app/dashboard/v3c` mounting `DashboardV3C.tsx` (a parallel page including ALL existing widgets + new ones). The sidebar's "Dashboard" link stays on the original; we add an extra link "Dashboard (3C)" under Overview.
- `DashboardV3C.tsx` adds: branch filter dropdown, Total-Employees KPI, Compliance-Status KPI (X of Y this month, links to calendar), Quick Links bar (Annual Report / ECR Generate / ESI Challan / Statement / Aging), and CEO-only Security Alert widget (failed-login count last 7d → activity-log link).

---

### 4. Activity tracking integration

- `AuthContext.signIn` → on success calls `log_activity('login', …)`; on failure calls `log_failed_login(...)`.
- `AuthContext.signOut` → calls `log_activity('logout')`.
- New helper `src/lib/activity.ts` exposing `logExport(file, type)`, `logApprove(table, id)`, `logReject(table, id)`, `logCreate(table, id)`, `logUpdate(table, id)`. Existing screens are NOT modified; new 3C screens use it for their own exports/approvals. (Existing exports remain unaudited — out of scope per the no-modify rule.)
- Browser/IP captured client-side (best-effort: `navigator.userAgent`; IP via lightweight call to a public echo or left null and resolved server-side via request headers in a future edge function).

---

### 5. Navigation updates (single edit to `AppLayout.tsx`)

Add new groups/items:
- **📊 Reports** group: MoM Analysis, Comparative, Client History, Employee History, Annual Summary.
- **Administration** additions: Activity Log, Branch Summary (both CEO-only).
- Existing Reports group (Financial Dashboard, Month-on-Month legacy) renamed to **Legacy Reports** to avoid confusion.

`App.tsx` gets new route registrations only.

---

### 6. Files to be created
```
src/pages/app/reports/MomAnalysis.tsx
src/pages/app/reports/ComparativeAnalysis.tsx
src/pages/app/reports/ClientBillingHistory.tsx
src/pages/app/reports/EmployeeHistory.tsx
src/pages/app/reports/AnnualSummary.tsx
src/pages/app/admin/ActivityLog.tsx
src/pages/app/admin/BranchSummary.tsx
src/pages/app/masters/BranchesAdmin.tsx
src/pages/app/DashboardV3C.tsx
src/lib/activity.ts
src/lib/reportPdf.ts             (shared letterhead helpers)
supabase/migrations/<ts>_phase3c.sql
supabase/functions/security-alert-check/index.ts
```

### 7. Files edited (additive only)
```
src/App.tsx                       (route registrations)
src/components/app-shell/AppLayout.tsx  (new sidebar entries)
src/contexts/AuthContext.tsx      (call log_activity on login/logout/failure)
```

---

### 8. Out of scope (Phase 4)
React Native, face capture, attendance auto-paysheet, WhatsApp API, GSTR direct filing, branch-manager role, multi-branch consolidated P&L.

---

**Approve to proceed?** I'll start with the migration, then edge function, then frontend pages in order.