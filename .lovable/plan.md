
# Phase 2 Build Plan — Trinetra Internal Portal

This is a large additive build on top of the existing Phase 1 app. Phase 1 routes, layouts, and components remain untouched except for the explicit retrofits listed below.

Because of size, I will deliver this in **6 sequenced milestones**. Each milestone ends in a working, deployable state. After this plan is approved, I will start at Milestone 1 and continue straight through unless you stop me.

---

## Milestone 1 — Database foundation & retrofits

All schema changes done as Supabase migrations. RLS enabled on every new table with explicit policies (default DENY).

### New enums / helper functions
- `paysheet_status`: draft | submitted | approved | rejected
- `invoice_status`: draft | sent | partially_paid | paid | overdue
- `entry_type`: receipt | payment | journal | contra
- `voucher_category`: client_billing | payment_received | epf_payment | esi_payment | gst_payment | pt_payment | staff_salary | salary_advance | advance_recovery | admin_expense | vehicle_expense | other_income | other_expense
- `client_type_enum`: individual_huf | company_firm
- `gen_invoice_number(client_id, sandbox)` — atomic FY+prefix sequence
- `gen_paysheet_number(month_date, sandbox)` — `PS-MMMYYYY-NNN` / `TEST-PS-…`
- `gen_receipt_number(date, sandbox)` — `REC-MMMYYYY-NNN`
- `gen_voucher_number(date)` — `VCH-YYYYMMDD-NNN`
- `amount_in_words_inr(numeric)` — Indian-format words
- `current_environment()` — reads `app_config` and returns `sandbox` / `production`
- `calc_paysheet_employee(row)` — server-side PF/ESI/PT/net wage math
- Triggers for: paysheet totals roll-up, invoice calcs, payment → invoice/ledger update, audit logging.

### New table: `app_config`
- Columns per spec.
- Seed row: `('environment','sandbox')`.
- RLS: SELECT for all active users; INSERT/UPDATE only `ceo_admin`.
- Trigger on UPDATE → audit_logs + insert notification rows for all users.

### Phase 1 retrofits (additive columns only)
- `clients`: `client_type`, `tds_rate`, `gst_rcm`, `invoice_prefix`, `pt_applicable`, `e_invoice_applicable`, `is_sandbox` (default true), `is_deleted`, `deleted_at`. Backfill existing rows: `is_sandbox=true`, `client_type='company_firm'`, `tds_rate=tds_percentage`.
- `employees`: `is_sandbox`, `is_deleted`, `deleted_at`. Backfill `true/false`.
- `notifications`: `is_sandbox`. Backfill `true`.
- `company_profile`: `pf_code`, `esi_code`, `bank_account_number`, `bank_ifsc`, `bank_name`, `iso_certification` (default `ISO:9001:2015`), `invoice_location_code` (default `NLR`), `jurisdiction` (default `Subject to Nellore Jurisdiction`). Update default email to `admin@tpsssecurity.com`.

### New tables (RLS + soft-delete + audit triggers on each)
- `client_wage_config` (replaces use of `client_mw_rates` going forward). `client_mw_rates` is **kept** for backward compatibility but marked deprecated; ClientForm UI will write to `client_wage_config`.
- `client_billing_lines`
- `invoice_deduction_templates`
- `paysheets`
- `paysheet_employees`
- `invoices`
- `payments`
- `financial_ledger`

### RLS pattern
- SELECT: `is_active_user(auth.uid())` AND `is_deleted = false` AND `is_sandbox = (current_environment()='sandbox')`.
- INSERT/UPDATE: per Section S3 separation of duties.
  - Paysheet status transitions enforced by a `BEFORE UPDATE` trigger that:
    - Rejects accountants setting `status='approved'`.
    - Rejects same-user approval (`approved_by = submitted_by`).
    - Locks `submitted` rows from accountant edits.
- DELETE: blocked except hard-delete by `ceo_admin` on rows where `is_sandbox=true` (sandbox wipe RPC).

### Validation / integrity constraints
- CHECK: `amount > 0` on payments, `gst_percentage BETWEEN 0 AND 100`, etc.
- Trigger on paysheet save: recompute every employee row, reject if client-supplied total differs from server-computed by > ₹1.
- `audit_logs`: keep INSERT-only policy (already true); explicitly deny UPDATE/DELETE.

---

## Milestone 2 — Environment system & retrofit UI

### `useEnvironment()` hook
- Loads `app_config` `environment` row.
- Subscribes via Supabase realtime channel on `app_config` for instant updates.
- Auto-refresh every 5 minutes.
- Exposes `{ environment, isSandbox, loading, refresh }`.
- All Phase 2 list/detail queries use `.eq('is_sandbox', isSandbox)`.

### Visual indicators (added to existing AppLayout — minimal change)
- Yellow banner injected just below the existing `<header>` of `AppLayout` when sandbox.
- Sidebar footer pill (`🟡 SANDBOX` / `🟢 PRODUCTION`) added at the bottom of the existing `Sidebar`.
- A `<EnvSavedLabel/>` helper produces `"Save to Sandbox"` vs `"Save"`.

