# Testing checkpoint

Updated at the end of every phase. No secrets or business data here.

## Phases

| Phase | Scope | Status | Owner approval |
|---|---|---|---|
| 1 | Discovery and test plan (read-only) | Done 2026-10-16 | Reviewed |
| 2 | Safe automation foundation | Done 2026-10-16 (commit c887c5f, local) | Approved |
| 3 | Smoke and core-workflow suite | Done 2026-10-16 (commit 487e7f4, local) | Approved |
| 4 | Functional and business-rule regression | Workflows done 2026-10-16, **awaiting review** (uncommitted). Calculation assertions blocked on questions 1–6 | Approved |
| 5 | Security and data isolation | Not started | — |
| 6 | Reusable runner, optional pipeline | Not started | — |
| 7 | Optional production read-only checks | Not started | Needs separate production approval |

## Architecture (confirmed in Phase 1)

- Sandbox and production are **separate deployments with separate databases**:
  - sandbox: `tpss-security-sandbox.pages.dev` with project `femkwbgjvsdnxnihptiu`, database environment `sandbox`;
  - production: portal / www with project `ihmyqifzhwnxhiltafkn`, database environment `production`.
- The app's "sandbox" label comes from the web address (localhost counts as sandbox). The database a
  build uses comes from build settings. Tests therefore check the **database**, never just the address.
- Roles: `super_admin` (counts as CEO everywhere), `ceo_admin` (bypasses the permission table),
  `coo_ops`, `accountant`.
- Real email is sent only by Add User (invitation) and Forgot password. Both are blocked in tests.

## Sandbox data policy (owner decision 2026-10-16)

- The sandbox holds **real** client and employee data and is kept that way for user training
  (from the week of 2026-10-19). The four monthly backup files in sandbox storage are kept.
- Therefore browser tests save **no page content**: no screenshots, videos or traces, and no
  page-text snapshot (`PLAYWRIGHT_NO_COPY_PROMPT`, plus `tests/support/redact-reporter.ts`, which deletes
  any such attachment before reports are written). Evidence = error message, step, network-guard log.
- Data checks by Claude report counts only, never names or numbers.
- Don't run tests that create data during training hours.

## Commands

| Command | What it runs |
|---|---|
| `npm run test:smoke` | Phase 3 smoke + workflow suite: API, then browser (sandbox) |
| `npm run test:regression` | Phase 4: unit maths/exports + API payroll, invoices, receipts, advances, expenses, reports, export endpoint (sandbox) |
| `npm run test:unit` | Unit tests (no network) |
| `npm run test:api` | All API/database tests (sandbox) |
| `npm run test:e2e` | All browser tests (private dev server on port 8090, sandbox) |
| `npm run test:foundation` | Safety checks of all three kinds |
| `npm run test:report` | Opens the latest browser report |
| `npm test` | The original placeholder test (unchanged) |

Settings live in `tests/.env.test.local` (gitignored). The template is `tests/.env.test.example`.

## Last run (2026-10-16, Phase 4 final, all in this session)

| Suite | Passed | Failed | Todo | Notes |
|---|---|---|---|---|
| Unit (incl. payroll/invoice preview maths, Excel/CSV exports) | 42 | 0 | 7 | Todos = statutory rules awaiting owner (questions 1–6) |
| API / database (all) | 56 | **4** | 5 | The 4 failures are app defects D-6, D-7, D-8, D-9 (tests left failing on purpose) |
| Browser (all) | 28 | 0 | 0 | No page-content files saved |

## Earlier run (2026-10-16 22:17, Phase 3 final)

| Suite | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|
| Unit | 28 | 0 | 0 | Safety guards and cleanup |
| API / database (foundation + smoke + workflow) | 36 | 0 | 0 | Run T20261016-2217-5896 |
| Browser (foundation + smoke + workflow) | 28 | 0 | 0 | No page-content files saved |
| Negative: runner pointed at production (Phase 2) | — | — | — | Both runners refused to start |

Earlier in this session, S-05 "passed" while the QA Super Admin account had no role: every screen showed
"No role assigned". That result is **void**. The test now requires the real app layout on every screen,
and the account check (FND-07) verifies each test account's role.

## Test accounts

Five sandbox-only accounts, created by the owner (auto-confirmed, no email sent). Roles were assigned by
Claude with owner approval (sandbox database, audit-log `ROLE_CHANGE` rows). **Recreating an account in
Supabase removes its role.** FND-07 now catches that; ask Claude to re-apply the role.

| Account | Role | Active |
|---|---|---|
| admin+qa-super@tpsssecurity.com (QA Super Admin) | super_admin | yes |
| admin+qa-ceo@tpsssecurity.com (QA CEO) | ceo_admin | yes |
| admin+qa-coo@tpsssecurity.com (QA COO) | coo_ops | yes |
| admin+qa-accountant@tpsssecurity.com (QA Accountant) | accountant | yes |
| admin+qa-inactive@tpsssecurity.com (QA Inactive) | accountant | **no** (deactivated) |

