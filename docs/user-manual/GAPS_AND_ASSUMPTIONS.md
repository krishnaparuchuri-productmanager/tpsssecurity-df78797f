# Gaps, Assumptions and Open Questions

> Phase 1 discovery output, 2026-10-12. Items here shape what the manual can honestly say. Product defects found while testing will be logged in `DOCUMENTATION_FINDINGS.md` (Phase 2); items already identified are cross-referenced.

## A. Requested capabilities that do not exist in the current implementation

For each: *"This functionality was not found in the current implementation"*, the evidence checked, and the nearest alternative.

| ID | Requested in brief | Evidence checked | Nearest existing workflow |
|---|---|---|---|
| G-01 | Separate **service-provider company / operating entity** creation | No entity table or screen; single `company_profile` row | Masters › Company Profile (one company only) |
| G-02 | **Client branches / locations / service sites** | Table `client_posts` exists (24 sandbox rows) but **no screen creates or edits sites**; Deployments form has a hidden `post_id` with no selector; only Employee History reads it | One client = one billing site. TPSS's own **Branches** are internal offices, not client sites |
| G-03 | **Attendance / duty register, shifts roster, leave, weekly-off, holiday tracking, duty import** | No attendance, roster or leave tables; `payroll/upload` route is a placeholder page | Duties are typed per employee as **No. of Duties** in Create Paysheet step 2; overtime as the **4-Hr OT** amount |
| G-04 | **Separate approval of attendance** before payroll | None | Paysheet approval (Payroll › Approval Queue) is the only approval |
| G-05 | **Payroll period creation** | None | A paysheet is created per client per month |
| G-06 | **General voucher types** — journal, contra, payment, receipt, debit/credit notes, purchase | Ledger enum supports receipt/payment/journal/contra, but **no voucher entry screen** | Ledger entries are created automatically by: receipts (invoice payments), approved expenses, compliance payments, advance/FFS flows. Cash Book shows them |
| G-07 | **Fine-grained permission control** for every screen | `role_permissions` has 30 screens; the UI reads it for only 8 (dashboard, clients, employees, payroll, compliance, crm_dashboard, crm_leads, expenses index). Others ignore it | Fixed role lists (see ROLE_PERMISSION_MATRIX.md) |
| G-08 | **Branch/site/client-scoped user access** | No user↔branch/client mapping | Branch filter on dashboard is a view filter, not a restriction |
| G-09 | **Period closing / month lock** | None | Approved paysheets cannot be edited by Accountant; cancellation is the only reversal |
| G-10 | **Credit notes / invoice reversal other than cancel** | None | Cancel invoice (Super Admin) → Re-create as new draft |
| G-11 | **Receipt edit, reversal or unallocated/advance receipts; one receipt across many invoices** | Receipt is always tied to one invoice; no edit/delete screen; amount cannot exceed outstanding | Record multiple partial receipts on the same invoice |
| G-12 | **Self-lockout protection** for administrators | No UI or server check on own role/deactivation | — (finding) |
| G-13 | **Employee documents / attachments** | No upload fields on employee | — |
| G-14 | **Employee transfers with effective dates / multiple simultaneous assignments** | Employee has one "Client Assignment" field; deployments table keeps history (relieve + new deployment) | Relieve deployment, then create a new one |
| G-15 | **Invoice sending by email** | No email integration | Print / save PDF from the browser and send manually |
| G-16 | **TDS on salary, LWF, gratuity as a payroll item** | Not in paysheet. Gratuity basic and bonus appear only in **Full & Final** | FFS form |

## B. Calculation behaviour that the manual must describe carefully

All statutory rates below are **hard-coded in the application**; there is no screen to change them. The manual will say what the product currently does and tell users to verify against current law. It will not present them as legal advice.