### Company Profile screen (retrofit additions)
- New "Statutory & Bank" section: PF code, ESI code, bank account/IFSC/name, ISO cert, invoice location code, jurisdiction.
- New "Environment" card (CEO only):
  - Current mode badge.
  - Switch with two confirm dialogs (sandbox→prod, prod→sandbox) per spec.
  - On change: update `app_config`, log audit, fan-out notification to all active users.
  - "Wipe Sandbox" button (visible only in sandbox + CEO):
    - Two-step modal, second step requires typing `DELETE`.
    - Calls a `wipe_sandbox()` SECURITY DEFINER RPC that hard-deletes `is_sandbox=true` rows across all Phase 2 tables and resets sequences.

### Client Form retrofit
- Add fields: client_type (auto-sets tds_rate), tds_rate override, gst_rcm switch (only when gst_applicable), invoice_prefix, pt_applicable, e_invoice_applicable.
- Replace "Minimum Wage Rates" inline editor with new **Wage Config** section that writes to `client_wage_config` with versioning logic (close out previous `is_current=true` rows on new save).
- Add **Billing Lines** section managing `client_billing_lines` (rows with description, sac_code with suggestion list, rate_per_month, unit_label, sort_order, is_active).
- Add **Deduction Template** section editing `invoice_deduction_templates.template_rows` (toggle/label/default/source).
- All saves go through `is_sandbox = currentEnv`.

---

## Milestone 3 — Payroll module

Routes (added to `App.tsx`, rendered inside the existing protected `AppLayout`):
- `/app/payroll/create` — 3-step wizard (Setup → Grid → Summary)
- `/app/payroll/list`
- `/app/payroll/approvals` (CEO + COO)
- `/app/payroll/:id/view`

### Create Paysheet wizard
- **Step 1**: client dropdown (active, env-filtered), month/year, working days auto-calc (editable). On client+month change, query existing paysheet → warn.
- **Step 2**: editable spreadsheet grid using a virtualized table.
  - Auto-load active employees for client.
  - Auto-fill wages from latest `client_wage_config` (`is_current=true`) per designation.
  - Live client-side preview of earned_wages / PF / ESI on duty change.
  - Anomaly engine (`computeAnomalies(emp)`) producing flags with severity 🔴🟡🔵; aggregated count shown above grid.
  - Pinned totals row.
  - Add ad-hoc rows (badge "Not in master").
- **Step 3**: KPI cards + actions: Save Draft, Revert, Submit for Approval (locks editing).
- Save flow:
  - `paysheets` upserted, then `paysheet_employees` rows inserted in a single RPC `save_paysheet(payload)` that runs server-side calc and totals roll-up.
  - Server rejects if accountant tries to set `status='approved'`.

### Paysheet list
- Filterable table, status pills, action buttons (View, Edit if draft, PDF, Excel CEO/COO, Generate Invoice if approved).

### Approval queue (CEO/COO)
- Submitted paysheets → click → read-only grid replica.
- Approve: calls `approve_paysheet(id)` RPC, server checks `submitted_by != auth.uid()`. Notifies accountant.
- Reject: modal with rejection_reason (10–200 chars, live counter). Notifies accountant with reason.

### View paysheet
- Read-only formatted view.
- Buttons: Download PDF (all roles), Download Excel (CEO/COO), Generate Invoice (jumps to `/app/invoices/new?paysheet=:id`).

### PDF/Excel
- PDF via `pdf-lib` (or `@react-pdf/renderer`) generated client-side from the same data.
- Excel via `xlsx` library, gated behind a server-side role check before download.

---

## Milestone 4 — Invoices, payments, receipts

Routes:
- `/app/invoices/list`
- `/app/invoices/new` and `/app/invoices/:id/edit` (draft only)
- `/app/invoices/:id/view`
- `/app/finance/receipts` and `/app/finance/receipts/:id`

### Invoice form
- Layout exactly matches the specified header / client / details / billing / GST / footer / deductions / summary blocks.
- Loads billing lines from `client_billing_lines`; rows editable; "+ Add Row".
- GST block conditional on `gst_applicable` and `gst_rcm` per spec (RCM shows note, no GST added to total).
- Deductions section (collapsible, internal-only) populated from `invoice_deduction_templates`; auto-rows pre-filled from linked paysheet (net salary, PF employer, ESI employer); manual rows editable; "Save as default template for client" button.
- Summary panel (internal): Receivable / Deductions / Net Margin / Received / Outstanding.
- All numeric calcs computed server-side via `save_invoice(payload)` RPC; client-side numbers are preview only.
- Buttons: Save Draft, Preview PDF, Mark as Sent, Download PDF.

### Invoice number generation
- Done server-side in `gen_invoice_number(client_id, sandbox)`:
  - Reads prefix from `client.invoice_prefix` || `company_profile.invoice_location_code`.
  - FY computed from invoice_date.
  - Sequential per (prefix, FY, sandbox) using a per-key advisory lock.
  - Sandbox wraps entire string with `TEST-` prefix.

