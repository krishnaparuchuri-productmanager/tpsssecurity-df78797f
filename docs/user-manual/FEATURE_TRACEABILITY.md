# Feature Traceability

> For reviewers and maintainers. Maps each manual section to the implementation, the test performed in the **sandbox** (12–13 Oct 2026, role **Super Admin**), the screenshot, and verification status.
>
> **UI-verified** = exercised end-to-end in the UI with synthetic data · **UI-viewed** = screen opened/captured, action not executed · **Traced** = from code / DB only · **Fixed+verified** = defect fixed during documentation and re-tested.
> COO / Accountant behaviour: traced from code, RLS and DB role simulation (not tested in UI — no test users by owner decision).

| Manual § | Feature | UI route | Role tested | Code / config evidence | Test record | Screenshot(s) | Status |
|---|---|---|---|---|---|---|---|
| 7 | Sign in / forgot password | `/login`, `/forgot-password` | — | `Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx` | Krishna sign-in | login/01–02 | UI-verified (sign-in), UI-viewed (reset) |
| 7 | Session / local sign-out | — | Super Admin | `AuthContext.signOut({scope:'local'})`, revoked-session check, `useIdleTimer` | Signed out / back in on localhost:8081 (13 Oct) | — | Fixed (OF-02, `0e42791`) |
| 8 | User management, invite | `/app/admin/users` | Super Admin | `Users.tsx`, edge fn `admin-create-user` | Duplicate-email + expired-session errors | admin/01 | UI-verified (errors); invite success not tested (no test users) |
| 9 | Roles & permissions | `/app/admin/permissions` | Super Admin | `AuthContext.roleAllows`, `has_role`, `has_permission`, `role_permissions` | DB role simulation CEO vs Super Admin (rolled back) | admin/02 | Traced + DB-verified |
| 10 | Company profile | `/app/masters/company-profile` | Super Admin | `CompanyProfile.tsx`, `company_profile` | Sandbox filled with fake GSTIN / PAN / bank (OF-27) | admin/11 (Wipe Sandbox card hidden) | UI-viewed |
| 10 | Shifts | `/app/masters/deployments/shifts` | Super Admin | `ShiftsList.tsx`, `shifts` | Test Day Shift (TDAY) | shifts/01–02 | UI-verified |
| 10 | Expense categories / branches / TPSS accounts | `/app/masters/expense-categories`, `/branches/manage`, `/app/admin/tpss-accounts` | Super Admin | `manage_expense_category`, `soft_delete_branch`, `tpss_bank_accounts` (IFSC check) | Invalid IFSC rejected (not saved) | admin/08–10 | UI-verified (IFSC check, OF-20); categories seeded in prod (OF-32) |
| 11 | Client create/edit, wage config, billing lines, GST type, deduction template | `/app/masters/clients/new`, `/:id/edit` | Super Admin | `ClientForm.tsx`, `gen_client_code`, `version_wage_config`, `replace_client_billing_lines` | Test Client 1 (CLT-037); saved twice, lines stay at 2 (NF-01) | clients/01–05 | Fixed+verified (FX-04, NF-01, OF-23) |
| 12 | Client sites | Client edit → Sites / Posts | Super Admin | `ClientSites.tsx`, `client_posts` | "Main Gate (Synthetic) — Block A" | clients/06 | UI-verified (OF-21) |
| 13 | Contracts | `/app/masters/contracts/list` | Super Admin | `create_contract`, `client_contracts` | CNT-CLT-037-001 | contracts/01–03 | UI-verified |
| 14 | Employees | `/app/masters/employees/new`, `/:id/edit` | Super Admin | `EmployeeForm.tsx` (zod rules), `gen_employee_code` | EMP-192/193/194; auto-fill checked on a new form (not saved) | employees/01–06 | UI-verified; auto-fill fixed (OF-09), messages (OF-24) |
| 15 | Deployments / relieve / site | `/app/masters/deployments` | Super Admin | `create_deployment` (post_id), `relieve_deployment` | 3 deployments; site picker opened, nothing deployed | deployments/01–05 | UI-verified (relieve dialog and site picker viewed, not executed) |
| 16 | Attendance / duties | — | — | No attendance tables; `payroll/upload` placeholder | — | — | Not found (duties via paysheet) |
| 17.1–17.3 | Create / submit / approve paysheet | `/app/payroll/create`, `/list`, `/approvals` | Super Admin | `PaysheetCreate.tsx`, `calc.ts`, `approve_paysheet`, `reject_paysheet`, `guard_paysheet_status` | TEST-PS-SEP2026-001 | payroll/01–10, corrections/08 | UI-verified; calculations reconciled by hand |
| 17.4 | Paysheet view / Excel | `/app/payroll/:id/view` | Super Admin | `exportPaysheet.ts` | Excel inspected (33 cols) | payroll/11 | UI-verified |
| 17.5 | Payslips | `/app/payroll/payslip` | Super Admin | `Payslip.tsx` (jsPDF) | 3-page PDF | payslips/02–03 | UI-verified |
| 18.1 | Statutory documents | `/app/reports/supporting-documents` | Super Admin | `SupportingDocuments.tsx` | 4 PDFs re-rendered 13 Oct | statutory-docs/01–05 | UI-verified; layout fixed (OF-26) |
| 18.2 | ECR / ESI challan | `/app/compliance/ecr` | Super Admin | `EcrEsiGenerator.tsx` | ECR_2026-09.txt, ESI xlsx inspected | ecr-esi/01–02 | Fixed+verified (FX-07, OF-07 NCP, OF-08); rules kept (OF-10) |
| 18.3 | Compliance calendar | `/app/compliance` | Super Admin | `ComplianceCalendar.tsx`, `seed_compliance_tasks` | — | compliance/01 | UI-viewed (seed not run) |
| 18.3 | Compliance payments | `/app/compliance/payments/new` | Super Admin | `record_compliance_payment` | EPF ₹11,500 TEST-CHLN-EPF-001 | compliance-payments/02–04 | UI-verified |
| 19 | Bank payment batch | `/app/payroll/bank-payment` | Super Admin | `record_payment_batch`, `finalise_payment_batch`, guard trigger | SB-BATCH-20261012-QUU | bank-payment/01–04 | Fixed+verified (FX-05) |
| 19 | Bank disbursement | `/app/payroll/bank-disbursement` | Super Admin | `BankDisbursementReport.tsx` | PDF + CSV inspected | bank-disbursement/01–02 | Fixed+verified (FX-06) |
| 20 | Invoice from paysheet / manual / edit draft | `/app/invoices/new`, `/:id/edit`, `/:id/view` | Super Admin | `InvoiceForm.tsx`, `calc_invoice_fields`, `gen_invoice_number` | TEST-TC1/26-27/001, /002, /003; IGST draft /004 | invoices/01–09 | Fixed+verified (FX-08, FX-10, FX-11, OF-11, OF-13, OF-14) |
| 21 | Receipts | `/app/finance/receipts`, invoice view | Super Admin | `after_payment_insert`, `gen_receipt_number` | TEST-REC-OCT2026-002 (₹30,000), -003 (₹51,900) | receipts/01–04, invoices/05 | Fixed+verified (FX-09) |
| 21 | Reverse receipt | receipt view | Super Admin | `reverse_payment` | TEST-REC-OCT2026-004 and -005 (₹1,000 each) recorded and reversed | receipts/05 | UI-verified (OF-05, NF-07) |
| 21 | Follow-ups | `/app/finance/followups` | Super Admin | `create_followup`, `auto_open_followups` | Promised follow-up on /002 | followups/01–02 | UI-verified |
| 21 | Aging | `/app/finance/aging` | Super Admin | `AgingReport.tsx` | — | finance/03 | UI-verified |
| 22.2 | Expenses | `/app/expenses/v2` | Super Admin | `record_expense_v2`, `approve_expense` | EXP-SEP2026-001; new numbers `TEST-EXP-…` checked via `gen_expense_number` | expenses/02–05 | Fixed+verified (FX-12, FX-13, OF-16) |
| 22.3 | Cash Book / Monthly Summary | `/app/finance/cashbook`, `/summary` | Super Admin | `financial_ledger`, `ledger_set_balance_after` | From 01-09-2026: net 26,631.67 incl. salary batch (OF-04) | finance/01–02 | UI-verified (NF-04) |
| 22.4 | Advances / FFS / uniform confirmations | `/app/employees/...` | Super Admin | `request_advance`, `approve_advance`, `save_ffs`, `approve_ffs`, `confirm_uniform_advance` | — | lifecycle/01–07 | UI-viewed; Traced |
| 24 | Reports (MoM, Comparative, Client/Employee history, Annual, GST, Statement) | `/app/reports/*`, `/app/finance/*` | Super Admin | report pages | Filtered to Test Client 1; Statement closing 81,900 (OF-06); GST split (OF-12); drafts / cancelled excluded (NF-05, NF-06) | reports/01–05, finance/04–06, dashboard/01 | UI-verified (Annual PDF not generated — contains real data) |
| 24 | CRM | `/app/crm/*` | Super Admin | `crm_*` tables, `gen_lead_number`, Activity / Quotation / Closure dialogs | LEAD-2026-0002 "Test Prospect (Synthetic)": activity, quotation TEST-QTN-001, closed Won | crm/01–10 | UI-verified |
| 25 | Cancel / re-create invoice | invoice view | Super Admin | `cancel_invoice`, `recreate_invoice` | /002 → /003 | corrections/01–05 | UI-verified |
| 25 | Cancel paysheet | paysheet view | Super Admin | `cancel_paysheet` | Blocked (linked invoice; receipts) | corrections/06–07 | UI-verified (blocking) |
| 26 | Audit / activity / backups | `/app/admin/*` | Super Admin | `audit_logs` (names via `user_profiles`), `user_activity_log`, `backup_logs` | REVERSE_PAYMENT, RECREATE_INVOICE rows visible | admin/03, 05, 06 | UI-viewed (OF-30) |
| 6 | Sandbox vs production | — | — | `EnvironmentContext.tsx`, `gen_*_number`, watermarks, cron jobs both projects | — | banner in all screenshots | Traced + observed |