| ID | Topic | What the code does today | Source |
|---|---|---|---|
| C-01 | Where paysheet maths happens | Calculated **in the browser** (`src/lib/calc.ts` `recalcEmployee`) and saved as-is. The file comment says "server-side is authoritative; this is PREVIEW ONLY", but the server function `save_paysheet` that would recalculate is **never called**. | `PaysheetCreate.tsx`, DB `save_paysheet` |
| C-02 | Earned wages | (Sum of wage components **minus uniform allowance**) ÷ working days × duties; working days default 30 | `calc.ts` |
| C-03 | EPF wages | Higher of (computed PF base) and the employee's **EPF MW wages** figure — i.e. a **floor**, not a ceiling. Base depends on client's *PF Calculation Method*: Basic only / Basic + DA / (Basic + DA) ÷ 2 / Basic + DA + OT | `calc.ts`. The unused server version uses `LEAST(15000, earned)` — a ceiling. **Discrepancy to confirm with owner.** |
| C-04 | EPF contributions | Employee 12 %, Employer 13 % of EPF wages (13 % not split into EPS/EPF/EDLI/admin) | `calc.ts` |
| C-05 | ESI | Applies only if client ESI is on **and earned wages ≤ ₹21,000**. Base per client's *ESI Calculation Method*. Employee 0.75 %, Employer 3.25 % | `calc.ts` |
| C-06 | Professional Tax | If client PT on: earned ≥ ₹20,000 → ₹200; ≥ ₹15,000 → ₹150; else 0. (Unused server version uses > instead of ≥ — boundary differs.) | `calc.ts` |
| C-07 | Net / final net | Net = earned − EPF(emp) − ESI(emp) − PT. Final = Net − advance deduction − uniform advance deduction − canteen (price × qty less subsidy %) | `calc.ts` |
| C-08 | Rounding | Every component rounded to 2 decimals (paise). No rounding to rupee. | `r2()` |
| C-09 | Invoice totals | Billing = Σ(qty × rate) or line amount; TDS = billing × TDS %; GST = billing × GST % unless RCM; Total = billing + GST; Receivable = total − TDS; Net margin = receivable − enabled internal deductions; Outstanding = **receivable − received** (fixed 13 Oct, was net margin − received) | DB trigger `calc_invoice_fields` |
| C-10 | Invoice "paid" status | **Fixed (FX-09):** Paid when received ≥ receivable. Previously ≥ net margin | `after_payment_insert` |
| C-11 | Billing vs duties | Invoice lines carry *working days* and *no. of duties* columns, but line amount is **qty × rate per month**; duties do not change the amount automatically | `InvoiceForm.tsx` |
| C-12 | Due date | Invoice date + 30 days if not set; overdue job marks *Sent/Partially paid* invoices past due | trigger + cron |

## C. Assumptions made for documentation

| ID | Assumption | Basis |
|---|---|---|
| A-01 | Synthetic data will be named **"Test Client 1"**, **"Test Employee 1, 2, 3…"**; no existing sandbox client or employee will be used or shown | Product owner instruction 2026-10-12 |
| A-02 | Screenshots are captured as **Krishna (Super Admin)**; Krishna's name may appear | Product owner instruction |
| A-03 | COO and Accountant access is documented from code and database (role simulation), marked *Traced, not verified in UI* | Product owner decision: no test users |
| A-04 | Legacy pages reachable only by URL (`/app/expenses`, `/app/reports/mom`, `/app/reports/financial`, `/app/payroll/upload`, `/app/masters/branches` vs *Branches Management*) are documented in an appendix as legacy, not in main procedures | Hidden from sidebar |
| A-05 | Existing sandbox list pages will be **filtered/searched to "Test"** before screenshots so real-looking client/employee names never appear | A-01 |
| A-06 | Generated files (bank Excel, ECR, PDFs) are captured from the sandbox and carry SANDBOX markings | DEMO_PROD_DIFFERENCES.md |

## D. Open questions for the product owner (non-blocking unless marked)

| ID | Question | Why it matters |
|---|---|---|
| Q-01 | Is the EPF floor/ceiling behaviour (C-03) and 13 % employer rate intended? | Manual must state current behaviour; a wrong rule would mis-state PF liabilities |
| Q-02 | Should an invoice count as *Paid* at net margin (C-10)? | Affects receivables reporting explanation |
| Q-03 | Sandbox "Wipe Sandbox" deletes all 34 existing sandbox clients' transactions too. Should the manual describe it as a training reset tool? | Destructive action guidance |

## E. Already-found issues

> Superseded by `DOCUMENTATION_FINDINGS.md` (13 fixed, 35 open). Kept for history.

| Ref | Issue | Status |
|---|---|---|
| F-01 | Invite errors showed generic "non-2xx" text | **Fixed** (commit `3e5a618`) with owner approval |
| F-02 | Create dialogs kept stale data (Add User, Record Payment, New Contract, New Deployment, Relieve, Add Shift) | **Fixed** (commit `17d55e4`) with owner approval |
| F-03 | Sign-out is global: signing out anywhere ends every session of that user | Open — documented |
| F-04 | A revoked session still looks signed in until an action fails ("Your session has expired") | Open — documented |
| F-05 | `.env` points local runs at production while the UI says Sandbox (DPR-01) | Mitigated locally with `.env.local`; open in repo |
| F-06 | `admin-create-user` edge function source was not in git | **Fixed** (added in `72c9af3`) |
| F-07 | Generated database types are stale (142 pre-existing type errors) | Open — maintenance |
| F-08 | Self-lockout possible (G-12) | Open |