### PDF generation
- Two PDF templates rendered with `@react-pdf/renderer`:
  - **Client invoice PDF**: header/client/details/billing/GST/footer only.
  - **Internal invoice view**: same + deductions + margin section.
- Amount in words pulled from server-stored `amount_in_words` field.

### Payment modal (invoice view)
- Receipt number generated server-side.
- Amount validated `≤ outstanding_amount` server-side.
- Insert `payments` row → trigger updates invoice (`amount_received`, `outstanding_amount`, `status`), inserts `financial_ledger` CREDIT row, writes audit + notifications to CEO/COO.

### Receipts
- List page with filters.
- Receipt view with the exact PDF layout in the spec; Download/Print buttons.

---

## Milestone 5 — Cash Book, Monthly Summary, Dashboard, Notifications

### Cash book — `/app/finance/cashbook`
- Summary cards (Credits / Debits / Net).
- Filter row: date range, entry_type, category, client.
- Table sorted by date with **running balance recomputed in SQL view** based on filters.
- Manual entry dialog (CEO/COO only) → inserts ledger row + audit.
- Excel export (CEO/COO).

### Monthly Summary — `/app/finance/summary`
- Month picker.
- Income / Expense / Net P&L sections from aggregated ledger.
- "CA-ready Excel" export (CEO/COO).

### Dashboard additions (additive only — keep existing KPIs)
- New KPI cards: Invoices This Month (count + ₹), Total Outstanding, Receipts This Month.
- Outstanding-by-client list (red row if > ₹1,00,000).
- 6-month "Invoiced vs Received" bar chart using existing recharts.
- Pending Approvals card (CEO/COO) → links to `/app/payroll/approvals`.
- All queries `is_sandbox`-filtered.

### Notifications
- Edge function `notify` (or DB triggers) emits the 6 notification types defined in Section 10.
- Environment-switch notification fans out to all active users in one INSERT.
- Daily overdue check via a scheduled Supabase cron edge function `check-overdue-invoices`.

---

## Milestone 6 — Navigation, security hardening, QA

### Sidebar updates (additive in `AppLayout.tsx`)
- Under existing **Payroll** group: rename "Upload Paysheet" → keep + add **Create Paysheet**, **Monthly Paysheets**, **Approval Queue** (with badge count from a small subscription).
- New **Invoices** group: All Invoices, Create Invoice.
- New **Finance** group: Cash Book, Monthly Summary, Receipts.
- Footer pill (sandbox/production) added once at sidebar bottom.

### Security hardening (S1–S12)
- Confirm RLS coverage with `supabase--linter`.
- `ProtectedRoute` already does session + role checks; add `is_active_user` server verification on every page load via a cheap `current_environment()` RPC.
- Strip any financial data from `localStorage` (audit existing code; only auth tokens may persist).
- HTTPS enforcement (S12):
  - Add `index.html` `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">`.
  - Document HSTS / CSP requirement for the hosting layer (Lovable hosts with HTTPS by default; `upgrade-insecure-requests` will block any mixed content).
  - Runtime guard in `client.ts` consumer: throw if `VITE_SUPABASE_URL` doesn't start with `https://`.
- Bulk export endpoints check role server-side via an edge function before signing the file URL.

### Final QA pass
- Smoke test each role (accountant / coo_ops / ceo_admin) through:
  - Sandbox switch
  - Create paysheet → submit → approve → generate invoice → record payment → receipt
  - Cash book reflects entries
  - All audit_log rows present
- Run security scan and mark this finding set fixed.

---

## Technical notes

- **Libraries to add**: `@react-pdf/renderer` (PDF), `xlsx` (Excel export), `recharts` is already present.
- **Heavy grid**: built with native HTML table + sticky header/footer + virtualization only if >200 rows (rare for monthly paysheets).
- **State**: continue using `@tanstack/react-query` for server state; introduce one `EnvironmentProvider` context wrapping the app inside `AuthProvider`.
- **No edits** to: `src/integrations/supabase/client.ts`, `types.ts`, `.env`, `supabase/config.toml` project-level keys, existing public marketing site, `Index.tsx`, header/hero/etc. components, current `Login`, `ProtectedRoute` (only minor addition if needed), or any existing Phase 1 master forms beyond the explicit retrofits.

---

## Deliverable checkpoints

1. Migration files compile and apply cleanly; `useEnvironment` returns sandbox.
2. Environment toggle + sandbox banner visible; Company Profile shows new fields.
3. Client Form has new fields + wage_config + billing_lines + deduction_template.
4. Paysheet end-to-end working with approval workflow + PDF.
5. Invoice + payment + receipt + ledger triggers verified.
6. Dashboard, cash book, navigation updates, security scan clean.

After approval I will begin with Milestone 1 (database foundation). Please confirm to proceed, or tell me which milestones to drop / re-order.
