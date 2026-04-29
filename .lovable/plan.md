## Phase 2 Completion Plan — Sequential Build

I'll finish the remaining Phase 2 work across 4 milestones, in order. Each milestone leaves the app in a working, deployable state.

---

### Milestone A — Finish Milestone 2 (Environment & Retrofits)

**Company Profile screen** (`src/pages/app/masters/CompanyProfile.tsx`)
- Add "Statutory & Bank" section: PF code, ESI code, bank account / IFSC / name, ISO certification, invoice location code, jurisdiction.
- Add CEO-only "Environment" card:
  - Current mode badge (sandbox / production).
  - Toggle with two-step confirm dialogs (sandbox→prod, prod→sandbox) — calls `EnvironmentContext.setEnvironment()`.
  - "Wipe Sandbox" button (sandbox + CEO only): two-step modal, second step requires typing `DELETE`, calls `wipe_sandbox()` RPC.

**Client Form** (`src/pages/app/masters/ClientForm.tsx`)
- Add fields: `client_type` (auto-sets `tds_rate` to 2% individual_huf / 1% company_firm with manual override), `gst_rcm` (only when `gst_applicable`), `invoice_prefix`, `pt_applicable`, `e_invoice_applicable`.
- Replace MW Rates inline editor with **Wage Config** section writing to `client_wage_config` (versioning handled server-side by `version_wage_config` trigger).
- Add **Billing Lines** section managing `client_billing_lines` rows (description, sac_code, rate_per_month, unit_label, sort_order, is_active).
- Add **Deduction Template** section editing `invoice_deduction_templates.template_rows`.

**Sidebar** (`src/components/app-shell/AppLayout.tsx`)
- Add Payroll group items (Create Paysheet, Monthly Paysheets, Approval Queue with badge).
- Add Invoices group (All Invoices, Create Invoice).
- Add Finance group (Cash Book, Monthly Summary, Receipts).

---

### Milestone B — Payroll module (Milestone 3)

**Migration**: `save_paysheet(payload jsonb)` and `approve_paysheet(id uuid)` SECURITY DEFINER RPCs that compute server-side wages, PF, ESI, PT, net salary; reject same-user approval; enforce role-based status transitions.

**Pages**
- `PaysheetCreate.tsx` — 3-step wizard:
  - Step 1 Setup: client (env-filtered), month/year, working days, existing-paysheet warning.
  - Step 2 Grid: virtualized editable table; auto-load active employees for client; auto-fill from current `client_wage_config` per designation; live PF/ESI preview; anomaly engine (`computeAnomalies` in `src/lib/calc.ts`) producing 🔴🟡🔵 flags; pinned totals row; add ad-hoc rows.
  - Step 3 Summary: KPI cards + Save Draft / Revert / Submit for Approval.
- `PaysheetList.tsx` — filters, status pills, action buttons (View, Edit if draft, PDF, Excel CEO/COO, Generate Invoice if approved).
- `PaysheetApprovals.tsx` (CEO/COO) — submitted queue, read-only grid, Approve / Reject (rejection_reason 10–200 chars with live counter).
- `PaysheetView.tsx` — read-only formatted view + Download PDF + Download Excel (CEO/COO) + Generate Invoice link.

**PDF / Excel** — install `@react-pdf/renderer` and `xlsx`. Client-side PDF; Excel download gated by role check before generation.

---

### Milestone C — Invoices, payments, receipts (Milestone 4)

**Pages**
- `InvoiceForm.tsx` — header / client / details / billing / GST / footer / deductions / summary blocks. Loads billing lines from `client_billing_lines`. Conditional GST / RCM display. Collapsible internal deductions section pre-filled from linked paysheet (net salary, PF employer, ESI employer); manual rows; "Save as default template for client" button. Internal summary panel (Receivable / Deductions / Net Margin / Received / Outstanding). Buttons: Save Draft, Preview PDF, Mark as Sent, Download PDF.
  - Server-side calcs already exist (`calc_invoice_fields` trigger + `gen_invoice_number`).
- `InvoiceView.tsx` — read-only invoice with internal margin section (CEO/COO) and Payment modal (server validates `amount ≤ outstanding`; `after_payment_insert` trigger handles ledger + status).
- `InvoicesList.tsx` — filterable list, status pills.
- `ReceiptsList.tsx` + `ReceiptView.tsx` — list with filters; receipt page with spec layout, Download / Print.

**PDF templates** — Two `@react-pdf/renderer` templates: client invoice + internal view with deductions/margin. Receipt PDF.

---

### Milestone D — Cash Book, Summary, Dashboard polish, Notifications, Hardening (Milestones 5 + 6)

**Cash Book** (`CashBook.tsx`)
- Summary cards (Credits / Debits / Net).
- Filters: date range, entry_type, category, client.
- Table sorted by date with running balance from a SQL view `v_cashbook_running_balance`.
- Manual entry dialog (CEO/COO) → inserts ledger row + audit.
- Excel export (CEO/COO).

**Monthly Summary** (`MonthlySummary.tsx`)
- Month picker; Income / Expense / Net P&L from aggregated ledger.
- "CA-ready Excel" export.

**Dashboard additions** (`src/pages/app/Dashboard.tsx`)
- New KPI cards: Invoices This Month (count + ₹), Total Outstanding, Receipts This Month.
- Outstanding-by-client list (red row if > ₹1,00,000).
- 6-month "Invoiced vs Received" bar chart (recharts).
- Pending Approvals card (CEO/COO) → links to `/app/payroll/approvals`.
- All queries `is_sandbox`-filtered.

**Notifications**
- DB triggers / edge function emitting the 6 notification types from the spec (paysheet submitted/approved/rejected, payment received, invoice overdue, env switch — last one is already done).
- Daily overdue check via scheduled edge function `check-overdue-invoices`.

**Security hardening (S1–S12)**
- Run `supabase--linter`; resolve any issues.
- Add `<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">` to `index.html`.
- Strip any financial data from `localStorage`.
- Edge function for bulk export endpoints with server-side role check.

**Final QA pass** — Smoke test each role (accountant / coo_ops / ceo_admin) end-to-end: env switch → create paysheet → submit → approve → generate invoice → record payment → receipt → cash book → audit logs.

---

### Sequencing & deliverable checkpoints

```text
A. Env + retrofits          → Company Profile + Client Form ready
B. Payroll                  → Full paysheet lifecycle + PDFs
C. Invoices/payments        → Invoice → payment → receipt → ledger
D. Cash book + dashboard    → Reporting + notifications + hardening
```

I will proceed straight through A → B → C → D unless you stop me. After each milestone I'll briefly summarize what shipped before moving to the next.