Passwords (8+ characters, the login form's minimum) live only in `tests/.env.test.local`.

## Sandbox clean-up (2026-10-16, owner approved, one-time, before training)

All run-tagged test records removed in one all-or-nothing step: 30 clients, 26 employees, 29 paysheets,
49 invoices, 18 receipts, 11 expenses, 15 advances (+20 recovery rows), 42 ledger entries, 237 in-app
alerts, plus wage rows, billing lines and deduction templates. Verified afterwards: 0 tagged records left;
real data intact (35 clients, 165 employees, 3 paysheets, 5 invoices). Read-only checks then passed
(API 35, browser 27) against the redeployed sites. Audit-log history and QA sign-in records were kept.
**Until training ends, run only read-only checks** (`foundation`, `smoke/signed-out`, `smoke/bundle`,
`smoke/restricted-actions`, browser `foundation smoke`); `test:regression` and the workflow tests create
records and alerts.

## Test data history (counts before the clean-up, 2026-10-16)

All run-tagged (`… [T2026…]`) and neutralised; none active:
- 23 test clients (deactivated) with their wage rows/billing lines; 19 test employees (relieved).
- 20 test paysheets and 35 test invoices, all **cancelled**; test receipts reversed (ledger nets to zero).
- 4 approved ₹1 test expenses (₹4 in the ledger) and 4 approved ₹200 test advances with recovery
  schedules (approved advances can't be cancelled by design).
- In-app alerts: each submitted test paysheet alerts every active Super Admin/CEO/COO, including the
  owner's account (30 alerts in 2 hours of runs); advance requests alert CEO/COO accounts.
- Sign-in records of the QA accounts in the sandbox activity and audit logs.
A regression run adds roughly: 4 clients, 6 employees, 8 paysheets, 12 invoices, 1 expense, 1 advance.

## Confirmed requirements

- Sandbox data stays real for training; backups kept (2026-10-16).

## Open questions

1. PF wage base, the ₹15,000 figure (ceiling or floor), employer share.
2. ESI threshold basis and rates.
3. PT slabs, including the exact ₹15,000 and ₹20,000 boundaries.
4. Uniform allowance in take-home pay; canteen and uniform-advance deductions.
5. Rounding; default working days.
6. GST, TDS base, IGST vs CGST+SGST.
7. Whether CEO / Super Admin may approve their own submissions.
8. Source of truth for permissions: the database table or `ROLE_PERMISSION_MATRIX.md`.
9. How to handle accumulating test records and test alerts (see "Test data left in sandbox").
10. Training hours, so test runs can be scheduled outside them.
11. Should the database block a second paysheet for the same client + month? (screen only warns)

## Confirmed by owner (2026-10-16)
- Question 12: the database refuses receipts larger than the outstanding amount. Late payments in a new
  financial year are recorded against the original invoice (no new invoice); covered by R-INV-09.
- One-time sandbox clean-up of run-tagged test records and their alerts, after testing, before training.

## Known defects / findings

**Fix status (2026-10-16):** D-5, D-6, D-7, D-8, D-9 and the overpayment rule (question 12) are fixed
in **sandbox** (migration `20261016200000_fix_d5_d7_d8_d9_overpayment.sql` + screen changes in
PaysheetCreate, EmployeeForm, ExpenseV2Form). All tests pass: unit 42, API 62, browser 29. Production
migration applied with owner approval and verified (function code and flag defaults identical to sandbox;
production defaults now resolve to "production"). Code committed and pushed with the Phase 4 tests.

Proven by tests (Phase 4; found before the fixes above):
- **D-6 (High):** "Submit" on a brand-new paysheet is refused by the database: the screen inserts it as
  "submitted", the insert rule only allows "draft" (error 42501). Users must save a draft first.
- **D-7 (Medium):** "Approved (post to ledger now)" on New Expense always fails ("Only draft expenses can
  be approved"), even for a CEO; the function saves as approved, then runs an approval that needs a draft.
- **D-8 (Medium):** "Re-create" of a cancelled paysheet always fails: the function references a column
  paysheets don't have (`branch_id`, error 42703) and omits a required one (`total_days_in_month`).
- **D-9 (Low):** approving a non-existent paysheet id reports success (no change is made).

Static (code/config review, not yet proven by a test):
- **D-5 raised to High:** the paysheet screen also loads only employees with the current environment flag,
  so in production, form-created employees (saved as sandbox) wouldn't appear when creating paysheets.
- **Direct-write gaps for Phase 5:** any active user can update paysheet headers; staff roles can insert
  ledger rows and edit invoices directly; a COO can set a paysheet to approved without the approval
  function (skipping its side effects).
- **D-1 (High, to confirm):** paysheet amounts are calculated in the browser and stored without
  server checks. The server function `save_paysheet` uses different rules and isn't used by the screens.
- **D-5 (Medium):** the employee form doesn't set the sandbox flag, and the column defaults to true in
  both databases, so employees created in production would be saved as sandbox records (missing from
  Deployments and the dashboard there).
- **D-2 (Medium):** the sandbox label follows the web address, not the database.
- **P3-2 (Low):** sign-in service accepts 6-character passwords; the login form needs 8.
- **P3-3 (Low):** sandbox company logo is loaded from the production website.
- **D-4 (Low):** Add User sends real invitation emails.
- Info: no role can delete a client (deactivate only).

## Next proposed action

Owner reviews Phase 4 (and decides on test-record cleanup before training). Proposed Phase 5:
security and data-isolation suite. Calculation assertions for Phase 4 follow once questions 1–6 are answered.
