# Sandbox (Demo) vs Production

> Phase 1 discovery output, 2026-10-12. Only **verified** differences are listed. Evidence column names where each was confirmed.
>
> The product calls its demo environment **Sandbox**. This manual uses the same term.

| Area | Sandbox | Production | User impact | Evidence / configuration |
|---|---|---|---|---|
| URL | `tpss-security-sandbox.pages.dev` | `portal.tpsssecurity.com` (also `admin.tpsssecurity.com`, `tpsssecurity-df78797f.pages.dev`) | Use the sandbox URL for training and testing only | `EnvironmentContext.tsx`, `HostRouter.tsx`; both sites returned HTTP 200 |
| How the environment is chosen | By the website address you open | By the website address you open | There is no in-app switch; Company Profile shows the mode read-only | `EnvironmentContext.tsx` (`SANDBOX_HOSTNAMES`) |
| Database | Separate Supabase project `tpss-security-sandbox` | Separate Supabase project `tpss-security-production` | Records never cross between environments | Supabase project list |
| Sign-in accounts | Separate | Separate | A password set in one environment does not work in the other | `auth.users` per project |
| Application code | Same build | Same build | Every release reaches both at the same time | Both Cloudflare sites deploy from `main` (verified: new bundle appeared on both) |
| Banner | Yellow **"SANDBOX MODE — Test environment. Data here does not affect production records."** + 🟡 badge | No banner | Always check for the yellow banner before entering test data | `SandboxBanner.tsx`, `EnvBadge.tsx`; seen in UI |
| Save buttons | Some read "Save to Sandbox" | "Save" | Wording only | `lib/envLabels.ts` |
| Document numbers | Prefixed `TEST-` (invoices `TEST-…`, paysheets `TEST-PS-`, receipts `TEST-REC-`, advances `TEST-ADV-`, FFS `TEST-FFS-`) | No prefix | Sandbox documents cannot be mistaken for real ones | `gen_*_number` functions |
| Number sequences | Separate counters | Separate counters | Sandbox testing does not consume production invoice numbers | `invoice_number_seq.is_sandbox` |
| PDFs (payslips, reports, disbursement) | Diagonal **"SANDBOX"** watermark | Company watermark only | Printed sandbox documents are visibly test copies | `reportPdf.ts`, `Payslip.tsx`, `BankDisbursementReport.tsx` |
| Bank payment Excel | Header row **"\*\*\* SANDBOX — NOT FOR REAL PAYMENT \*\*\*"** | No warning row | Sandbox bank files must never be uploaded to a bank | `BankPayment.tsx` |
| Wipe Sandbox | Available to Super Admin (Company Profile › Environment) — deletes **all** sandbox transactional data (advances, FFS, deployments, contracts, payments, ledger, invoices, paysheets, wage config, billing lines, number counters) | Refused by the server | Destructive; see warning in manual | `wipe_sandbox()` |
| Record flag | Every record stamped `is_sandbox = true`; lists filter on it | `is_sandbox = false` | — | DB columns; all sandbox records verified `true` |
| Data present (2026-10-12) | 34 clients, 162 employees, 152 deployments, 2 paysheets, 1 invoice, 1 payment | No clients, employees, paysheets or invoices yet | Production is not yet in operational use | Row counts |
| Website enquiries | Mirrored into sandbox CRM (marked sandbox) | Live website leads | Sandbox CRM may show copies of real enquiries | commit `e7fea1b` |
| Scheduled jobs | Same five jobs, same schedules | Same five jobs, same schedules | Overdue marking, follow-ups, contract checks, backups and security alerts run in both | `cron.job` in both projects |
| Edge functions | Same set (7) | Same set (7) | — | function lists in both projects |
| Database history | Has 3 extra test-data migrations never promoted (by design) | — | None | prior audit notes |

## Not found / no difference verified

| Area | Finding |
|---|---|
| Email / SMS | No SMS integration found. Email is used only for sign-in invites and password reset (Supabase Auth) in both environments. |
| Payment gateways | None. Payments are recorded manually. |
| Bank integration | None. Bank files are downloaded and uploaded to the bank manually. |
| Statutory portal submission | None. ECR text file and ESI challan Excel are downloaded and uploaded manually. |
| Feature flags | None found besides the environment detection above. |
| File storage | Backups bucket used in both; no environment-specific difference verified. **Not verified.** |
| Data retention | No retention rules found in either environment. |

## Local development note (administrators only)

The repository's `.env` points at the **production** database, while the app labels any `localhost` session as **Sandbox**. A local `.env.local` now points local runs at the sandbox. Anyone running the app locally without that file would write to production while the screen says "Sandbox". Recorded as a finding (DPR-01).
