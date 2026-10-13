# Role & Permission Matrix

> Phase 1 discovery output, 2026-10-12. Built from the implementation, not from assumptions.
>
> **Verification:** Super Admin rows were exercised in the sandbox UI. CEO restrictions were verified by database role simulation (rolled-back transaction). COO and Accountant are **traced in code and database, not verified in the UI**: no test users exist by decision of the product owner.

## 1. Roles that exist

| Role (UI label) | Internal value | Purpose | Users today |
|---|---|---|---|
| Super Admin | `super_admin` | System administration + everything the CEO can do | 1 (Krishna) in sandbox and production |
| CEO | `ceo_admin` | Full business access; final approver | 0 |
| COO / Operations | `coo_ops` | Operations, approvals, deployments, contracts | 0 |
| Accountant | `accountant` | Data entry: paysheets, invoices, receipts, expenses, advance requests | 0 |

No other roles exist. "HR/payroll user", "site supervisor", "read-only/audit user" from the brief **do not exist** in this product.

## 2. How access is enforced (three layers)

1. **Menu and page guards** — hard-coded role lists in the sidebar and routes. Super Admin passes every guard.
2. **Screen permissions** — the **Role Permissions** screen (`role_permissions` table): View / Create / Edit / Delete / Approve / Export per role per screen. Only some screens consult it (marked ✱ below). Super Admin and CEO always pass on the server; Super Admin always passes in the UI.
3. **Database rules** — row-level security and server functions. These are the final authority; a button may be visible but the server can still refuse.

> **Important for administrators:** turning a permission off in *Role Permissions* only affects screens that read it (✱). Many screens are controlled only by the fixed role lists in layers 1 and 3 and cannot be changed from the UI.

## 3. Menu / page visibility (layer 1)

| Menu item | Super Admin | CEO | COO | Accountant |
|---|:-:|:-:|:-:|:-:|
| Dashboard ✱ | ✓ | ✓ | ✓ | ✓ |
| Clients ✱, Employees ✱ | ✓ | ✓ | ✓ | ✓ |
| Company Profile | ✓ | ✓ | — | — |
| Branches, Shifts | ✓ | ✓ | ✓ | — |
| Deployments, Contracts | ✓ | ✓ | ✓ | ✓ |
| Advances, Full & Final | ✓ | ✓ | ✓ | ✓ |
| Advance Approvals, FFS Approvals | ✓ | ✓ | ✓ | — |
| Uniform Adv. Confirm | ✓ | ✓ | ✓ | ✓ |
| Create Paysheet ✱, Monthly Paysheets ✱ | ✓ | ✓ | ✓ | ✓ |
| Approval Queue | ✓ | ✓ | ✓ | — |
| Bank Payment, Payslips, Bank Disbursement | ✓ | ✓ | ✓ | ✓ |
| All Invoices, Create Invoice | ✓ | ✓ | ✓ | ✓ |
| Finance (Cash Book, Monthly Summary, Receipts, Statement, Aging, GST, Followups) | ✓ | ✓ | ✓ | ✓ |
| Reports (MoM, Comparative, Client History, Employee History, Annual Summary) | ✓ | ✓ | ✓ | ✓ |
| Statutory Documents | ✓ | ✓ | ✓ | ✓ |
| Expenses | ✓ | ✓ | ✓ | ✓ |
| Compliance Calendar ✱ | ✓ | ✓ | ✓ | ✓ |
| Compliance Payments, ECR / ESI Challan | ✓ | ✓ | ✓ | ✓ |
| CRM Dashboard ✱, Leads Pipeline ✱, New Lead ✱ | ✓ | ✓ | ✓ | ✓ |
| User Management, Role Permissions, Audit Logs, Activity Log, Backups | ✓ | — | — | — |
| Branch Summary, Expense Categories, Branches Management, TPSS Bank Accounts | ✓ | ✓ | — | — |

## 4. Screen permissions as configured today (layer 2)

V = View, C = Create, E = Edit, D = Delete, A = Approve, X = Export. Values from the sandbox `role_permissions` table (production seeded identically by migration; confirm before go-live). CEO and Super Admin bypass this table on the server.

