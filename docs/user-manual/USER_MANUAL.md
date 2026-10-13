# TPSS Operations & Finance Portal — User Manual

**Trinetra Professional Security Services — Internal Portal**

| | |
|---|---|
| Document | User Manual |
| Version | 1.1 (draft for review) |
| Applies to | Portal build `8b1d126` and later (October 2026) |
| Prepared | 13 October 2026 |
| Audience | Super Admin, CEO, COO / Operations, Accountant |
| Environment used for examples | **Sandbox** (all records are synthetic) |

---

## 1. Cover page

This manual explains how to run the monthly operations of a security-services business in the TPSS portal: clients, guards, deployments, paysheets, statutory files, bank payments, client invoices, receipts, expenses and reports.

Every example uses one connected, **synthetic** business month: **Test Client 1**, **Test Employees 1–3**, September 2026. No real client, employee, bank or government data appears in this manual.

> ⚠️ **Statutory disclaimer.** This manual describes how the portal *currently* calculates PF, ESI, PT, TDS and GST. It is not legal, tax or compliance advice. The rates are built into the application and cannot be changed from the screens. Verify them against current law before you process payroll or file returns.

## 2. Document control and version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 12 Oct 2026 | Documentation team (with Claude) | Discovery, feature inventory, role matrix |
| 1.0 | 13 Oct 2026 | Documentation team (with Claude) | Full manual, screenshots and findings |
| 1.1 | 13 Oct 2026 | Documentation team (with Claude) | Updated for the fixes to the open findings: Sites, receipt reversal, IGST, Statement TDS line, GST split, drafts excluded from reports, salary auto-fill, labelled approvals, ledger postings; new and replaced screenshots |

Related documents (same folder): `FEATURE_INVENTORY.md`, `ROLE_PERMISSION_MATRIX.md`, `DEMO_PROD_DIFFERENCES.md`, `GAPS_AND_ASSUMPTIONS.md`, `DOCUMENTATION_FINDINGS.md`, `FEATURE_TRACEABILITY.md`.

## 3. Purpose and intended audience

This manual is for the people who run the business day to day:

| Reader | Typical tasks |
|---|---|
| **Super Admin** | Users, roles, permissions, audit, backups, corrections (cancel / re-create) |
| **CEO** | Everything operational; approvals; company profile and masters |
| **COO / Operations** | Clients, guards, deployments, contracts, approvals |
| **Accountant** | Paysheets, invoices, receipts, expenses, statutory files, bank payments |

It assumes you know your own business processes. It does not assume technical knowledge.

## 4. Product overview

The portal replaces spreadsheets with one system that is shared and audited:

```
Client  ──► Contract, wage rates, billing lines
   │
Employees ──► Deployment to client (shift, start date)
   │
Monthly paysheet (duties) ──► Approval ──► Bank payment file, payslips,
   │                                       PF / ESI / PT documents, ECR, ESI challan
   ▼
Client invoice (from paysheet) ──► Sent ──► Receipts ──► Paid
   │
Expenses, compliance payments ──► Ledger (Cash Book) ──► Reports
```

Main menu groups: **Overview, Masters, Employee Lifecycle, Payroll, Invoices, Finance, Reports, Expenses, Compliance, CRM, Administration**. Which groups and items you see depends on your role (chapter 9).

## 5. Environment and access

| | Sandbox (training) | Production (live) |
|---|---|---|
| Address | `tpss-security-sandbox.pages.dev` | `portal.tpsssecurity.com` |
| Banner | Yellow **SANDBOX MODE** strip on every page | None |
| Document numbers | Start with `TEST-` | Normal |
| PDFs | Diagonal **SANDBOX** watermark | Normal |
| Bank payment Excel | Row "*** SANDBOX — NOT FOR REAL PAYMENT ***" | Normal |

You need a user account created by a Super Admin. You receive an email invitation to set your password.

## 6. Demo (Sandbox) versus Production

The two environments run the **same application** but keep **completely separate data and user accounts**. The address you open decides which one you are in. There is no switch inside the app.

- Use the **sandbox** for training and trying things out. Nothing there affects real records.
- Never upload a sandbox bank file to a bank. It is marked "NOT FOR REAL PAYMENT".
- A password set in one environment does not work in the other.
- Sandbox document numbers start with `TEST-`.

Full comparison: `DEMO_PROD_DIFFERENCES.md`.

## 7. Login, logout and basic navigation

### Sign in
1. Open the portal address.
2. Enter **Email** and **Password**, then click **Sign In** (Figure 7.1).
3. You arrive on the **Dashboard**.

![Figure 7.1 — Sign-in page](assets/screenshots/login/01-login-blank.png)
*Figure 7.1 — Sign-in page*

**Forgot password:** click **Forgot password?**, enter your email and follow the link sent to you. The new password must be at least 8 characters, and both entries must match (Figure 7.2).

![Figure 7.2 — Reset password request](assets/screenshots/login/02-forgot-password.png)
*Figure 7.2 — Reset password request*

### The screen layout (Figure 7.3)
- **Left menu**: modules, grouped. Click ☰ (top left) to collapse or expand it.
- **Top bar**: session timer, notifications 🔔, your name and role.
- **Breadcrumb**: where you are (for example Dashboard › Masters › Clients).
- **Yellow banner**: shown only in the sandbox.

![Figure 7.3 — Dashboard](assets/screenshots/dashboard/01-dashboard-overview.png)
*Figure 7.3 — Dashboard*

### Session timeout and sign-out
- You are signed out after a period of inactivity. A warning appears about 5 minutes before.
- **Signing out ends only this browser's session.** Other devices stay signed in.
- If your session is ended elsewhere (for example an administrator deactivates you), the app notices when you return to the tab and takes you to the sign-in page.

## 8. User administration (Super Admin)

**Menu:** Administration › User Management (Figure 8.1)

![Figure 8.1 — User Management](assets/screenshots/admin/01-user-management.png)
*Figure 8.1 — User Management*

### Add a user
1. Click **Add User**.
2. Enter **Full Name\***, **Email\*** and **Role\***. Phone is optional.
3. Click **Send Invite**. The user receives an email to set a password, and the role applies immediately.

| Field | Mandatory | Notes |
|---|:-:|---|
| Full Name | Yes | Shown across the app |
| Email | Yes | Must not already belong to a user ("A user with the email … already exists") |
| Role | Yes | Super Admin, CEO, COO / Operations or Accountant |
| Phone | No | |

### Edit, change role, deactivate, remove
- **Edit** changes the name and phone.
- The **Role** dropdown on a row changes the role after you confirm. This takes effect immediately.
- **Deactivate** blocks sign-in ("Account deactivated"). **Remove** hides the user.

> ℹ️ **The last active Super Admin is protected.** The app refuses to demote, deactivate or remove them, and you cannot change your own row, so there is always someone who can manage users.

**Common errors:** "Your session has expired. Please sign out and sign in again" (see chapter 7); "already exists" (use another email).

## 9. Roles and access control

| Role | Summary |
|---|---|
| **Super Admin** | Everything, plus: user management, role permissions, audit and activity logs, backups, cancel and re-create of invoices and paysheets |
| **CEO** | All business functions and approvals; company profile, expense categories, branches, TPSS bank accounts, branch summary |
| **COO / Operations** | Clients, employees, deployments, contracts, shifts, branches; approves paysheets, advances, FFS and expenses |
| **Accountant** | Creates paysheets, invoices, receipts, expenses, advances and FFS; bank payments, payslips, statutory documents. Cannot approve |

Key rules enforced by the system:
- A COO cannot approve a paysheet, advance or FFS **they submitted**. The CEO and Super Admin can.
- Nobody except the CEO and Super Admin can approve an **expense they recorded**.
- Only the Super Admin can **cancel or re-create** invoices and paysheets.

**Role Permissions screen** (Administration › Role Permissions, Figure 9.1): a grid of View / Create / Edit / Delete / Approve / Export per role and screen.

> ℹ️ This grid only affects Dashboard, Clients, Employees, Payroll, Compliance, Expenses and CRM. The other menus follow fixed rules (table above).

![Figure 9.1 — Role Permissions](assets/screenshots/admin/02-role-permissions.png)
*Figure 9.1 — Role Permissions*

Full detail: `ROLE_PERMISSION_MATRIX.md`.

## 10. Initial configuration and master data

Set these up once, in this order, before monthly work:

