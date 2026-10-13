# Documentation Findings

> Raised while documenting the TPSS portal (12–13 Oct 2026) in the **sandbox**.
> Severity: **Critical** = a core workflow cannot be completed or produces wrong money figures · **High** = wrong or misleading results · **Medium** = workaround exists · **Low** = cosmetic / usability.
> Status: **Fixed** (owner-approved change, live in sandbox and production) · **Open** · **Not changed** (owner decision or owner action).
> **Update 13 Oct 2026 (manual v1.1):** the open findings in section B were worked through. See **section C** for the status and commit of each, and **section D** for findings raised while fixing them.

## Summary (as of manual v1.1)

| Status | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| Fixed during documentation (A, FX-) | 6 | 4 | 3 | 0 | 13 |
| Open findings now fixed (B → C) | 0 | 8 | 11 | 12 | 31 |
| Open findings not changed (B → C) | 0 | 1 | 2 | 1 | 4 |
| New findings fixed (D) | 0 | 3 | 3 | 10 | 16 |
| New findings open (D) | 0 | 0 | 0 | 0 | 0 |

---

## A. Fixed during documentation

| ID | Severity | Module | Category | Problem (observed) | Fix | Commit |
|---|---|---|---|---|---|---|
| FX-01 | High | Administration | Permission concern | No separation between business head (CEO) and system administration | New **Super Admin** role; user mgmt, permissions, audit/activity logs, backups, environment and cancel/re-create moved to it | `72c9af3` |
| FX-02 | Medium | Users | UI/code mismatch | Failed invite showed "Edge Function returned a non-2xx status code" | Real reason shown ("already exists", "session expired") | `3e5a618` |
| FX-03 | Medium | Several forms | Broken workflow | Add User, Record Payment, New Contract, New Deployment, Relieve and Add Shift kept the previous entry's values | Forms start blank on open | `17d55e4` |
| FX-04 | Critical | Clients / Employees | Broken workflow | Creating a client failed: *duplicate key value violates unique constraint "clients_client_code_key"* (code counter behind imported codes); employees had the same defect | Code generator skips used codes and continues after the highest | `3af0d82` |
| FX-05 | Critical | Bank Payment | Broken workflow | "Finalise & Generate Excel" always failed (*row-level security policy*); the bank Excel was produced **before** the failed save (double-payment risk); finalising could never mark employees paid | Batch, lines and paid status saved in one server step; Excel only after success | `1e2d101` |
| FX-06 | Critical | Bank Disbursement | Broken workflow | Required an invoice status "approved" that does not exist; report could never run | Any issued invoice (Sent or later) qualifies | `4f65d64` |
| FX-07 | Critical | ECR / ESI | Broken workflow | Generator searched by month format "2026-09"; app paysheets store "SEP-2026"; nothing was ever found; also ignored approval status | Search by month date; approved paysheets only | `4f65d64` |
| FX-08 | High | Invoices | Calculation | Invoice from a paysheet: internal deductions stayed ₹0 (name mismatch + load order) | Deductions fill from the paysheet | `4f65d64` |
| FX-09 | Critical | Invoices / Receipts | Calculation | Outstanding and *Paid* measured against **net margin** (after internal salary/PF/ESI deductions). A ₹82,600 invoice showed ₹3,156.67 still due after ₹30,000 received; the real ₹51,900 balance could not be recorded | Outstanding = receivable − received; Paid at full receivable; existing invoices recalculated | `a91e4ed` |
| FX-10 | High | Invoices | Broken workflow | Edit screen replaced saved lines with client defaults (₹82,600 → ₹56,640); also affected Re-create | Saved lines/taxes/deductions kept | `a91e4ed` |
| FX-11 | Medium | Invoices | Broken workflow | Draft invoices could not be reopened from the UI | Edit button for drafts (list + view) | `a91e4ed` |
| FX-12 | High | GST, Monthly Summary, Expenses, Compliance, MoM | Calculation | Month ranges built in UTC: in India, records dated the **last day of a month** were excluded and the previous month's last day included (affected GSTR-1 export) | Local-time date ranges | `dcb0f3d` |
| FX-13 | Critical | Expenses | Broken workflow | Every expense approval failed: *invalid input value for enum ledger_entry_type: "debit"* | Posts as "payment" | `171a7d8` |

---

## B. Open findings

### High

