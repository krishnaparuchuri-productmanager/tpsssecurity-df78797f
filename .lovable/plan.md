## Phase 2 Gap Fix — Financial Dashboard & Month-on-Month Analysis

Both screens are wired in the sidebar and `App.tsx` but currently render `<Placeholder />`. This plan replaces only those two stubs. No existing tables, RPCs, components, or routes are modified.

---

### Scope

**In scope**
1. `/app/reports/financial` → real **Financial Dashboard** page
2. `/app/reports/mom` → real **Month-on-Month Analysis** page
3. Two tiny additions to `App.tsx` (swap `<Placeholder />` for the new components — imports only)

**Out of scope** (untouched)
- All existing Phase 1, 2, 3A files
- DB schema, RPCs, RLS, edge functions, cron
- Sidebar nav (already correct)
- `MonthlySummary.tsx` (kept as-is — it serves a different, single-month CA-export use case)

---

### 1. Financial Dashboard (`src/pages/app/reports/FinancialDashboard.tsx`)

A read-only KPI + chart view for any selected **financial year** (Apr–Mar) with optional client filter.

**Filters**
- FY selector (defaults to current FY)
- Client (optional, multi → "All clients")
- Sandbox/Live respected via `useEnvironment()` (matches existing pattern)

**KPI tiles (top row, 4 cards)**
- Total Revenue (sum `client_billing` + `payment_received` credits from `financial_ledger`)
- Total Expenses (sum of all `EXPENSE_CATS` debits — same list as `MonthlySummary`)
- Net Profit/(Loss)
- Outstanding Receivables (sum `invoices.outstanding_amount` where status ≠ paid)

**Secondary tiles (4 cards)**
- Total Invoiced (`invoices.total_invoice_value`)
- Total Collected (`payments.amount`)
- Total Payroll (`paysheets.total_net_salary` for approved sheets)
- Active Clients count

**Charts** (recharts — already used in shadcn `chart.tsx`)
- Bar chart: Income vs Expense per month for the FY
- Pie chart: Expense breakdown by category for the FY
- Line chart: Cumulative collections vs invoicing across the FY

**Data source**
- `financial_ledger` aggregated client-side (group by `entry_date` month + `category`)
- `invoices` for receivables
- `payments` for collections
- `paysheets` for payroll
- All queries use `is_sandbox = current env`, `is_deleted = false`

**Permissions**
- Visible per existing `reports` permission (already in nav `screen: "reports"`)
- No writes — pure SELECT

---

### 2. Month-on-Month Analysis (`src/pages/app/reports/MomReport.tsx`)

Comparative table + trend view across a configurable range of months.

**Filters**
- "From month" / "To month" pickers (defaults: last 12 months ending current month)
- Metric toggle group: Revenue / Expense / Net / Payroll / Collections / Invoicing
- Client filter (optional)

**Output**
- Wide table: rows = categories (income cats, expense cats, totals), columns = each month in range, last column = total + % change month-over-month vs previous column
- Trend chart above the table: line chart of selected metric across months
- "Top movers" panel: 3 categories with largest MoM % change in the latest month
- Excel export button using `xlsx` (already in deps via `MonthlySummary`) — exports the table verbatim

**Data source**
- Single query against `financial_ledger` for the range, grouped client-side by `(category, month)`
- For Payroll metric: query `paysheets` grouped by `month_date`
- For Collections metric: query `payments` grouped by `payment_date` month

**No new DB objects.** Everything is computable from existing tables.

---

### 3. App.tsx wiring (2-line change)

Replace the two existing `Placeholder` route elements with the new components. Add two imports. Nothing else in the routes block changes.

```text
- <Route path="reports/financial" element={<Placeholder title="Financial Dashboard" />} />
- <Route path="reports/mom"       element={<Placeholder title="Month-on-Month Analysis" />} />
+ <Route path="reports/financial" element={<FinancialDashboard />} />
+ <Route path="reports/mom"       element={<MomReport />} />
```

---

### Technical notes

- Both pages are pure SELECT — they inherit existing RLS (`is_active_user` + `is_deleted=false`) and the `reports` permission gate from the sidebar/route guards already in place.
- Reuse `formatINR` from `src/lib/format.ts` and the shadcn `Card` / `Chart` primitives — no new design tokens.
- FY math: a date `d` belongs to FY starting `Apr year(d)` if `month(d) >= 4`, else `Apr year(d)-1`.
- Default ranges chosen to keep first paint fast (≤12 months of ledger rows ≈ small).
- No new env vars, secrets, edge functions, or cron jobs.
- After this gap fix, Phase 2 is fully complete and Phase 3B/3C work (Expenses, SoA/Aging, Compliance, Backup, Activity log, Annual CA export) can proceed cleanly.

---

### Files

**New**
- `src/pages/app/reports/FinancialDashboard.tsx`
- `src/pages/app/reports/MomReport.tsx`

**Edited (minimal)**
- `src/App.tsx` — swap 2 placeholders + 2 imports

Approve this and I'll implement both screens in one pass.