| Step | Menu | Who | Purpose |
|---|---|---|---|
| 1 | Masters › Company Profile | CEO | Company name, PAN, GSTIN, PF/ESI codes, bank, logo, **invoice location code**. These print on invoices and documents |
| 2 | Administration › Branches Management | CEO | Your offices (for example Nellore) |
| 3 | Masters › Shifts | CEO / COO | Shift name, code, times, hours, branch |
| 4 | Administration › Expense Categories | CEO | Expense heads and their ledger mapping |
| 5 | Administration › TPSS Bank Accounts | CEO | The company accounts that salaries are paid **from**. The IFSC must be 11 characters in the format `AAAA0XXXXXX` |

![Figure 10.1 — Company Profile](assets/screenshots/admin/11-company-profile.png)
*Figure 10.1 — Company Profile (sandbox filled with obviously fake GSTIN, PAN, PF / ESI codes and bank; empty fields print "—" on invoices)*

![Figure 10.2 — Add a shift](assets/screenshots/shifts/02-shift-add-completed.png)
*Figure 10.2 — Masters › Shifts: adding "Test Day Shift"*

**Shift rules:** Name and Branch are required ("Name and branch required", Figure 10.3). Times default to 07:00–19:00, 8 hours.

![Figure 10.3 — Shift validation](assets/screenshots/shifts/01-shift-add-validation.png)
*Figure 10.3 — Shift validation message*

Other setup screens: Figures 10.4–10.6.

![Figure 10.4 — Expense Categories](assets/screenshots/admin/08-expense-categories.png)
*Figure 10.4 — Expense Categories*

![Figure 10.5 — Branches Management](assets/screenshots/admin/09-branches-management.png)
*Figure 10.5 — Branches Management (a branch cannot be deleted while clients or employees are linked)*

![Figure 10.6 — TPSS Bank Accounts](assets/screenshots/admin/10-tpss-bank-accounts.png)
*Figure 10.6 — TPSS Bank Accounts (account details masked in this manual)*

## 11. Client / company management

**Menu:** Masters › Clients → **Add Client** (Figure 11.1)

**Purpose:** a client record holds everything used later for payroll and billing: statutory switches, wage rates per designation, billing lines and the invoice deduction template.

![Figure 11.1 — Add New Client (top)](assets/screenshots/clients/01-client-create-blank.png)
*Figure 11.1 — Add New Client*

### Field reference — Client Details

| Field | Description | Mandatory | Example | Effect |
|---|---|:-:|---|---|
| Client Name | Legal / display name | **Yes** | Test Client 1 | Everywhere |
| Client Type | Company/Firm or Individual/HUF | No (default Company) | Company / Firm (TDS 1%) | Sets the default TDS rate |
| Service Type | Security / Housekeeping / Both | No (default Security) | Security | Reports |
| TDS Rate % | Tax the client deducts | No | 1 | Invoice: TDS = billing × rate |
| Contract Value (₹) | Annual value | No | 840000 | Reference |
| Invoice Prefix | Prefix for invoice numbers | No | TC1 | Invoice number `TC1/26-27/001` |
| Contract Start / End | Contract period | No | 01-04-2026 / 31-03-2027 | Reference |
| GST Applicable, GST %, GST Number, RCM | GST settings | No | Yes, 18 % | Invoice GST; under RCM no GST is charged |
| GST Type | **CGST + SGST** (client in the same state) or **IGST** (client in another state) | No (default CGST + SGST) | CGST + SGST | How GST prints on the invoice and splits in the GST report |
| Service Charge % / Show in invoice | Optional service charge | No | 0 | Invoice |
| Professional Tax Applicable | Deduct PT on payroll | No | Yes | Payroll PT |
| Canteen Facility | Enables canteen deductions | No | No | Payroll |
| PF Applicable / PF Calculation Method | PF on/off and wage base | No | Yes / (Basic + DA) ÷ days × duties | Payroll EPF |
| ESI Applicable / ESI Calculation Method | ESI on/off and base | No | Yes / (Basic + DA) ÷ days × duties | Payroll ESI |
| E-Invoice Applicable | Flag only | No | No | — |
| Contact Person / Phone / Email | Client contact | No | | Reference |
| Status | Active / Inactive | No | Active | Inactive clients are hidden from pickers |
| Address, Notes | Free text | No | | Invoice "Address" |

The **client code** (for example CLT-037) is assigned automatically when you save.

### Wage Configuration (one row per designation)
Basic, DA, TA, Special allowance, Conveyance, Washing, Uniform, Weekly-off, **Effective From**, plus a second line: 4-hr OT, Bonus, Relieving, Leave wages, EPF Min Wages, ESI Min Wages.
- Payroll uses **these rates** for each employee, matched by designation.
- A new row with a later **Effective From** creates a new version and closes the previous one. Saving the client without changing a row does not create a new version.

### Invoice Billing Lines
Description, SAC (default 998525), Unit label, **Rate / Month**, Order, Active. These pre-fill every invoice for the client.

### Invoice Deduction Template
Internal deductions (net salary paid, PF employer, ESI employer, plus any custom rows). They are used to calculate the **net margin** and **never print** on the client's invoice.

### Create procedure (Figure 11.2)
1. Enter **Client Name** and set the switches.
2. Add one **Wage Configuration** row per designation you deploy.
3. Add the **Billing Lines**.
4. Click **Save to Sandbox** (in production: **Save**). "Client created" confirms it, and you return to the list (Figure 11.3).

![Figure 11.2 — Completed client form](assets/screenshots/clients/03-client-create-completed.png)
*Figure 11.2 — Completed client form for Test Client 1*

![Figure 11.3 — Client list](assets/screenshots/clients/04-client-list-saved.png)
*Figure 11.3 — Client list (searched for "Test Client")*

**Validation:** with no name, the message is "Client name is required" (Figure 11.4).

![Figure 11.4 — Client validation](assets/screenshots/clients/02-client-create-validation.png)
*Figure 11.4 — Validation message*

### Edit / deactivate
Use ✏️ on the list to edit (Figure 11.5). The power icon (CEO / Super Admin) activates or deactivates a client.
- Changing wage rates affects **future** paysheets only. Approved paysheets keep their figures.

![Figure 11.5 — Edit client](assets/screenshots/clients/05-client-edit.png)
*Figure 11.5 — Edit client*

## 12. Client locations and service sites

**Menu:** Masters › Clients → ✏️ (edit a saved client) → **Sites / Posts** section (Figure 12.1)

**Purpose:** list the places where guards are posted for a client (for example Main Gate, Block A), so a deployment can name the post.

| Field | Mandatory | Notes |
|---|:-:|---|
| Site / post name | **Yes** | Must be unique for the client |
| Unit / location | No | For example a block or building |
| Active | — | Switch off to retire a site. Sites are never deleted, so past deployments keep their site |

**Procedure**
1. Open the client with ✏️. (A new client must be saved first; the section says so until then.)
2. Enter the site name and, optionally, the unit, then click **Add Site** ("Site added").
3. Use the **Active** switch to retire or restore a site.

Changes in this section **save immediately**; they do not wait for the client form's Save button. Who can change sites: CEO, COO / Operations and Super Admin.

![Figure 12.1 — Sites / Posts on the client](assets/screenshots/clients/06-client-sites.png)
*Figure 12.1 — Sites / Posts section with the synthetic site "Main Gate (Synthetic) — Block A"*

Choose the site when deploying an employee (chapter 15). Your company's own offices are **Branches** (chapter 10), not sites.

## 13. Contracts, rates and manpower requirements

**Menu:** Masters › Contracts → **New Contract**

| Field | Mandatory | Notes |
|---|:-:|---|
| Client | **Yes** | |
| Start | **Yes** | Defaults to today |
| End | No | Blank = open-ended |
| PO Number, PO Date, PO Amount, Notes | No | |

1. Click **New Contract**, fill in the fields and click **Create** ("Contract created"). The number is assigned automatically, for example `CNT-CLT-037-001`.
2. The list filters by **active / expired / renewed / terminated**. The **Expiry** badge shows Active, days left (under 30), Expired or Open-ended. A daily job checks expiries and sends notifications.

![Figure 13.1 — Contract validation](assets/screenshots/contracts/01-contract-create-validation.png)
*Figure 13.1 — "Client and start date required"*

![Figure 13.2 — New contract](assets/screenshots/contracts/02-contract-create-completed.png)
*Figure 13.2 — Completed contract*

![Figure 13.3 — Contracts list](assets/screenshots/contracts/03-contract-saved.png)
*Figure 13.3 — Contracts list*

**Rates** are set on the client (chapter 11). **Manpower requirement** (headcount per site) is **not modelled**. The invoice quantity is entered by hand; when the invoice is created from a paysheet, the form shows the paysheet headcount by designation as a guide (chapter 20).

