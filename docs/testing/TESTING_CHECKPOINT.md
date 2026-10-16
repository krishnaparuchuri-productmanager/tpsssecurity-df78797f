# Testing checkpoint

Updated at the end of every phase. No secrets or business data here.

## Phases

| Phase | Scope | Status | Owner approval |
|---|---|---|---|
| 1 | Discovery and test plan (read-only) | Done 2026-10-16 | Reviewed; Phase 2 approved 2026-10-16 |
| 2 | Safe automation foundation | Done 2026-10-16, **awaiting review** | — |
| 3 | Smoke and core-workflow suite | Proposed | Not approved |
| 4 | Functional and business-rule regression | Not started | — |
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

## Commands

| Command | What it runs |
|---|---|
| `npm run test:unit` | Unit tests (no network) |
| `npm run test:api` | API/database tests (sandbox) |
| `npm run test:e2e` | Browser tests (private dev server on port 8090, sandbox) |
| `npm run test:foundation` | Safety checks of all three kinds |
| `npm run test:report` | Opens the latest browser report |
| `npm test` | The original placeholder test (unchanged) |

Settings live in `tests/.env.test.local` (gitignored). The template is `tests/.env.test.example`.

## Last run (2026-10-16, Phase 2 verification, all in this session)

| Suite | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|
| Unit (foundation) | 27 | 0 | 0 | Two guard defects found by these tests and fixed before the final run |
| API (foundation, live sandbox) | 9 | 0 | 0 | Includes the signed-in "database says sandbox" check and sign-in for all 5 test accounts (run T20261016-2005-5843) |
| Browser (foundation, live sandbox) | 2 | 0 | 0 | — |
| Negative: runner pointed at production | — | — | — | Both runners refused to start (`UNSAFE TEST TARGET`) |

## Test accounts

Five sandbox-only accounts, created by the owner 2026-10-16 (auto-confirmed, no email sent). Roles
were assigned by Claude with owner approval (sandbox database; 5 audit-log rows, `ROLE_CHANGE`).

| Account | Role | Active |
|---|---|---|
| admin+qa-super@tpsssecurity.com (QA Super Admin) | super_admin | yes |
| admin+qa-ceo@tpsssecurity.com (QA CEO) | ceo_admin | yes |
| admin+qa-coo@tpsssecurity.com (QA COO) | coo_ops | yes |
| admin+qa-accountant@tpsssecurity.com (QA Accountant) | accountant | yes |
| admin+qa-inactive@tpsssecurity.com (QA Inactive) | accountant | **no** (deactivated) |

Passwords live only in `tests/.env.test.local` on the owner's computer.

## Confirmed requirements

None yet.

## Open questions (from Phase 1)

1. PF wage base, the ₹15,000 figure (ceiling or floor), employer share.
2. ESI threshold basis and rates.
3. PT slabs, including the exact ₹15,000 and ₹20,000 boundaries.
4. Uniform allowance in take-home pay; canteen and uniform-advance deductions.
5. Rounding; default working days.
6. GST, TDS base, IGST vs CGST+SGST.
7. Whether CEO / Super Admin may approve their own submissions.
8. Source of truth for permissions: the database table or `ROLE_PERMISSION_MATRIX.md`.
9. Whether all sandbox data is synthetic (the May 2026 import may hold real names).
10. Whether tagged leftover test records in sandbox are acceptable.

## Known defects / findings (not yet proven by tests)

- **D-1 (High, to confirm):** paysheet amounts are calculated in the browser and stored without
  server checks. The server function `save_paysheet` uses different rules and isn't used by the screens.
- **D-2 (Medium):** the sandbox label follows the web address, not the database.
- **D-3 (Medium):** no automated coverage or pipeline before this project.
- **D-4 (Low):** Add User sends real invitation emails.

## Next proposed action

Owner reviews Phase 2. If approved, Phase 3 as described in the Phase 2 report.
