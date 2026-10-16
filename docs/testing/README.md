# TPSS automated tests — how to use them

Plain-English guide for the business owner. The checkpoint file
([TESTING_CHECKPOINT.md](TESTING_CHECKPOINT.md)) records what has been built and run so far.

## What the tests are

| Kind | What it checks | Touches the database? | Command |
|---|---|---|---|
| Unit | Pure logic (safety guards now; payroll/invoice maths later) | No | `npm run test:unit` |
| API | The sandbox database directly, as signed-out or signed-in test users | Sandbox only | `npm run test:api` |
| Browser | The real app in a hidden Chrome window | Sandbox only | `npm run test:e2e` |
| Foundation | The safety checks of all three kinds | Sandbox, read-only | `npm run test:foundation` |
| Smoke | Sign-in/out, access control, core screens, client → employee workflow | Sandbox (creates tagged test records) | `npm run test:smoke` |
| Regression | Payroll, invoices, receipts, advances, expenses, reports, exports | Sandbox (creates tagged test records, sends in-app alerts to admins) | `npm run test:regression` |

The security suite is added in a later phase. Tests marked **todo** are waiting for the owner to confirm
payroll and tax rules. A few regression tests **fail on purpose** because they prove known app defects
(see the checkpoint, D-6 to D-9); they turn green once those defects are fixed.

**The sandbox holds real client and employee data (kept for training).** Browser tests therefore save
no screenshots, videos, traces or page text. Failure evidence is the error message and the test step.
Don't run `test:smoke` during training hours: it creates (and then removes or deactivates) test records.

## Safety built in

- **Sandbox only.** Before anything runs, the tests check that the database is the sandbox project
  and that no production address or key appears in the settings. If either check fails, the run stops
  with `UNSAFE TEST TARGET`. Before any signed-in test, the sandbox database itself must answer "sandbox".
- **No real emails.** Password-reset, invitation, sign-up and magic-link requests are blocked, and so is
  starting a backup. A test that tries one fails.
- **No admin keys.** Tests use the same public key as the sandbox website. Secret or service-role keys
  are refused.
- **Tagged test data.** Every record a test creates is named like `Test Client [T20261017-1030-ab12]`.
  Cleanup removes only records carrying that run's tag. Finance records the app keeps permanently
  (issued invoices, receipts, ledger entries) stay in sandbox as tagged test records.
- **Nothing sensitive committed.** Settings (`tests/.env.test.local`), sign-in state and reports are
  ignored by git.

## One-time setup (already done on this computer)

1. Node.js is installed (v24).
2. `npm install` was run, which installed Playwright.
3. The test browser was installed with `npx playwright install chromium`.
4. `tests/.env.test.local` was created from `tests/.env.test.example`, with the sandbox address and its
   public key.

## Test accounts (owner step)

Tests that need a signed-in user are **skipped** until their account exists. To create the accounts
without sending invitation emails:

1. Open Supabase → project **tpss-security-sandbox** → Authentication → Users → **Add user** →
   **Create new user**.
2. Enter a test address (suggested: `qa-super@tpsssecurity.com`, `qa-ceo@…`, `qa-coo@…`,
   `qa-accountant@…`, `qa-inactive@…`), choose a strong password, and tick **Auto Confirm User**.
3. Open `tests/.env.test.local` on this computer in Notepad and fill in each `TEST_…_EMAIL` and
   `TEST_…_PASSWORD`. **Do not paste passwords into chat, email or tickets.**
4. Tell Claude the accounts exist. Their roles (CEO, COO, Accountant, Super Admin, and one deactivated
   user) are then set in the sandbox database. That step needs your approval.

## Running tests

Open a terminal in the project folder (`C:\Users\ADMIN\tpsssecurity`) and run, for example:

```bash
npm run test:foundation
```

- A green tick or `passed` means the check succeeded.
- `skipped` means the check couldn't run yet; the reason is shown (usually "account not configured").
- `failed` means something is wrong. Read the message under the failing test.

Browser tests start their own private copy of the app on port 8090, wired to the sandbox. You don't
need to start anything first.

## Reading reports

Each browser run gets its own folder, `tests/reports/runs/<run id>/`, containing:

- `html/`: a readable report. Open the latest one with `npm run test:report`.
- `results.json`: machine-readable results.
- `artifacts/`: technical leftovers only. Screenshots, traces and page snapshots are switched off
  and deleted automatically, because the sandbox holds real data.

## Rerunning one test

Add part of the test's name or ID to the command:

```bash
npx playwright test -g "FND-06"
```

```bash
npx vitest run --config tests/vitest.api.config.ts -t "FND-05"
```

## When something is blocked

| Message | Meaning | What to do |
|---|---|---|
| `UNSAFE TEST TARGET` | Settings point somewhere other than the sandbox | Check `tests/.env.test.local` against the example file |
| `skipped … not configured` | A test account is missing | See "Test accounts" above |
| `Sign-in failed for the … test account` | Wrong password, or the account isn't confirmed | Reset it in Supabase; update the local file |
| `… test account must have its role` | The account was recreated in Supabase, which removes its role | Ask Claude to re-apply the role |
| `… shorter than the login form's 8-character minimum` | The test password is too short for the login screen | Set an 8+ character password in Supabase and the local file |
| `Blocked by test safety guard` | A test tried to send email or reach production | This is the guard working. Report it if it was unexpected |
| Port 8090 already in use | Another copy of the app is running there | Close it, or set `TEST_APP_BASE_URL` to another local port |