## 14. Employee / security-guard management

**Menu:** Masters › Employees → **Add Employee** (Figure 14.1)

![Figure 14.1 — New employee](assets/screenshots/employees/01-employee-create-blank.png)
*Figure 14.1 — Employee form*

### Field reference

| Section | Field | Mandatory | Format / rule |
|---|---|:-:|---|
| Basic | Full Name | **Yes** | max 150 characters |
| | Designation | **Yes** | ASO, S.GUARD, WRITER, SUPERVISOR, FIELD OFFICER |
| | Client Assignment | No | Client the employee works for |
| | Date of Joining | **Yes** | |
| | Status | No | Active / Relieved / Absconded |
| | New Joiner | No | Marks first month (informational flag on the paysheet) |
| Statutory | UAN Number | No* | exactly **12 digits** |
| | ESI Number | No* | exactly **17 digits** |
| | Aadhaar | No | exactly 12 digits |
| | EPF Exempt / ESI Exempt | No | |
| Salary | Basic, DA, TA, Weekly Off, Washing, Conveyance, Special, 4-Hr OT rate, Bonus, Relieving, Leave Wages | No | Payable Gross is calculated |
| Bank | Bank Name, Account Number, IFSC | No* | account **9–18 digits**; IFSC `AAAA0XXXXXX` |
| Contact | Mobile | No | exactly 10 digits |

\* Not required to save, but a **missing UAN** blocks paysheet submission, and missing bank details leave the bank file incomplete.

> ℹ️ For a **new** employee, choosing the **Client Assignment** and **Designation** fills Basic, DA and TA from that client's current wage configuration for the designation (chapter 11). You can change the amounts. Payroll still uses the client's wage configuration first, so these figures are a fallback.

**Employee code** (for example EMP-192) is assigned automatically.

**Validation examples:** "Full name is required" (Figure 14.2); "UAN must be exactly 12 digits" (Figure 14.3).

![Figure 14.2 — Required field](assets/screenshots/employees/02-employee-create-validation.png)
*Figure 14.2 — Required-field message*

![Figure 14.3 — Format check](assets/screenshots/employees/03-employee-create-format-error.png)
*Figure 14.3 — UAN format check*

![Figure 14.4 — Completed](assets/screenshots/employees/04-employee-create-completed.png)
*Figure 14.4 — Test Employee 1 completed (synthetic identifiers)*

![Figure 14.5 — Employee list](assets/screenshots/employees/05-employee-list-saved.png)
*Figure 14.5 — Employee list (searched "Test Employee")*

![Figure 14.6 — Edit employee](assets/screenshots/employees/06-employee-edit.png)
*Figure 14.6 — Edit employee*

**Separation:** set Status to Relieved, or complete a **Full & Final** settlement (chapter 22.4), which sets Relieved automatically on approval.

## 15. Employee–client–site assignment (Deployments)

**Menu:** Masters › Deployments → **New Deployment** (CEO / COO)

| Field | Mandatory |
|---|:-:|
| Employee (shown as "EMP-192 — Test Employee 1") | **Yes** |
| Client | **Yes** |
| Site / Post | No — lists the client's **active** sites (chapter 12); default "No specific site" |
| Shift | **Yes** |
| Start Date | **Yes** |
| Notes | No |

"Fill required fields" appears if any are missing (Figure 15.1). On success: "Deployed". The list shows a **Site** column.

![Figure 15.5 — Site picker](assets/screenshots/deployments/05-deployment-site-picker.png)
*Figure 15.5 — Choosing the site for Test Client 1 (the picker is empty until a client is chosen)*

![Figure 15.1 — Validation](assets/screenshots/deployments/01-deployment-create-validation.png)
*Figure 15.1 — Deployment validation*

![Figure 15.2 — Deploy employee](assets/screenshots/deployments/02-deployment-create-completed.png)
*Figure 15.2 — Deploying Test Employee 1*

![Figure 15.3 — Deployments list](assets/screenshots/deployments/03-deployment-saved.png)
*Figure 15.3 — Deployments (other records hidden)*

**Transfer / end a posting:** click **Relieve** on the row, enter **End Date\*** and **Reason\***, and confirm (Figure 15.4). To move a guard to another client, relieve them, then create a new deployment. History is kept.

![Figure 15.4 — Relieve](assets/screenshots/deployments/04-deployment-relieve-dialog.png)
*Figure 15.4 — Relieve dialog*

## 16. Shifts, duties, attendance and overtime

- **Shifts:** chapter 10.
- **Attendance / duty register, leave, weekly-off and holiday tracking, and duty import:** **this functionality was not found in the current implementation.** The *Upload Paysheet* page is a placeholder.
- **How duties are recorded instead:** in **Create Paysheet → Step 2**, type each employee's **Duties** (days worked) for the month (chapter 17). Working days default to the number of days in the month.
- **Overtime:** enter the 4-hour OT amount in the paysheet grid (column "4hr OT").

## 17. Monthly payroll and paysheets

### 17.1 Create a paysheet (Accountant, CEO, Super Admin)
**Menu:** Payroll › Create Paysheet

**Step 1 — choose client and month** (Figures 17.1–17.3)
1. Select **Client**, **Month** and **Year**. **Working Days** fills in automatically (30 for September).
2. Click **Load Employees →**. Without a client you see "Select a client first".

![Figure 17.1 — Step 1](assets/screenshots/payroll/01-paysheet-create-step1-blank.png)
*Figure 17.1 — Create Paysheet, step 1*

![Figure 17.2 — Step 1 validation](assets/screenshots/payroll/02-paysheet-create-step1-validation.png)
*Figure 17.2 — "Select a client first"*

![Figure 17.3 — Step 1 completed](assets/screenshots/payroll/03-paysheet-create-step1-completed.png)
*Figure 17.3 — Test Client 1, September 2026*

**Step 2 — enter duties and review** (Figures 17.4–17.6)
- The grid loads every employee assigned to the client, with wage components from the client's wage configuration.
- Type **Duties** for each employee. Every other column recalculates instantly.
- The **anomalies panel** groups problems:

| Colour | Meaning | Examples | Action |
|---|---|---|---|
| 🔴 Blockers | Must fix before submit | Missing UAN; ESI wages but no ESI number | Fix in Employee master |
| 🟡 Warnings | Review | Zero earned wages; duties > working days; ESI wages > ₹21,000 | Confirm or correct |
| 🔵 Info | No action | New joiner | — |

![Figure 17.4 — Anomalies before duties](assets/screenshots/payroll/04-paysheet-step2-anomalies.png)
*Figure 17.4 — Before entering duties: "Zero earned wages" warnings*

![Figure 17.5 — Duties entered](assets/screenshots/payroll/05-paysheet-step2-duties-entered.png)
*Figure 17.5 — Duties entered (30, 26, 30)*

![Figure 17.6 — Full grid](assets/screenshots/payroll/06-paysheet-step2-full-grid.png)
*Figure 17.6 — All grid columns (scroll right in the app)*

**Step 3 — summary** (Figure 17.7): **Save Draft** or **Submit for Approval**.

![Figure 17.7 — Summary](assets/screenshots/payroll/07-paysheet-step3-summary.png)
*Figure 17.7 — Step 3 summary*

### 17.2 How each column is calculated (as implemented)
For each employee (rounded to paise):

| Item | Formula used by the portal |
|---|---|
| Payable Gross | Basic + DA + TA + 4hr OT + Weekly Off + Bonus + Relieving + Leave + Conveyance + Washing + Uniform + Special |
| **Earned** | (Payable Gross − Uniform) ÷ Working Days × Duties. *Uniform is kept by the company (issued in kind)* |
| EPF wages | Base per client method (default (Basic + DA) ÷ days × duties). If the client's "EPF Min Wages" is higher, that figure is used (minimum) |
| EPF Employee | 12 % of EPF wages |
| EPF Employer | 13 % of EPF wages |
| ESI | Only if client ESI is on **and** Earned ≤ ₹21,000. Base per client method. Employee 0.75 %, Employer 3.25 % |
| PT | If client PT is on: Earned ≥ ₹20,000 → ₹200; ≥ ₹15,000 → ₹150; otherwise 0 |
| Net | Earned − EPF Employee − ESI Employee − PT |
| **Final Net** | Net − Advance − Uniform advance − Canteen (price × qty less subsidy %) |

> ⚠️ These rates and thresholds are **built into the application**. Verify them against current law (finding OF-10).

