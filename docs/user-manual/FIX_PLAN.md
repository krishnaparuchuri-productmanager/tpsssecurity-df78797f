# Fix Plan — open findings (owner request 2026-10-13: "fix all open + today's issues + CRM in manual")

Process for every batch: sandbox DB first → test → production DB → commit DB + UI together → push (main deploys both sites). Tick items here as they ship.

## Owner decisions (2026-10-13)
- **Statutory rules: KEEP current** (EPF floor via EPF Min Wages, employer 13 %, ESI on earned ≤ 21,000, PT slabs). Only fix **NCP days** (ECR) and **ESI No of Days** to use duties. OF-10 → documented, won't change.
- **Ledger:** post each Bank Payment **salary batch** as a Staff Salary payment. Invoices stay off the cash book.
- **IGST:** optional, per client, chosen in the client master (GST type: CGST+SGST or IGST). Invoice view/PDF and GST report show the split.
- **Sites:** build a simple Sites screen (client sites/posts + site on deployment).
- **CRM website-lead mirroring:** keep as-is (OF-22 won't fix; masked in captures).

## Checklist
### Batch 1 — Admin / auth / environment
- [x] OF-01 Block demote/deactivate/remove of the last active Super Admin (DB trigger + UI guard on own row)
- [x] OF-02 `signOut({ scope: 'local' })`; detect revoked session on focus/interval → sign out locally, go to /login
- [~] OF-03 NOT changed: `.env` is TRACKED in git (despite .gitignore) and may feed the production Cloudflare build. Owner/devops must confirm Cloudflare Pages env vars for both sites, then point `.env` at sandbox. Local risk mitigated by `.env.local`.
- [x] OF-30 Audit Logs show user names (join user_profiles)
### Batch 2 — Payroll / bank / statutory files
- [x] OF-04 `record_payment_batch` posts ledger payment (staff_salary)
- [x] OF-07 ECR NCP days = working_days − duties
- [x] OF-08 ESI challan No of Days = duties; data headers on row 1 (no branding rows)
- [x] OF-15 Disbursement CSV SANDBOX marker; Payment Reference = paysheet no + employee code
- [x] OF-17 Submit confirm only for red/yellow flags
- [x] OF-18 Approval Queue: labelled Approve / Reject buttons
- [x] OF-28 Paysheet grid input widths
- [x] OF-33 Payslips: hint when Generate disabled
- [x] OF-25 Normalise imported paysheet month labels (sandbox data "2026-05" → "MAY-2026")
- [x] NEW finding: guard_paysheet_status re-checks "cannot approve own submission" on EVERY update of an approved paysheet (blocked a label-only data fix). Low. → checks only on transition into approved (`c016ebf`, both envs)
### Batch 3 — Invoices / receipts / finance / GST
- [x] OF-05 Reverse receipt (Super Admin, reason ≥ 10): mark reversed, ledger reversal, recompute invoice; button on receipt view (main `a52acea`, 2026-10-13; receipt view returns to invoice after reversal since RLS hides reversed receipts)
- [x] OF-06 Statement of Account: show TDS as a credit line (balance = receivable − received) (`a52acea`)
- [x] OF-11 Client GST type (CGST+SGST / IGST); invoice view prints IGST when selected; recreate_invoice keeps gst_type (`a52acea`)
- [x] OF-12 GST report: CGST/SGST/IGST columns on screen + export (SAC, client GSTIN); label "GST summary (for GSTR-1)" (`a52acea`)
- [x] (main `b8a815c`, both envs) NEW (2026-10-13, owner: FIX) Client edit duplicates billing lines: soft-delete `update({is_deleted:true})` is rejected by RLS (SELECT policy `is_deleted = false` → "new row violates row-level security policy") and the error is ignored. Fix via SECURITY DEFINER RPC that replaces lines atomically; same for Branch delete; clean sandbox duplicates (Test Client 1). Applies to any future soft-delete (Sites/OF-21).
- [x] (`c4a1af4`, both envs; trigger + recompute) NEW (owner: FIX) Ledger `balance_after` = MAX(balance_after)+/-amount instead of the latest balance (receipts, expenses, salary, compliance, reversal) → running balance wrong.
- [x] (`c4a1af4`) NEW (owner: FIX) GST report includes draft invoices → issued invoices only.
- [x] (`c4a1af4`) NEW (owner: FIX) IGST invoices print company location code as Place of Supply → show client state for IGST.
- NOTE (not fixed, low): every client save inserts a new version of each wage row even when unchanged (history noise); Cash Book with a From date starts the balance at 0 (no opening balance).
- [x] OF-13 Hide Record Payment on Draft invoices (`c4a1af4`)
- [x] OF-14 Invoice qty pre-fill from paysheet headcount by unit label → owner chose hint only (see below)
- [x] OF-16 Expense numbers prefixed TEST- in sandbox (`43455d3`, both envs)
- [x] OF-19 Dashboard month cards labelled "(by billing month)" (`43455d3`)
- [x] OF-29 Comparative: counts not formatted as money (`43455d3`)
- [x] NEW mom_metric_series (Comparative/MoM) counted cancelled invoices/paysheets → excluded (`43455d3`, both envs)
- [x] NEW (owner: issued only) Dashboard / Comparative / MoM / Financial Dashboard / Annual Summary exclude DRAFT invoices (`6052e92`, both envs). Not changed: Statement of Account, Aging, Follow-ups still list drafts (candidates).
- [x] OF-14 (owner: hint only) invoice form from a paysheet shows "Paysheet headcount: S.GUARD 2 · SUPERVISOR 1"; qty not auto-filled (`6052e92`)
### Batch 4 — Masters / validation / PDFs
- [x] OF-09 Employee salary auto-fill from `client_wage_config` (`ca237ea`)
- [x] OF-20 IFSC validation on TPSS Bank Accounts (`02cdc1c`; existing stored IFSC not changed)
- [x] OF-21 Sites screen (client form section + deployment site selector) (`0c66998`; sandbox site "Main Gate (Synthetic) — Block A" on Test Client 1)
- [x] OF-23 Client validation "Client name is required" (`ca237ea`)
- [x] OF-24 Employee validation messages without internal field names (`ca237ea`)
- [x] OF-26 PDFs: fit columns to page; readable total rows (`bdba41d`; confirm visually when re-capturing statutory PDFs in batch 5)
- [x] OF-32 Add "OFFICE & ADMIN" expense category (`02cdc1c`). Production `expense_categories` was EMPTY (sandbox seed never promoted) → owner approved seeding the full list (14 rows) in prod.
- [x] OF-34 Contract expiry badge colours (`02cdc1c`)
- [x] OF-31 Regenerate Supabase TS types; fix fallout (`8b1d126`; TS errors 142 → 0). Exposed + fixed: PRODUCTION lacked 4 employees columns (migration 20260619130551 never applied → employee create/edit would fail in prod) — applied; CRM leads Paginator props. Prod/sandbox column fingerprints now identical.
- [x] OF-27 (sandbox only, owner approved) company profile filled with fake GSTIN/PAN/PF/ESI/bank so invoices/receipts don't print "—"
### Not code
- OF-10 owner keeps rules (document) · OF-22 owner keeps mirroring · OF-27 owner to fill company GSTIN/PAN/bank · OF-35 covered by manual

### Batch 5 — CRM + docs
- [x] Synthetic lead LEAD-2026-0002 "Test Prospect (Synthetic)": detail, Log Activity, Add Quotation (TEST-QTN-001), Close Lead (Won) captured (crm/04–10)
- [x] Re-captured changed screens (approval queue masked, invoices 04/05/09, receipts 04/05, GST report, statement + PDF, statutory PDFs 02–05, validation 11.4/14.2/14.3, sites, deployment site picker, cash book, company profile, dashboard, comparative, audit log, expense categories)
- [x] USER_MANUAL.md v1.1, DOCUMENTATION_FINDINGS.md (sections C + D), FEATURE_TRACEABILITY.md updated; USER_MANUAL.pdf rebuilt (144 pages, 120 images, none broken)
- [x] Owner: decide on committing docs/user-manual/ (incl. PDF) → committed `ec567f1`
- [x] NF-11…NF-16 low findings fixed (`054ac6f`); FEATURE_INVENTORY / ROLE_PERMISSION_MATRIX / GAPS_AND_ASSUMPTIONS updated
- [x] OF-03 (13 Oct 2026): production Pages project now has VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (production values; key added by owner); tracked `.env` now points at the SANDBOX for local runs. Verified: a build variable overrides .env; live bundles checked after deploy