| ID | Module | Category | Reproduction | Expected | Observed | Evidence | Doc impact | Next action |
|---|---|---|---|---|---|---|---|---|
| OF-01 | Administration | Security | User Management → change own role / deactivate self while the only Super Admin | Block self-demotion of last admin | Allowed; locks everyone out of administration | `Users.tsx`, RLS on `user_roles` | Warning in ch. 8 | Add server-side guard |
| OF-02 | Auth | Security | Sign out in one browser; use another tab | Other tab redirected to sign-in | Sign-out is global; other tabs look signed in until an action fails ("session expired") | `AuthContext.signOut()` default scope | Troubleshooting entry | Use `scope:'local'` or detect revoked session |
| OF-03 | Environment | Demo/production risk | Run `npm run dev` with repo `.env` | Local runs use sandbox | `.env` points to **production** while UI labels localhost "Sandbox" | `.env`, `EnvironmentContext.tsx` | Admin appendix | Point `.env` at sandbox or remove |
| OF-04 | Finance | Missing auditability | Issue invoice; pay salaries via Bank Payment; open Cash Book | Ledger shows billing and salary payments | Only receipts, approved expenses and compliance payments post to the ledger | `financial_ledger` rows | Cash Book chapter explains scope | Post salary batches (and optionally invoices) to ledger |
| OF-05 | Receipts | Broken workflow | Try to correct or reverse a receipt; try to cancel a paid invoice | Reversal path | No edit/reverse; cancel says "Reverse all receipts first" — dead end | corrections/07 screenshot | Corrections chapter states limitation | Add receipt reversal |
| OF-06 | Statement of Account | Calculation | Client with TDS; view statement | Balance = receivable − received | Debits use full invoice value; TDS never offset → closing ₹83,300 vs ₹81,900 owed | finance/05 screenshot | Note in reports chapter | Debit receivable or add TDS credit line |
| OF-07 | ECR | Calculation uncertainty | Generate ECR for an employee with 26/30 duties | NCP days = 4; EPF ER diff 3.67 %; gross = earned | NCP = 0 always; ER diff = 13 % − 8.33 % (₹700 vs ≈₹551); gross includes uniform | ECR_2026-09.txt | Statutory chapter warns to verify | Confirm rules with owner |
| OF-08 | ESI challan | Calculation uncertainty | Same | "No of Days" = duties | 30 for every employee; header rows above column titles (portal upload not verified) | ESI_Challan_2026-09.xlsx | Statutory chapter | Use duties; verify ESIC template |
| OF-09 | Employees | UI/code mismatch | New employee → select client + designation | Salary auto-fills ("auto-fills from client MW rates") | Nothing fills; reads empty legacy table `client_mw_rates` | `EmployeeForm.tsx:115` | Employee chapter: enter manually | Read `client_wage_config` |

### Medium

| ID | Module | Category | Observed | Next action |
|---|---|---|---|---|
| OF-10 | Payroll | Calculation uncertainty | Pay maths runs in the browser (`calc.ts`); server `save_paysheet` unused. EPF wages = **higher** of computed base and "EPF Min Wages" (a floor); employer 13 %; ESI if earned ≤ ₹21,000; PT ≥ ₹15,000 → ₹150, ≥ ₹20,000 → ₹200. All hard-coded | Owner to confirm rules; move to server |
| OF-11 | Invoices | Missing validation | No IGST — GST always split CGST/SGST | Add place-of-supply/IGST |
| OF-12 | GST Report | Documentation ambiguity | "Export GSTR-1 + RCM" is a summary workbook (no CGST/SGST/IGST, SAC, GSTIN blank), not a portal-ready GSTR-1 | Rename or produce GSTR-1 format |
| OF-13 | Invoices | Missing validation | Record Payment offered on Draft invoices | Hide until Sent |
| OF-14 | Invoices | Enhancement | Billing-line quantity pre-fills 1 regardless of deployed headcount | Pre-fill from deployments |
| OF-15 | Bank Disbursement | Demo/production risk | CSV has no SANDBOX marker; "Payment Reference" is internal IDs | Add marker; meaningful reference |
| OF-16 | Numbering | Demo/production risk | Expense numbers (EXP-…) and receipts-ledger vouchers have no TEST- prefix in sandbox | Prefix in sandbox |
| OF-17 | Paysheet list | Usability | Submit uses a browser confirm() even when the only flag is informational (new joiner) | Confirm only for red/yellow flags |
| OF-18 | Approval Queue | Usability | Approve/Reject are unlabelled icons (an approve was clicked by mistake during testing) | Add labels/tooltips |
| OF-19 | Dashboard | Documentation ambiguity | Month figures follow the invoice's billing month, not cash date (Oct: Received ₹0 although ₹81,900 arrived in Oct) | Label cards clearly |
| OF-20 | TPSS Bank Accounts | Missing validation | IFSC accepted in an invalid format | Validate IFSC |
| OF-21 | Sites | Gap | `client_posts` (sites) table has no screen | Build or drop |
| OF-22 | CRM | Privacy | Website enquiries are mirrored into the sandbox CRM (real contact details in a test environment) | Mask or stop mirroring |