### 17.3 Submit, approve, reject
- **Monthly Paysheets** list (Figure 17.8): View 👁, Edit ✏️ (Draft or Rejected only) and **Submit**. The browser asks "Submit anyway?" only when the paysheet has 🔴 or 🟡 flags; informational flags (new joiner) do not ask.
- **Approval Queue** (CEO, COO, Super Admin; Figure 17.10): labelled **Approve** and **Reject** buttons. Reject needs a reason of 10–200 characters (Figure 17.11).
- On approval: pending advance deductions are applied, uniform-advance confirmations are created, and the submitter is notified.

![Figure 17.8 — Draft in list](assets/screenshots/payroll/08-paysheet-list-draft.png)
*Figure 17.8 — Monthly Paysheets: draft*

![Figure 17.9 — Submitted](assets/screenshots/payroll/09-paysheet-list-submitted.png)
*Figure 17.9 — Submitted*

![Figure 17.10 — Approval Queue](assets/screenshots/payroll/10-approval-queue.png)
*Figure 17.10 — Approval Queue*

![Figure 17.11 — Reject dialog](assets/screenshots/corrections/08-paysheet-reject-dialog.png)
*Figure 17.11 — Reject paysheet (reason 10–200 characters)*

**Statuses:** Draft → Submitted → Approved, or Rejected (editable again) → … ; Cancelled (Super Admin only; chapter 25).

### 17.4 View, print, export
Open a paysheet (Figure 17.12): **Print / PDF**, **Excel** (33 columns, CEO / COO), **Generate Invoice**, and **Cancel Paysheet** (Super Admin).

![Figure 17.12 — Approved paysheet](assets/screenshots/payroll/11-paysheet-view-approved.png)
*Figure 17.12 — Approved paysheet TEST-PS-SEP2026-001*

### 17.5 Payslips
**Menu:** Payroll › Payslips. Choose **Client / Site\*** and **Month\*** (and optionally an employee), then **Generate PDF**. The button is disabled until a client and month are chosen.

![Figure 17.13 — Payslips screen](assets/screenshots/payslips/02-payslip-selected.png)
*Figure 17.13 — Payslips*

![Figure 17.14 — Payslip](assets/screenshots/payslips/03-payslip-pdf-employee1.png)
*Figure 17.14 — Payslip for Test Employee 1 (sandbox watermark)*

## 18. ESI, PF and other statutory processing

| Item | Supported how |
|---|---|
| EPF | Calculated per employee (chapter 17.2); PF Statement PDF; ECR text file; payment recorded in Compliance › Payments |
| ESI | Calculated per employee; ESI Statement PDF; ESI challan Excel; payment recorded |
| Professional Tax | Calculated; PT Report PDF; payment recorded (type PT) |
| GST | On invoices; GST Report export; payment recorded (type GST) |
| TDS | Client TDS deducted on invoices; payment type TDS available |
| Bonus / gratuity / leave encashment | Only in **Full & Final** settlement |
| LWF, TDS on salary | **Not found in the current implementation** |

### 18.1 Statutory documents
**Menu:** Reports › Statutory Documents. Choose **Month\***, tick the clients, choose a tab (**Salary Register, PF Statement, ESI Statement, PT Report**) and click **Download PDF**. Several clients download as a ZIP. Only **approved** paysheets are included.

![Figure 18.1 — Statutory Documents](assets/screenshots/statutory-docs/01-statutory-docs-selected.png)
*Figure 18.1 — Statutory Documents*

![Figure 18.2 — PF statement](assets/screenshots/statutory-docs/02-pf-statement-pdf.png)
*Figure 18.2 — PF Contribution Statement (total EPF wages ₹46,000; EE ₹5,520; ER ₹5,980)*

![Figure 18.3 — ESI statement](assets/screenshots/statutory-docs/03-esi-statement-pdf.png)
*Figure 18.3 — ESI Statement*

![Figure 18.4 — Salary register](assets/screenshots/statutory-docs/04-salary-register-pdf.png)
*Figure 18.4 — Salary Register*

![Figure 18.5 — PT report](assets/screenshots/statutory-docs/05-pt-report-pdf.png)
*Figure 18.5 — PT Report*

### 18.2 ECR and ESI challan files
**Menu:** Compliance › ECR / ESI Challan. Choose **Year** and **Month**. The page shows the number of approved paysheets and employee lines.
- **EPFO ECR 2.0** tab → **Download ECR text file**. Fields are separated by `#~#`. Only members with a UAN are included.
- **ESI Challan** tab → **Download ESI Challan Excel**. Only members with an ESI number are included.

![Figure 18.6 — ECR](assets/screenshots/ecr-esi/01-ecr-generator-sep2026.png)
*Figure 18.6 — ECR generator: 1 paysheet, 3 lines, EPF ₹11,500*

![Figure 18.7 — ESI challan](assets/screenshots/ecr-esi/02-esi-challan-tab.png)
*Figure 18.7 — ESI challan: total ₹1,840*

How the files are filled:
- ECR **NCP days** = working days − duties for each member.
- ESI challan **No of Days** = the member's duties. The column headings are on row 1, with no company header rows above them.

> ⚠️ **Check before uploading.** By the owner's decision the statutory rules are kept as implemented: the ECR employer difference is 13 % − 8.33 %, and gross wages include the uniform allowance. Verify both files against the current EPFO and ESIC portal formats.

### 18.3 Compliance calendar and payments
- **Compliance › Compliance Calendar** (Figure 18.8): monthly due-date tasks, overdue and due-this-week counts. **Seed 12 Months** creates the standard tasks; **Mark Complete** records the challan, amount and notes.
- **Compliance › Payments → Record Payment** (Figures 18.9–18.11):

| Field | Mandatory |
|---|:-:|
| Type (EPF, ESI, GST, PT, TDS, OTHER) | **Yes** |
| For Month | **Yes** |
| Paid On | **Yes** |
| Amount (₹) | **Yes** ("Amount required") |
| Late Fee, Interest | No |
| Challan Number, Bank Name, Reference / UTR, Branch, Notes | No |

Saving posts a **payment** to the ledger ("Compliance payment recorded & posted to ledger").

![Figure 18.8 — Compliance calendar](assets/screenshots/compliance/01-compliance-calendar.png)
*Figure 18.8 — Compliance Calendar*

![Figure 18.9 — Compliance payment validation](assets/screenshots/compliance-payments/02-compliance-payment-validation.png)
*Figure 18.9 — "Amount required"*

![Figure 18.10 — EPF payment](assets/screenshots/compliance-payments/03-compliance-payment-completed.png)
*Figure 18.10 — Recording EPF for September*

![Figure 18.11 — Compliance payments list](assets/screenshots/compliance-payments/04-compliance-payment-list.png)
*Figure 18.11 — Compliance Payments*

## 19. Employee bank-payment sheet

**Menu:** Payroll › Bank Payment (CEO, COO, Accountant, Super Admin)

**Prerequisites:** an **approved** paysheet, employee bank details and IFSC, and a **TPSS debit account** (chapter 10).

![Figure 19.0 — Bank Payment](assets/screenshots/bank-payment/01-bank-payment-blank.png)
*Figure 19.0 — Bank Payment (New Payment, Pending and History tabs)*

1. **Month**: only months with approved paysheets are listed.
2. Tick the **clients** and click **Load Employees**.
3. **Select All (Full Pay)**, or tick individual employees. Use **Partial ₹** to pay part of the net, and choose the payment **Type** (for example N = NEFT).
4. Choose the **Debit Account (TPSS)**.
5. Click **Finalise & Generate Excel**. The batch is saved first; only then is the Excel produced. Employees show **Paid** or **Partial**, and the batch total is posted to the ledger as a **Staff Salary** payment (chapter 21).

![Figure 19.1 — Selected](assets/screenshots/bank-payment/02-bank-payment-selected.png)
*Figure 19.1 — Three employees selected, ₹41,268.33*

![Figure 19.2 — Paid](assets/screenshots/bank-payment/03-bank-payment-paid.png)
*Figure 19.2 — After finalising: Fully paid*

