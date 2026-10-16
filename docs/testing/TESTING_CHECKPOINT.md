# Testing checkpoint

Updated at the end of every phase. No secrets or business data here.

## Phases

| Phase | Scope | Status | Owner approval |
|---|---|---|---|
| 1 | Discovery and test plan (read-only) | Done 2026-10-16 | Reviewed |
| 2 | Safe automation foundation | Done 2026-10-16 (commit c887c5f, local) | Approved |
| 3 | Smoke and core-workflow suite | Done 2026-10-16, **awaiting review** (uncommitted) | Approved |
| 4 | Functional and business-rule regression | Not started; blocked on rule questions 1–6 | — |
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
| `npm run test:unit` | Unit tests (no network) |
| `npm run test:api` | All API/database tests (sandbox) |
| `npm run test:e2e` | All browser tests (private dev server on port 8090, sandbox) |
| `npm run test:foundation` | Safety checks of all three kinds |
| `npm run test:report` | Opens the latest browser report |
| `npm test` | The original placeholder test (unchanged) |

Settings live in `tests/.env.test.local` (gitignored). The template is `tests/.env.test.example`.

## Last run (2026-10-16 22:17, Phase 3 final, all in this session)

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

## Test data left in sandbox (as of the last run)

- 8 deactivated, run-tagged test clients (`… [T2026…]`), plus their 8 wage rows and billing lines.
  Clients cannot be deleted by any role, so each `test:smoke` run adds **2** more.
- 0 test employees (all deleted by cleanup).
- Sign-in records of the QA accounts in the sandbox activity and audit logs.

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
9. How to handle accumulating deactivated test clients (see "Test data left in sandbox").
10. Training hours, so test runs can be scheduled outside them.

## Known defects / findings

Proven by tests: none in Phase 3 (all smoke checks pass).

Static (code/config review, not yet proven by a test):
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

Owner reviews Phase 3. Proposed Phase 4 (functional and business-rule regression) needs answers to
questions 1–6 before calculation assertions can be written.