| Screen | CEO | COO | Accountant |
|---|---|---|---|
| dashboard ✱ | VCEDAX | VX | V |
| clients ✱ | VCEDAX | VAX | V |
| employees ✱ | VCEDAX | VAX | V |
| payroll ✱ | VCEDAX | VAX | VCE |
| compliance ✱ | VCEDAX | VAX | V |
| crm_dashboard ✱ | VX | V | V |
| crm_leads ✱ | VCEDAX | VCEX | V |
| bank_payment | VCEDAX | VCEDAX | VCEDAX |
| payslips | VCEDAX | VCX | VCX |
| salary_register, pf_statement, esi_statement, pt_report | VCEDAX | VCEDAX | VCX |
| expenses | VCEDAX | VAX | VCE |
| full_and_final_settlement | VCEDAX | VA | V |
| uniform_advance | VCEDAX | VCEDAX | VA |
| canteen_deductions | VCEDAX | VCEDAX | V |
| reports, reports_mom, reports_comparative, reports_client_history, reports_employee_history | VX / VCEDAX | VX | V / VX |
| reports_annual | VX | — | VX |
| company_profile | VCEDAX | VX | — |
| users, permissions | VCEDAX (now Super Admin only via layers 1 & 3) | — | — |
| audit_logs, activity_log | VX (now Super Admin only via layers 1 & 3) | — | — |
| branch_summary, branches_admin | VX / VCEX | — | — |

✱ = screens whose UI actually reads this table. Rows without ✱ exist in the table but the UI does not consult them (see GAPS_AND_ASSUMPTIONS.md, G-07).

## 5. Business actions enforced on the server (layer 3)

| Action | Super Admin | CEO | COO | Accountant | Extra rule |
|---|:-:|:-:|:-:|:-:|---|
| Invite users, change roles, edit others' profiles | ✓ | — | — | — | |
| Edit Role Permissions | ✓ | — | — | — | |
| Read audit logs, activity log, backups | ✓ | — | — | — | |
| Wipe sandbox / change environment config | ✓ | — | — | — | Sandbox only |
| Cancel invoice | ✓ | — | — | — | Reason ≥ 10 chars; blocked while receipts exist (reverse them first) |
| Reverse receipt | ✓ | — | — | — | `reverse_payment()`; reason ≥ 10 chars; posts a ledger journal, recalculates the invoice, audited |
| Re-create cancelled invoice / paysheet | ✓ | — | — | — | Only once per cancelled record |
| Cancel paysheet | ✓ | — | — | — | Reason ≥ 10 chars; linked invoice must be cancelled first or cascaded |
| Create paysheet (draft) | ✓ | ✓ | — | ✓ | Insert policy allows Accountant + CEO only |
| Approve / reject paysheet | ✓ | ✓ | ✓ | — | Only *submitted*; COO cannot approve own submission; reject reason 10–200. These checks run only when a paysheet becomes approved |
| Edit submitted/approved paysheet | ✓ | ✓ | ✓ | — | Accountant blocked once submitted |
| Request advance | ✓ | ✓ | — | ✓ | Advance limit enforced |
| Approve / reject advance | ✓ | ✓ | ✓ | — | Cannot approve own request (unless CEO) |
| Cancel advance | own / CEO+ | ✓ | own | own | |
| Save / submit FFS | ✓ | ✓ | ✓ | ✓ | |
| Approve FFS | ✓ | ✓ | ✓ | — | Cannot approve own (unless CEO); sets employee Relieved |
| Create deployment / relieve / contract / renew | ✓ | ✓ | ✓ | — | Deployment may name a client site |
| Add / activate / deactivate client sites | ✓ | ✓ | ✓ | — | `client_posts` RLS (CEO/COO; Super Admin counts as CEO); sites are never deleted |
| Edit client billing lines | ✓ | ✓ | per Role Permissions (clients edit/create) | per Role Permissions | `replace_client_billing_lines()` checks the same permission |
| Delete branch | ✓ | ✓ | ✓ | — | `soft_delete_branch()`; refused while clients or employees are linked |
| Create / edit invoice | ✓ | ✓ | ✓ | ✓ | |
| Record receipt (payment) | ✓ | ✓ | ✓ | ✓ | Amount > 0, ≤ outstanding |
| Record expense | ✓ | ✓ | ✓ | ✓ | |
| Approve expense | ✓ | ✓ | ✓ | — | Cannot approve own (segregation of duties) |
| Record compliance payment, compliance tasks, followups | ✓ | ✓ | ✓ | ✓ | |
| Seed compliance calendar | ✓ | ✓ | ✓ | — | |
| Bank payment batch | ✓ | ✓ | ✓ | ✓ | |
| Manage expense categories | ✓ | ✓ | — | — | |
| Manage TPSS bank accounts | ✓ | ✓ | — | — | Accountant can view; IFSC format checked |

## 6. Restrictions on one's own account

- Users can read and update their **own** profile row; only Super Admin can edit others.
- The **last active Super Admin** cannot be demoted, deactivated or removed (server trigger `guard_last_super_admin`), and the User Management screen does not let you change your own row. (Fixed 13 Oct 2026, OF-01; previously this could lock everyone out — GAPS_AND_ASSUMPTIONS.md, G-12.)