![Figure 19.3 — History](assets/screenshots/bank-payment/04-bank-payment-history.png)
*Figure 19.3 — History tab (re-download a batch's Excel)*

**Excel columns:** Payment Identifier, Salary, Salary Credit Date, Beneficiary Name, Account Number, Debit Account Number, Transaction Serial Number, IFSC Code, Account Type, Contact Number.

**Errors:** "Select a month and at least one client", "Select a TPSS debit account", "Select at least one employee for payment".

**Bank Disbursement report** (Payroll › Bank Disbursement): choose a month whose paysheet is approved **and** whose invoice has been issued, then **Generate PDF + CSV** (Figures 19.4–19.5). The CSV's payment reference is the paysheet number plus the employee code; files generated in the sandbox are marked **SANDBOX**.

![Figure 19.4 — Disbursement](assets/screenshots/bank-disbursement/01-bank-disbursement-selected.png)
*Figure 19.4 — Bank Disbursement report*

![Figure 19.5 — Disbursement PDF](assets/screenshots/bank-disbursement/02-bank-disbursement-pdf.png)
*Figure 19.5 — Disbursement PDF*

## 20. Client billing and invoice generation

### 20.1 From a paysheet (recommended)
Open the approved paysheet → **Generate Invoice**. The form fills in from the client and the paysheet (Figure 20.1):
- **Billing lines** come from the client. **Set the Qty** to the number of guards or supervisors billed; it starts at 1. Above the lines the form shows the paysheet headcount by designation (for example "Paysheet headcount: S.GUARD 2 · SUPERVISOR 1") as a guide.
- **TDS %, GST applicable / RCM / GST % / GST type** come from the client.
- **Internal Deductions** (net salary, PF employer, ESI employer) come from the paysheet totals. They never appear on the client's copy.

![Figure 20.1 — Invoice from paysheet](assets/screenshots/invoices/01-invoice-create-from-paysheet.png)
*Figure 20.1 — Create Invoice from TEST-PS-SEP2026-001 (Qty 2 guards + 1 supervisor)*

### 20.2 Manual invoice
Invoices › Create Invoice → choose **Client** ("Client required" otherwise). At least one billing line is needed.

![Figure 20.2 — Manual validation](assets/screenshots/invoices/06-invoice-manual-validation.png)
*Figure 20.2 — "Client required"*

### 20.3 How the totals work (worked example)

| Line | Calculation | Amount (₹) |
|---|---|---:|
| Billing amount | 2 × 22,000 + 1 × 26,000 | 70,000.00 |
| GST 18 % (shown as CGST 9 % + SGST 9 %; for an IGST client, one IGST 18 % line) | 70,000 × 18 % | 12,600.00 |
| **Total Invoice Value** | 70,000 + 12,600 | **82,600.00** |
| TDS 1 % (deducted by client) | 70,000 × 1 % | −700.00 |
| **Amount Receivable** | 82,600 − 700 | **81,900.00** |
| Internal deductions | 41,268.33 + 5,980 + 1,495 | 48,743.33 |
| **Net Margin** (internal) | 81,900 − 48,743.33 | **33,156.67** |
| **Outstanding** | Receivable − received | 81,900.00 → 0 when paid |

Under RCM no GST is charged. Duties and days on billing lines are for display; the amount is **Qty × Rate / Month**. The due date defaults to invoice date + 30 days. The service period is the month.

**Invoice number:** `<prefix>/<financial year>/<serial>`, for example `TC1/26-27/001` (sandbox: `TEST-TC1/26-27/001`).

### 20.4 Save, issue, edit
- **Save Draft** keeps it editable. Draft invoices show an **Edit** button (Figures 20.3, 20.5). A draft cannot take payments (no **Record Payment** button) and is left out of the dashboard, reports, GST report, Statement of Account, Aging and Follow-ups until it is issued.
- **Save & Mark as Sent** issues it (status **Sent**).
- **Print** prints the client's tax invoice (Figure 20.4). Email sending is **not available** in the current version.

![Figure 20.3 — Draft](assets/screenshots/invoices/09-invoice-view-igst-draft.png)
*Figure 20.3 — Draft invoice for an IGST client: one "IGST @ 18 %" line, Place of Supply = client's state, internal summary (not printed), no Record Payment*

![Figure 20.4 — Sent](assets/screenshots/invoices/04-invoice-view-sent.png)
*Figure 20.4 — Sent invoice*

![Figure 20.5 — Draft with Edit in list](assets/screenshots/invoices/07-invoice-list-draft-edit.png)
*Figure 20.5 — Draft invoices have an Edit icon*

![Figure 20.6 — Edit draft](assets/screenshots/invoices/08-invoice-edit-draft.png)
*Figure 20.6 — Editing a draft keeps its saved lines*

**Statuses:** Draft → Sent → Partially paid → Paid; Overdue (set nightly when past due with a balance); Cancelled.

> ℹ️ **CGST + SGST or IGST** follows the client's **GST Type** (chapter 11). For IGST the invoice prints a single IGST line and the client's state as Place of Supply. A re-created invoice keeps the original GST type.

## 21. Client receipts and payment tracking

### Record a payment
- From an issued invoice: **Record Payment**, or
- **Finance › Receipts → Add Receipt** and select the invoice (Figure 21.1). Only issued invoices with a balance are listed.

| Field | Mandatory | Rule |
|---|:-:|---|
| Invoice | **Yes** | "Select an invoice first" |
| Date | Yes | default today |
| Amount | **Yes** | > 0 and ≤ outstanding ("Cannot exceed outstanding amount") |
| Mode | Yes | default NEFT |
| Reference / UTR, Bank, Notes | No | |

The receipt number (for example TEST-REC-OCT2026-002) is automatic. Each receipt posts a ledger entry and updates the invoice:
- Partial → **Partially paid**
- Full receivable → **Paid**, outstanding ₹0

![Figure 21.0 — Receipt validation](assets/screenshots/receipts/01-receipt-add-validation.png)
*Figure 21.0 — "Select an invoice first"*

![Figure 21.1 — Add receipt](assets/screenshots/receipts/02-receipt-add-completed.png)
*Figure 21.1 — ₹30,000 part payment*

![Figure 21.2 — Receipts list](assets/screenshots/receipts/03-receipt-list.png)
*Figure 21.2 — Receipts*

![Figure 21.3 — Receipt](assets/screenshots/receipts/04-receipt-view.png)
*Figure 21.3 — Printable receipt (outstanding ₹0.00)*

![Figure 21.4 — Paid invoice](assets/screenshots/invoices/05-invoice-view-paid.png)
*Figure 21.4 — Invoice Paid: received ₹81,900*

### Reverse a receipt (Super Admin)
Use this when a receipt was wrong (wrong amount or invoice, bounced cheque).
1. Open the receipt (Finance › Receipts → 👁) and click **Reverse Receipt**.
2. Enter a **reason of at least 10 characters**; **Confirm Reversal** stays disabled until then (Figure 21.4a).
3. Confirm. The receipt is marked reversed and disappears from lists, an offsetting ledger entry is posted, the invoice's received amount and status are recalculated (for example back to **Sent**), and the action is recorded in the audit log. You are taken back to the invoice.

This cannot be undone; record a new receipt if needed. After all of an invoice's receipts are reversed, the invoice can be cancelled (chapter 25).

![Figure 21.4a — Reverse receipt](assets/screenshots/receipts/05-receipt-reverse-dialog.png)
*Figure 21.4a — Reverse receipt dialog (opened for illustration, not confirmed)*

**Limitations:**
- One receipt applies to one invoice.
- There are no advance or unallocated receipts.
- Receipts cannot be edited; reverse and re-enter instead.

### Follow-ups
**Finance › Invoice Followups → Log Followup**:

| Field | Mandatory / values |
|---|---|
| Invoice | **Required** |
| Date | |
| Mode | Phone, … |
| Status | open, in_progress, promised, closed |
| Response / Notes | |
| Promise Date | |
| Next Followup | |

**Auto-sweep overdue** opens follow-ups for overdue invoices; a nightly job does the same. Follow-ups close automatically when an invoice is paid or cancelled. Draft invoices cannot be followed up. The list shows **open** follow-ups by default; choose **All** to see the rest.

![Figure 21.5 — Log follow-up](assets/screenshots/followups/01-followup-log-completed.png)
*Figure 21.5 — Logging a promised payment*

![Figure 21.6 — Follow-ups](assets/screenshots/followups/02-followup-list.png)
*Figure 21.6 — Follow-ups (filter: All)*

### Ageing
**Finance › Aging Report** (Figure 21.7): outstanding by client in Current / 1–30 / 31–60 / 61–90 / 90+ buckets as of a date, with **Export**. Only issued invoices are included.

![Figure 21.7 — Aging](assets/screenshots/finance/03-aging-report.png)
*Figure 21.7 — Receivables ageing*

## 22. Finance, expenses and vouchers

### 22.1 What exists
The portal has **no general voucher entry** (journal, contra, debit or credit note, purchase voucher). **This functionality was not found in the current implementation.** Ledger entries are created **automatically** by:

| Event | Ledger entry |
|---|---|
| Receipt saved | Receipt (credit), category *payment_received* |
| Expense approved | Payment (debit), category from the expense category |
| Compliance payment recorded | Payment (debit), category EPF / ESI / GST / PT … |
| Bank Payment salary batch finalised | Payment (debit), category *staff_salary* |
| Receipt reversed | Journal (debit) offsetting the receipt |

Issued invoices do not post to the ledger (it is a cash book). Each entry stores the running balance after it.

### 22.2 Expenses
**Menu:** Expenses › Expenses → **New Expense**

| Field | Mandatory |
|---|:-:|
| Date | **Yes** |
| Category | **Yes** ("Select category"). For general office costs use **OFFICE & ADMIN** |
| Amount (₹) | **Yes** (> 0) |
| Branch | No |
| Payment Mode (Cash / Bank / UPI / Card) | **Yes** |
| Reference / Bill # | No |
| Description | **Yes** |
| Submit as | Draft (default), or Approved (CEO / COO only) |

![Figure 22.1 — Expense validation](assets/screenshots/expenses/02-expense-new-validation.png)
*Figure 22.1 — "Select category"*

![Figure 22.2 — New expense](assets/screenshots/expenses/03-expense-new-completed.png)
*Figure 22.2 — ₹2,500 safety materials*

On the list, choose **Year / Month**. Drafts show **Approve** (CEO / COO / Super Admin; you cannot approve your own unless you are CEO or Super Admin). Approval posts the expense to the ledger. Expense numbers are automatic: `EXP-OCT2026-001` in production, `TEST-EXP-OCT2026-001` in the sandbox (the example below, EXP-SEP2026-001, was created before the TEST- prefix was added).

![Figure 22.3 — Draft](assets/screenshots/expenses/04-expense-list-draft.png)
*Figure 22.3 — Draft expense*

![Figure 22.4 — Approved](assets/screenshots/expenses/05-expense-list-approved.png)
*Figure 22.4 — "Expense approved & posted to ledger"*

### 22.3 Cash Book and Monthly Summary
- **Finance › Cash Book** (Figure 22.5): ledger entries between two dates with a running balance and totals. With a **From** date, the first row is the **opening balance** (all earlier entries) and the running balance continues from it.
- **Finance › Monthly Summary** (Figure 22.6): income and expense breakdown for a month, with **Export Excel (CA-ready)**.

![Figure 22.5 — Cash Book](assets/screenshots/finance/01-cash-book.png)
*Figure 22.5 — Cash Book from 01-09-2026: opening balance ₹17,998.20 (earlier sandbox entries), this period's net ₹26,631.67, closing ₹44,629.87. Totals (credits ₹83,900, debits ₹57,268.33) also include two ₹1,000 test receipts and their reversals, which cancel out*

![Figure 22.6 — Monthly Summary](assets/screenshots/finance/02-monthly-summary.png)
*Figure 22.6 — Monthly Summary (October 2026)*

### 22.4 Employee advances and Full & Final
- **Advances** (Employee Lifecycle › Advances):
  - **New Advance**: Employee, Type, Advance Date, Recovery Start Month, Total, Monthly Deduction, Reason (≤ 500 characters). The company's advance limit is checked.
  - Requests are **Pending** until a CEO or COO approves them in **Advance Approvals**. They then become **Active** and are recovered through paysheets until **Fully recovered**.
- **Uniform Adv. Confirm**: confirm uniform-advance deductions created when a paysheet is approved.
- **Full & Final** (Employee Lifecycle › Full & Final → New FFS):
  - Employee, reason, relieving date and last working day, then earned wages, bonus, leave encashment, gratuity basic and deductions.
  - **Save** (draft) or **Submit**. **FFS Approvals** (CEO / COO) approves it, optionally recording the payment.
  - Approval sets the employee to **Relieved** and closes active advances. A PDF is available.

![Figure 22.7 — Advances](assets/screenshots/lifecycle/01-advances-list.png)
*Figure 22.7 — Advances*

![Figure 22.8 — New advance](assets/screenshots/lifecycle/02-advance-new-blank.png)
*Figure 22.8 — New Advance Request*

![Figure 22.9 — New FFS](assets/screenshots/lifecycle/06-ffs-new-blank.png)
*Figure 22.9 — New Full & Final settlement*

![Figure 22.10 — Advance approvals](assets/screenshots/lifecycle/03-advance-approvals.png)
*Figure 22.10 — Advance Approvals (CEO / COO)*

![Figure 22.11 — Uniform advance confirmations](assets/screenshots/lifecycle/04-uniform-advance-confirm.png)
*Figure 22.11 — Uniform Advance Confirmations*

![Figure 22.12 — FFS list](assets/screenshots/lifecycle/05-ffs-list.png)
*Figure 22.12 — Full & Final Settlements*

![Figure 22.13 — FFS approvals](assets/screenshots/lifecycle/07-ffs-approvals.png)
*Figure 22.13 — FFS Approvals*

*(Advances and FFS were not exercised with sample data; they are documented from the application logic.)*

## 23. Monthly operational cycle

| When | Step | Chapter |
|---|---|---|
| Month start | Check new joiners, deployments, contract expiries | 14, 15, 13 |
| After month end | Create paysheet per client, enter duties, submit | 17 |
| | Approve paysheets | 17.3 |
| | Bank payment batch → upload Excel at bank | 19 |
| | Payslips, statutory PDFs, ECR / ESI files | 17.5, 18 |
| | Generate and issue invoices | 20 |
| By statutory due dates | Pay PF / ESI / PT, record compliance payments | 18.3 |
| Through the month | Record receipts, follow up overdue invoices | 21 |
| | Record and approve expenses | 22 |
| Month close | Review Cash Book, Monthly Summary, Aging, GST report | 22, 24 |

There is no "close month" or lock. Approved paysheets and receipts cannot be edited, which provides most of that protection.

## End-to-End Monthly Example — Test Client 1, September 2026

1. **Client** Test Client 1 (CLT-037): GST 18 %, TDS 1 %, PF / ESI / PT on. S.GUARD 12,000 + 3,000 DA; SUPERVISOR 15,000 + 3,000 DA; washing 500; uniform 300. Billing ₹22,000 per guard and ₹26,000 per supervisor (Figure 11.2).
2. **Contract** CNT-CLT-037-001, 01-04-2026 to 31-03-2027 (Figure 13.3). **Shift** Test Day Shift (Figure 10.2).
3. **Employees** EMP-192 and EMP-193 (S.GUARD), EMP-194 (SUPERVISOR, new joiner), all **deployed** to Test Client 1 (Figure 15.3).
4. **Paysheet** TEST-PS-SEP2026-001, duties 30 / 26 / 30:

| Employee | Earned | EPF EE | ESI EE | PT | Final net |
|---|---:|---:|---:|---:|---:|
| Test Employee 1 | 15,500.00 | 1,800.00 | 112.50 | 150 | 13,437.50 |
| Test Employee 2 (26 duties) | 13,433.33 | 1,560.00 | 97.50 | 0 | 11,775.83 |
| Test Employee 3 | 18,500.00 | 2,160.00 | 135.00 | 150 | 16,055.00 |
| **Total** | **47,433.33** | **5,520** | **345** | **300** | **41,268.33** |

   Employer cost: EPF ₹5,980, ESI ₹1,495. Example for Test Employee 1: (15,800 − 300) ÷ 30 × 30 = 15,500; EPF 12 % of 15,000 = 1,800.
5. **Approved** (Figure 17.12). **Bank payment** batch for ₹41,268.33; all three Paid (Figure 19.2). **Payslips** (Figure 17.14).
6. **Statutory:** PF statement ₹46,000 wages / ₹11,500 contributions (Figure 18.2); ECR and ESI files (Figures 18.6–18.7); EPF paid ₹11,500 on challan TEST-CHLN-EPF-001 (Figure 18.10).
7. **Invoice** TEST-TC1/26-27/001 from the paysheet: ₹82,600 total, ₹81,900 receivable, net margin ₹33,156.67 (Figure 20.1).
8. **Receipts:** ₹30,000 (Partially paid), then ₹51,900 (Paid, outstanding ₹0) (Figures 21.1–21.4).
9. **Expense** EXP-SEP2026-001 ₹2,500, approved (Figure 22.4).
10. **Cash Book** for this client's month: in ₹81,900 (two receipts); out ₹55,268.33 (salary batch ₹41,268.33 + EPF ₹11,500 + expense ₹2,500); net ₹26,631.67 (Figure 22.5).
11. **October** manual invoice issued, followed up, then corrected by cancel and re-create (chapter 25). The re-created invoice TEST-TC1/26-27/003 (₹81,900 receivable) is outstanding, which is the Statement of Account's closing balance (Figure 24.8).

## 24. Reports and dashboards

| Report | Menu | Filters | Exports | Notes |
|---|---|---|---|---|
| Dashboard | Overview | Branch (CEO+) | — | Money cards are labelled **"(by billing month)"**: they cover invoices of this billing month, not cash dates. Issued invoices only (drafts and cancelled excluded) |
| Financial / MoM / Comparative | Reports | Metric, branch, client, months | Excel | Client filter keeps figures to one client. Issued invoices only; cancelled paysheets excluded. Employee Count is a plain number |
| Client History | Reports | Client\*, dates | Excel, PDF | Invoice-by-invoice billing, margin, received, outstanding |
| Employee History | Reports | Employee\*, dates | Excel (all tabs), PDF | Payroll, advances, deployments |
| Annual Summary (CA-ready) | Reports | Financial year, branch | Excel, PDF | Invoice and payment registers, payroll, EPF / ESI, expenses, P&L |
| Statutory Documents | Reports | Month\*, clients\* | PDF / ZIP | Ch. 18 |
| Cash Book, Monthly Summary, Statement of Account, Aging, GST | Finance | Dates / month / client | Excel / PDF | Ch. 21–22. **Statement of Account**: each invoice is followed by a "TDS deducted by client" credit line, so the closing balance equals what the client still owes. **GST report**: issued invoices only, with CGST / SGST / IGST columns; **Export GST summary (for GSTR-1)** adds SAC, client GSTIN and place of supply |

![Figure 24.1 — Dashboard after the month](assets/screenshots/dashboard/02-dashboard-after-scenario.png)
*Figure 24.1 — Dashboard (October)*

![Figure 24.2 — Client History](assets/screenshots/reports/01-client-history.png)
*Figure 24.2 — Client Billing History*

![Figure 24.3 — Employee History](assets/screenshots/reports/02-employee-history.png)
*Figure 24.3 — Employee Consolidated History*

![Figure 24.4 — MoM](assets/screenshots/reports/03-mom-analysis.png)
*Figure 24.4 — Month-on-Month Analysis*

![Figure 24.5 — Comparative](assets/screenshots/reports/04-comparative.png)
*Figure 24.5 — Comparative (September vs October)*

![Figure 24.6 — Annual Summary](assets/screenshots/reports/05-annual-summary.png)
*Figure 24.6 — Annual Summary*

![Figure 24.7 — GST](assets/screenshots/finance/04-gst-report.png)
*Figure 24.7 — GST Report (October)*

![Figure 24.8 — Statement](assets/screenshots/finance/05-statement-of-account.png)
*Figure 24.8 — Statement of Account*

![Figure 24.9 — Statement PDF](assets/screenshots/finance/06-statement-of-account-pdf.png)
*Figure 24.9 — Statement of Account PDF*

![Figure 24.10 — Branch Summary](assets/screenshots/admin/07-branch-summary.png)
*Figure 24.10 — Administration › Branch Summary (per-branch snapshot; CEO / Super Admin)*

### CRM — sales leads
**Menus:** CRM › CRM Dashboard, Leads Pipeline, New Lead.
- **Website enquiries** ("Request a Quote" on the public site) create a lead automatically and notify CEO and Super Admin users.
- **New Lead** (Figure 24.13):
  - **Required:** Contact Person Name\*, Company Name\*, Phone\*.
  - **Optional:** requirement (category, number of guards, expected value, expected closure date), source, priority, status, assigned to, next follow-up.
  - The lead number (for example LEAD-2026-0001) is automatic.
- **Lead detail:**
  - **Log Activity:** notes required; contact mode; outcome; next follow-up.
  - **Add Quotation:** summary required; reference, date, value, status.
  - **Close Lead:** won or lost, with a reason; a win summary or closure remarks are required.
- **Statuses:** see chapter 33.

![Figure 24.11 — CRM dashboard](assets/screenshots/crm/01-crm-dashboard.png)
*Figure 24.11 — CRM Dashboard (a real enquiry is hidden)*

![Figure 24.12 — Leads pipeline](assets/screenshots/crm/02-leads-pipeline.png)
*Figure 24.12 — Leads Pipeline*

![Figure 24.13 — New lead](assets/screenshots/crm/03-lead-new-blank.png)
*Figure 24.13 — New Lead form*

**Worked example — LEAD-2026-0002 "Test Prospect (Synthetic)"** (all details synthetic):
1. **New Lead**: contact, company, phone, 4 guards, expected value ₹96,000 → **Create Lead** ("Lead LEAD-2026-0002 created", Figure 24.14). The lead opens in its detail page (Figure 24.15).
2. **Log Activity**: activity type (Call Made), contact mode, **Discussion Notes\***, outcome, next action, next follow-up date → **Log Activity** ("Activity logged", Figure 24.16).
3. **Add Quotation**: reference, date, value, status (Draft / Submitted / …), **Summary\*** → **Save Quotation** ("Quotation saved", Figure 24.17). Activity and quotation appear on the detail page.
4. **Close Lead**: **Won** or **Lost**, **reason\*** from the list, closure date, **Win Summary\*** (or Remarks for a loss), optional competitor and contributing factors → **Mark as Won** ("Lead marked as WON", Figures 24.19–24.20).

Each step adds an entry to the lead's **Activity Timeline**.

![Figure 24.14 — New lead completed](assets/screenshots/crm/04-lead-new-completed.png)
*Figure 24.14 — New Lead form filled in*

![Figure 24.15 — Lead detail](assets/screenshots/crm/05-lead-detail.png)
*Figure 24.15 — Lead detail with Log Activity, Add Quotation and Close Lead*

![Figure 24.16 — Log Activity](assets/screenshots/crm/06-log-activity-dialog.png)
*Figure 24.16 — Log Activity*

![Figure 24.17 — Add Quotation](assets/screenshots/crm/07-add-quotation-dialog.png)
*Figure 24.17 — Add Quotation*

![Figure 24.19 — Close Lead](assets/screenshots/crm/09-close-lead-dialog.png)
*Figure 24.19 — Close Lead as Won*

![Figure 24.20 — Lead won](assets/screenshots/crm/10-lead-closed-won.png)
*Figure 24.20 — Closed lead (Won) with reason, summary, quotation and the Activity Timeline (newest first)*

**Interpreting mismatches:**
- **Statement of Account** shows the TDS the client withholds as a separate credit line, so "Total Received" (cash) plus TDS equals what was billed and paid off.
- **GST summary (for GSTR-1)** is a summary workbook. Prepare the portal return from it; don't upload it directly.
- The **Dashboard's** "(by billing month)" cards count receipts against invoices of that billing month, not money received in that month. Use the Cash Book for cash dates.
- **Drafts** never appear in summaries, the Statement, Aging or the GST report; issue the invoice first.

## 25. Corrections, cancellations, reversals and reprocessing

| Situation | What to do | Who |
|---|---|---|
| Paysheet still Draft or Rejected | Edit and resubmit | Creator |
| Paysheet approved but wrong | **Cancel Paysheet** (reason ≥ 10 characters), then **Re-create Paysheet** (new draft, rows copied) | Super Admin |
| Paysheet has an issued invoice | Tick "Also cancel linked invoice" | Super Admin |
| Invoice Draft | Edit | Accountant + |
| Invoice issued, no receipts | **Cancel Bill** (reason ≥ 10 characters), then **Re-create Invoice** → edit the new draft → Mark as Sent | Super Admin |
| Invoice has receipts | **Reverse each receipt** (chapter 21), then Cancel Bill and Re-create | Super Admin |
| Wrong receipt | **Reverse Receipt** (reason ≥ 10 characters), then record the correct receipt | Super Admin |
| Expense wrong | Only drafts are editable; approved expenses cannot be reversed | — |

### Worked example: cancel and re-create an invoice
1. Open the invoice → **Cancel Bill**. Confirm stays disabled until the reason has 10 characters (Figure 25.1).
2. Enter the reason → **Confirm Cancel** (Figure 25.2). The status becomes **cancelled**, ledger entries for the invoice are reversed and follow-ups are closed (Figure 25.3).
3. Click **Re-create Invoice**. A new draft opens with the same lines (Figure 25.4).
4. Correct it if needed → **Save & Mark as Sent**. A new number is issued (Figure 25.5).

![Figure 25.1](assets/screenshots/corrections/01-invoice-cancel-dialog-short-reason.png)
*Figure 25.1 — Reason too short*

![Figure 25.2](assets/screenshots/corrections/02-invoice-cancel-dialog-ready.png)
*Figure 25.2 — Ready to cancel*

![Figure 25.3](assets/screenshots/corrections/03-invoice-cancelled.png)
*Figure 25.3 — Cancelled invoice with Re-create button*

![Figure 25.4](assets/screenshots/corrections/04-invoice-recreated-draft-edit.png)
*Figure 25.4 — Re-created draft*

![Figure 25.5](assets/screenshots/corrections/05-invoice-recreated-sent.png)
*Figure 25.5 — Replacement invoice TEST-TC1/26-27/003 sent*

### Paysheet cancellation blocked
![Figure 25.6](assets/screenshots/corrections/06-paysheet-cancel-linked-invoice.png)
*Figure 25.6 — "Linked invoice exists. Tick the cascade option to cancel both."*

![Figure 25.7](assets/screenshots/corrections/07-paysheet-cancel-receipts-exist.png)
*Figure 25.7 — "Linked invoice has receipts. Reverse them first." Reverse the receipts (chapter 21), then retry.*

## 26. Audit trail and record history

- **Administration › Audit Logs** (Super Admin; Figure 26.1): sign-ins, creates, updates, approvals, cancellations, role changes and exports, with time, table, record and user. Users appear by name; records appear as IDs. Receipt reversals appear as REVERSE_PAYMENT.
- **Administration › Activity Log** (Super Admin; Figure 26.2): sign-ins, sign-outs, failed sign-ins and exports, filtered by user, type, dates and IP.
- **Administration › Backups** (Figure 26.3): automatic backup on the 1st of each month. Download is available.
- Records keep *created by / approved by / cancelled by* with timestamps. A cancelled document keeps a link to its replacement.

![Figure 26.1](assets/screenshots/admin/03-audit-logs.png)
*Figure 26.1 — Audit Logs*

![Figure 26.2](assets/screenshots/admin/05-activity-log.png)
*Figure 26.2 — Activity Log (IP addresses masked)*

![Figure 26.3](assets/screenshots/admin/06-backups.png)
*Figure 26.3 — Backups*

## 27. Imports and exports

| Export | Where | Format |
|---|---|---|
| Clients, Employees | Masters lists → Export | CSV |
| Paysheet | Paysheet view → Excel | XLSX (33 columns) |
| Bank payment file | Payroll › Bank Payment | XLSX |
| Disbursement | Payroll › Bank Disbursement | PDF + CSV |
| Payslips, statutory documents | Payroll / Reports | PDF (ZIP for several clients) |
| ECR / ESI challan | Compliance | TXT / XLSX |
| GST, Aging, Monthly Summary, Statement, histories, MoM, Comparative, Annual | Finance / Reports | XLSX and / or PDF |
| Compliance payments, Expenses | Lists → Export | XLSX |

**Imports:** none in the application. Duty or paysheet upload is a placeholder.

## 28. Troubleshooting and common errors

| Message / symptom | Cause | Fix |
|---|---|---|
| Taken to the sign-in page when returning to a tab | Your session was ended (timeout, deactivation) | Sign in again |
| "A user with the email … already exists" | Email in use | Use another email |
| "Client name is required" on client save | Client name empty | Enter a name |
| "UAN must be exactly 12 digits" | Format | 12 digits |
| "IFSC must be 11 characters…" (TPSS Bank Accounts) | Wrong IFSC format | Use `AAAA0XXXXXX`, e.g. SBIN0001234 |
| "Reversal reason must be at least 10 characters" | Short reason | Write more |
| "Select a client first" / "Client required" | Missing selection | Choose the client |
| Red blocker on paysheet | Missing UAN / ESI number | Fix the employee master |
| "Cannot approve your own submission" | Segregation of duties | Another approver |
| "Reason must be 10–200 characters" | Short reject reason | Write more |
| "Cannot exceed outstanding amount" | Receipt larger than balance | Check the amount |
| Bank Payment shows no month | No approved paysheet | Approve first |
| Bank Disbursement shows no month | Invoice not issued | Mark the invoice as Sent |
| ECR shows 0 paysheets | Paysheet not approved for that month | Approve; choose the right month |
| "Linked invoice has receipts. Reverse them first." | Invoice paid | Super Admin reverses the receipts (chapter 21), then retries |
| Generate PDF greyed out | Client / month not chosen | Choose both |
| Expense list empty | Wrong Year / Month filter | Change the filter |

## 29. Frequently asked questions

**Can I change PF / ESI / PT rates?** No. They are built into the application (chapter 17.2).

**Why does the invoice show CGST + SGST for an out-of-state client?** Set the client's **GST Type** to IGST (chapter 11). New invoices then print IGST.

**Why is my October dashboard "Received" zero although money came in?** The cards are "(by billing month)": they group by invoice billing month. Use the Cash Book for money received by date.

**Why doesn't my new invoice show on the dashboard or Statement?** It is still a draft. Mark it as Sent.

**Can I email invoices?** Not in the current version. Print or save as PDF.

**How do I move a guard to another client?** Relieve the deployment, then create a new one (chapter 15).

**Can I undo an approval?** Paysheets: Super Admin can cancel and re-create. Receipts: Super Admin can reverse them. Expenses: no.

## 30. Glossary

| Term | Meaning |
|---|---|
| Paysheet | Monthly payroll sheet for one client |
| Duties | Days worked in the month |
| Earned wages | Pay for duties worked (excluding uniform allowance) |
| Final net | Take-home after statutory and other deductions |
| EPF / EE / ER | Provident Fund / employee share / employer share |
| ESI | Employees' State Insurance |
| PT | Professional Tax |
| TDS | Tax deducted at source by the client on invoices |
| RCM | GST reverse charge: the client pays GST, so none is charged on the invoice |
| Receivable | Invoice total minus TDS: what the client pays |
| Net margin | Receivable minus internal costs (salaries, employer PF / ESI) |
| ECR | Electronic Challan-cum-Return for EPFO |
| FFS | Full & Final settlement |
| Sandbox | Training environment |

## 31. Role-permission matrix

See chapter 9 and **`ROLE_PERMISSION_MATRIX.md`** (menu visibility, screen permissions and server-enforced actions per role).

## 32. Field reference appendix

Field tables appear in chapters 8 (users), 11 (clients), 13 (contracts), 14 (employees), 15 (deployments), 18.3 (compliance payments), 19 (bank payment), 20 (invoices), 21 (receipts and follow-ups) and 22 (expenses, advances, FFS). Mandatory fields were confirmed in the application.

## 33. Status and workflow appendix

| Record | Statuses and transitions |
|---|---|
| Paysheet | Draft → Submitted → Approved / Rejected (→ Draft); any → Cancelled (Super Admin) |
| Invoice | Draft → Sent → Partially paid → Paid; Sent / Partially paid → Overdue (nightly); a receipt reversal moves it back (Paid → Partially paid / Sent / Overdue); → Cancelled (Super Admin, once no receipts remain) |
| Receipt | Recorded → Reversed (Super Admin, reason required) |
| Client site | Active ↔ Inactive |
| Paysheet employee payment | Unpaid → Partial → Paid (via Bank Payment) |
| Expense | Draft → Approved |
| Advance | Pending → Active → Fully recovered; Rejected; Cancelled |
| FFS | Draft → Submitted → Approved / Paid |
| Contract | Active → Renewed / Expired / Terminated |
| Follow-up | Open → In progress → Promised → Closed |
| Compliance task | Pending → In progress → Completed; Overdue |
| Uniform advance confirmation | Pending → Confirmed |
| CRM lead | New → Contacted → Qualified → Site visit planned → Proposal pending → Quotation submitted → Negotiation → On hold → Won / Lost / Closed |
| Employee | Active → Relieved / Absconded |

## 34. Known limitations

- No attendance or roster, duty import, general vouchers, month-end lock, invoice email, or user-to-branch / client access restriction.
- No manpower requirement per site; invoice quantities are typed (the paysheet headcount is shown as a guide).
- Statutory rates and rules are built in, as decided by the owner. Verify the ECR / ESI files before upload (chapter 18.2).
- Issued invoices are not posted to the ledger (it is a cash book).
- Receipts cannot be edited (reverse and re-enter); approved expenses cannot be reversed.
Details and severity: `DOCUMENTATION_FINDINGS.md`.

## 35. Support and escalation information

| Issue | Contact |
|---|---|
| Sign-in, roles, new users | Super Admin |
| Payroll / statutory rules | CEO / COO, then your statutory consultant |
| Wrong figures or errors not listed in chapter 28 | Super Admin. Note the screen, the record number, the exact message and the time |
| Application defects | Development team. Reference the finding ID in `DOCUMENTATION_FINDINGS.md` if listed |

*End of manual.*