### Low

| ID | Module | Observed |
|---|---|---|
| OF-23 | Clients | Empty-name validation says only "Required" |
| OF-24 | Employees | Validation messages show internal field names (`full_name: …`, `uan_number: …`) |
| OF-25 | Payroll | Month labels inconsistent ("SEP-2026" vs "2026-05") |
| OF-26 | PDFs | PF statement: last column cut off; total rows white text on light grey (PF, disbursement) |
| OF-27 | Company profile | Sandbox lacks GSTIN/PAN/bank — invoices print "—" |
| OF-28 | Paysheet grid | Narrow inputs truncate Basic/DA/UAN values |
| OF-29 | Comparative | "Employee Count ₹3.00" (count formatted as money) |
| OF-30 | Audit Logs | Shows user/record IDs instead of names |
| OF-31 | Codebase | 142 TypeScript errors from stale generated DB types |
| OF-32 | Expense categories | No general "office/stationery" category; first category in list is "EPF" (mis-selection risk) |
| OF-33 | Payslips | "Generate PDF" disabled without a hint until client + month chosen |
| OF-34 | Contracts | Expiry badge colours render poorly in some states |
| OF-35 | Invoices | Save Draft from list cannot be re-issued if user doesn't notice the new Edit icon (training) |

## C. Resolution of the open findings (13 Oct 2026)

All fixes were applied to the sandbox, tested, applied to production and committed (database and UI together) to `main`, which deploys both sites.

| ID | Status | What changed | Commit |
|---|---|---|---|
| OF-01 | Fixed | Last active Super Admin cannot be demoted, deactivated or removed (server trigger + UI guard on own row) | `0e42791` |
| OF-02 | Fixed | Sign-out is local to the browser; a revoked session is detected and sent to sign-in | `0e42791` |
| OF-03 | Not changed (owner action) | **Checked in Cloudflare 13 Oct 2026:** project `tpsssecurity-production` has **no** environment variables, so the live production build reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from the **tracked `.env`**. Changing `.env` alone would point the live site at the sandbox. Project `tpss-security-sandbox` sets both variables itself (sandbox project). Safe order: (1) add the two production values as Production variables on `tpsssecurity-production`; (2) let a deployment run and confirm the bundle still uses the production project; (3) only then point `.env` at the sandbox or stop tracking it. `VITE_SUPABASE_PROJECT_ID` is not used by the app | — |
| OF-04 | Fixed | Bank Payment salary batches post a Staff Salary payment to the ledger | `ac8e7e6` |
| OF-05 | Fixed | Reverse Receipt (Super Admin, reason ≥ 10): receipt marked reversed, ledger journal, invoice recalculated, audited | `a52acea` |
| OF-06 | Fixed | Statement of Account shows a "TDS deducted by client" credit line; closing = what is owed | `a52acea` |
| OF-07 | Fixed (NCP) / Not changed (rules) | NCP days = working days − duties. ER difference and uniform-in-gross kept by owner decision | `ac8e7e6` |
| OF-08 | Fixed | ESI "No of Days" = duties; headings on row 1 | `ac8e7e6` |
| OF-09 | Fixed | Employee salary fills from the client's current wage configuration | `ca237ea` |
| OF-10 | Not changed | Owner keeps the statutory rules; documented in ch. 17.2 | — |
| OF-11 | Fixed | GST Type per client (CGST+SGST / IGST); invoice prints IGST and the client's state as place of supply; re-create keeps it | `a52acea`, `c4a1af4` |
| OF-12 | Fixed | GST report: CGST / SGST / IGST columns on screen and export, SAC, client GSTIN; "GST summary (for GSTR-1)"; issued invoices only | `a52acea`, `c4a1af4` |
| OF-13 | Fixed | No Record Payment on drafts | `c4a1af4` |
| OF-14 | Fixed (hint) | Owner chose a hint: paysheet headcount by designation shown on the invoice form; qty not auto-filled | `6052e92` |
| OF-15 | Fixed | Disbursement CSV SANDBOX marker; reference = paysheet number + employee code | `ac8e7e6` |
| OF-16 | Fixed | Sandbox expense numbers `TEST-EXP-…` | `43455d3` |
| OF-17 | Fixed | Submit confirmation only for red / yellow flags | `ac8e7e6` |
| OF-18 | Fixed | Labelled Approve / Reject buttons | `ac8e7e6` |
| OF-19 | Fixed | Dashboard cards labelled "(by billing month)" | `43455d3` |
| OF-20 | Fixed | IFSC format check on TPSS Bank Accounts | `02cdc1c` |
| OF-21 | Fixed | Sites / Posts section on the client; site picker and Site column on deployments | `0c66998` |
| OF-22 | Not changed | Owner keeps website-lead mirroring (masked in captures) | — |
| OF-23 | Fixed | "Client name is required" | `ca237ea` |
| OF-24 | Fixed | Employee messages without internal field names | `ca237ea` |
| OF-25 | Fixed | Sandbox month labels normalised | `ac8e7e6` |
| OF-26 | Fixed | PF / ESI / PT columns fit A4; dark text on total rows (verified on rendered PDFs) | `bdba41d` |
| OF-27 | Fixed (sandbox data) | Sandbox company profile filled with obviously fake GSTIN, PAN, PF / ESI codes and bank. Production profile is the owner's to fill | — |
| OF-28 | Fixed | Paysheet grid input widths | `ac8e7e6` |
| OF-29 | Fixed | Comparative shows counts as numbers | `43455d3` |
| OF-30 | Fixed | Audit Logs show user names | `0e42791` |
| OF-31 | Fixed | Types regenerated; TypeScript errors 142 → 0 | `8b1d126` |
| OF-32 | Fixed | "OFFICE & ADMIN" category; production categories seeded (were empty) | `02cdc1c` |
| OF-33 | Fixed | Payslips hint when Generate is disabled | `ac8e7e6` |
| OF-34 | Fixed | Contract expiry badges readable on hover | `02cdc1c` |
| OF-35 | Not changed | Training point, covered in ch. 20 | — |

## D. Findings raised while fixing (13 Oct 2026)

| ID | Severity | Module | Problem | Status | Commit |
|---|---|---|---|---|---|
| NF-01 | High | Clients | Every client edit **duplicated** its billing lines: the browser soft delete was rejected by RLS and the error ignored, so the next invoice loaded duplicate rows | Fixed (server function replaces lines atomically; Branch delete likewise) | `b8a815c` |
| NF-02 | High | Production DB | Production lacked four `employees` columns (a June migration was never applied), so creating or editing an employee in production would fail | Fixed (migration applied; column fingerprints of both databases now identical) | `8b1d126` |
| NF-03 | High | Production data | Production had **no expense categories**, so no expense could be recorded | Fixed (14 categories seeded, owner approved) | `02cdc1c` |
| NF-04 | Medium | Ledger | `balance_after` was the highest balance ever ± amount, not the running balance | Fixed (insert trigger + recompute) | `c4a1af4` |
| NF-05 | Medium | Reports | MoM / Comparative counted cancelled invoices and paysheets (a re-created invoice was billed twice) | Fixed | `43455d3` |
| NF-06 | Medium | Reports / Finance | Draft invoices counted in dashboard, MoM, Comparative, Annual Summary, GST report, Statement, Aging, Follow-ups and the receipt picker | Fixed (owner: issued only) | `c4a1af4`, `6052e92`, `62c8672` |
| NF-07 | Low | Receipts | After a reversal the receipt page hung on "Loading…" (RLS hides reversed receipts) | Fixed (returns to the invoice) | `a52acea` |
| NF-08 | Low | Payroll | `guard_paysheet_status` re-checked approval rules on every update of an approved paysheet | Fixed (only on transition to approved) | `c016ebf` |
| NF-09 | Low | CRM | Leads list passed wrong props to the paginator (paging showed NaN) | Fixed | `8b1d126` |
| NF-10 | Low | Invoices | IGST invoices printed the company location code as Place of Supply | Fixed | `c4a1af4` |
| NF-11 | Low | Clients | Each client save stored a new version of every wage row even when unchanged | Fixed (only new or changed rows are versioned) | `054ac6f` |
| NF-12 | Low | Cash Book | With a From date the running balance started at 0 (no opening balance) | Fixed (opening-balance row; running balance continues) | `054ac6f` |
| NF-13 | Low | Annual Summary | Queries had no `is_sandbox` filter | Fixed (all five registers filtered by environment) | `054ac6f` |
| NF-14 | Low | PDFs | Total-row amounts were left-aligned under right-aligned columns | Fixed (verified on rendered PDFs) | `054ac6f` |
| NF-15 | Low | Approval Queue | "Approve" label was gold on green (low contrast) | Fixed (white on green) | `054ac6f` |
| NF-16 | Low | CRM | Lead Activity Timeline was not in sequence (minute- / date-precision times) | Fixed (entry order, newest first) | `054ac6f` |
