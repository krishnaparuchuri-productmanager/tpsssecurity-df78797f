# User Manual — Handoff for Next Session

## ⭐⭐⭐ STATUS 2026-10-13 (session 5): MANUAL v1.1 COMPLETE — only owner decisions remain
- Code: all FIX_PLAN items done. OF-31 `8b1d126` (TS errors 142 → 0) also exposed + fixed: production lacked 4 `employees` columns (June migration never applied → employee create/edit failed in prod) and CRM paginator props. Prod/sandbox column fingerprints identical; functions identical except environment-specific `fn_website_submission_to_lead`.
- Sandbox: company profile filled with fake GSTIN/PAN/PF/ESI/bank (OF-27); Test Client 1 set back to CGST+SGST (draft 004 stays IGST); CRM lead LEAD-2026-0002 (Won).
- Docs: USER_MANUAL.md v1.1 (all fixed findings reflected; CRM worked example; new figures 12.1, 15.5, 20.3 (IGST draft), 21.4a, 24.14–24.20), DOCUMENTATION_FINDINGS.md sections C (status per OF) + D (NF-01…NF-16), FEATURE_TRACEABILITY.md, USER_MANUAL.pdf rebuilt (144 pages). Build script: `<scratchpad>/build_pdf.py` (recreate if missing).
- Folder size 32.3 MB (screenshots 19.7 MB, PDF 12.4 MB). Unused: invoices/02-invoice-view-draft.png (superseded by 09).
- **Remaining:** owner review; owner decides how to commit docs/user-manual/; optional low items NF-11…NF-16; OF-03 (.env / Cloudflare) owner action.

## ⭐⭐ START HERE — Session 5 (written 2026-10-13, end of session 4, usage ~82 %)

**Session 4 shipped to `main` (both sites) — all FIX_PLAN code items are DONE except OF-31:**
`a52acea` batch 3 (OF-05 receipt reversal, OF-06 Statement TDS, OF-11 IGST, OF-12 GST split; recreate_invoice keeps gst_type) · `b8a815c` client edit duplicated billing lines (RLS blocked soft delete) → `replace_client_billing_lines` / `soft_delete_branch` RPCs · `c4a1af4` ledger balance_after trigger, GST report drafts out, IGST place of supply, OF-13 · `43455d3` OF-16 TEST-EXP numbers, OF-19 labels, OF-29, MoM excludes cancelled · `6052e92` summaries exclude drafts, OF-14 headcount hint (owner: hint only) · `ca237ea` OF-09/23/24 · `02cdc1c` OF-32 (prod expense_categories was EMPTY → seeded 14, owner approved), OF-20, OF-34 · `c016ebf` guard_paysheet_status checks only on transition (commit subject has a stray BOM — cosmetic) · `bdba41d` OF-26 PDF widths + dark total rows · `0c66998` OF-21 Sites (client form section + deployment site picker; UI only) · `62c8672` Statement/Aging/Follow-ups/receipt picker exclude drafts.
All migrations (20261013140000 … 20261013210000) are applied to sandbox AND production and committed. Branch `wip/fix-batch-3` is merged (squash) — can be deleted.

**Dev server:** another chat holds port 8080, so this session used launch config **`tpsssecurity-8081`** (C:\Users\ADMIN\.claude\launch.json, `--port 8081`, sandbox verified). User signs in on localhost:8081 (separate login from 8080).

**Screenshots re-captured this session (only changed screens, per owner):** finance/04-gst-report, finance/05-statement-of-account (closing ₹81,900), invoices/09-invoice-view-igst-draft (NEW), receipts/05-receipt-reverse-dialog (NEW), clients/06-client-sites (NEW), reports/04-comparative, dashboard/01-dashboard-overview, admin/08-expense-categories, admin/03-audit-logs.
Pipeline rebuilt: `<scratchpad>/shot_receiver.py` (127.0.0.1:8765, writes into assets/screenshots) + in-page helpers `go(path)` (pushState), `__mask`, `__shoot(path,{mask,wait,el})` with html-to-image@1.11.11 from esm.sh. ⚠ PRIVACY: do NOT put "Krishna" in the keep-row regex — real employees are named e.g. S.HARI KRISHNA / J.BALA KRISHNA and were kept by it (caught and re-taken for deployments/05). Use `SYN = /Test (Client|Employee|Prospect)|TEST-|Synthetic|TC1|CLT-037|EMP-19[234]/i`. Spot-checked older employees/05 and deployments/03 — clean (test rows only); optionally spot-check payroll/08–10 next session. deployments/05-deployment-site-picker (NEW) was captured with the fixed rule. Use `mask:false` on invoice/receipt views (masking hides their own line rows). Radix selects: focus the combobox via JS, then keys Enter/End/ArrowUp (coordinate clicks are unreliable under 1366 emulation).

**Still to do (in order):**
1. **Remaining re-captures:** deployments/05 site picker (NEW), statutory-docs PDFs 02–05 + finance/06 statement PDF (need PDF render: intercept download + pdfjs-dist@4.4.168 → confirm OF-26 widths/total rows), payroll/10-approval-queue (labelled buttons; needs a submitted test paysheet or show empty state), ecr-esi only if UI changed (file contents changed, screen probably not). Do NOT re-take employee/shift/deployment-creation screens (owner).
2. **OF-31** regenerate Supabase types (generate_typescript_types, ~3k lines) → remove `as never` casts on reverse_payment / replace_client_billing_lines / soft_delete_branch; target: fewer than 142 TS errors.
3. **Batch 5 CRM:** synthetic lead "Test Prospect (Synthetic)" → lead detail, Log Activity, Add Quotation, Close Lead captures.
4. **Docs:** update USER_MANUAL.md (IGST, receipt reversal, Sites, TDS line, GST split, drafts excluded from reports, TEST-EXP numbers, headcount hint, OFFICE & ADMIN), DOCUMENTATION_FINDINGS.md (mark fixed; add new findings below), FEATURE_TRACEABILITY.md; rebuild USER_MANUAL.pdf (recreate build_pdf.py: Python Playwright headless Chromium + marked@12 jsDelivr).
5. Ask owner before committing docs/user-manual/ (~33 MB).
6. After IGST captures: set Test Client 1 back to CGST+SGST (owner decision); draft 004 stays IGST.

**Sandbox test data added this session:** receipts TEST-REC-OCT2026-004/-005 (₹1,000 each, both REVERSED) on invoice 003; draft invoice TEST-TC1/26-27/004 (IGST, ₹56,640); Test Client 1 gst_type = IGST; site "Main Gate (Synthetic) — Block A"; Test Client 1 duplicate billing lines cleaned up.

**New findings logged (FIX_PLAN.md):** fixed — billing-line duplication, ledger balance, MoM counting cancelled, drafts in reports/statement, guard_paysheet_status. Not fixed (low): every client save adds a new wage-config version even if unchanged; Cash Book with a From date has no opening balance; AnnualSummary invoice/paysheet queries lack an is_sandbox filter; two non-test sandbox clients have repeated billing-line descriptions (left alone).

---

> (Older) Written 2026-10-12 when the 5-hour usage limit reached 94 %.

## ⭐ START HERE — Session 3 (fixing open findings). Read `FIX_PLAN.md` (checklist + owner decisions).

**Shipped to main (both environments):** Batch 1 `0e42791` (OF-01 last-Super-Admin guard, OF-02 local sign-out + revoked-session check, OF-30 audit names) · Batch 2 `ac8e7e6` (OF-04 salary→ledger, OF-07 NCP days, OF-08 ESI days/no header rows, OF-15 CSV marker+refs, OF-17 actionable anomaly count, OF-18 labelled Approve/Reject, OF-28 grid widths, OF-33 payslip hint, OF-25 sandbox month labels).

**In progress on branch `wip/fix-batch-3` (pushed, NOT merged, NOT UI-tested):** OF-05 receipt reversal (`reverse_payment` RPC + button on receipt view), OF-06 Statement TDS line, OF-11 IGST (`gst_type` on clients/invoices + client selector + invoice print), OF-12 GST export columns. **Their DB migrations are already applied to sandbox AND production** (additive: new RPC + columns — safe).
Next steps for batch 3: `git checkout wip/fix-batch-3` → also update `recreate_invoice` to copy `gst_type` (new migration, both envs) → re-run typecheck diff vs a fresh baseline (types.ts was hand-patched for `gst_type`; diff output only showed message text changes) and lint → test in sandbox UI (reverse a receipt on a TEST invoice; set Test Client 1 to IGST and create a draft invoice; GST export; Statement) → merge to main → push.

**Still to do (remaining FIX_PLAN items):** OF-13 hide Record Payment on drafts · OF-14 invoice qty from paysheet headcount · OF-16 TEST- prefix for expense numbers · OF-19 dashboard "(by billing month)" labels · OF-29 Comparative count formatting · OF-09 employee salary auto-fill from `client_wage_config` · OF-20 IFSC validation (TPSS accounts) · OF-21 Sites screen (client form section on `client_posts` + site selector on deployments) · OF-23/24 friendly validation messages · OF-26 PDF column fit + readable total rows · OF-32 "OFFICE & ADMIN" expense category · OF-34 contract badge colours · OF-31 regenerate types (use `generate_typescript_types` in a FRESH session — output is ~3k lines) · NEW low: `guard_paysheet_status` re-checks self-approval on every update of an approved paysheet.
Then Batch 5: CRM test lead "Test Prospect (Synthetic)" → capture lead detail / activity / quotation / closure; re-capture screenshots changed by fixes (approval queue, ECR/ESI, statement, GST report, invoice IGST, receipt reversal, audit log, sites); update USER_MANUAL.md, DOCUMENTATION_FINDINGS.md (mark fixed), traceability; rebuild PDF; owner decides on committing `docs/user-manual/` (~33 MB incl. PDF).

**Owner-blocked / won't-fix:** OF-03 `.env` is TRACKED in git and may feed the production Cloudflare build — confirm Cloudflare env vars before pointing it to sandbox · OF-10 statutory rules kept by owner · OF-22 website-lead mirroring kept · OF-27 owner to fill company GSTIN/PAN/bank.

**Challenges / risks:**
- `main` deploys BOTH sites instantly → only merge UI after its DB migration is in production (pattern used throughout).
- Screenshots need the user to sign in on `localhost:8080` (hosted site CSP blocks capture); viewport emulation resets after each user turn; masking rules (sample regex, number/IFSC/IP masks, CRM secret hiding) must be re-installed — see §8.
- Scratchpad tooling (`shot_receiver.py`, `build_pdf.py`) lives in a session-specific folder — recreate if missing (descriptions in §8 and FIX_PLAN).
- Sites (OF-21) and IGST touch billing/payroll flows → regression-test paysheet → invoice → receipt after each.
- Effort estimate: batch 3 finish ~1 session block; batch 4 ~1–2; CRM + docs/PDF ~1.

## 0b. Status 2026-10-13 (end of session 2): DELIVERABLES COMPLETE
USER_MANUAL.md (35 chapters + End-to-End Monthly Example, 110 figures), USER_MANUAL.pdf (133 pages, built with headless Chromium + marked), FEATURE_TRACEABILITY.md, DOCUMENTATION_FINDINGS.md (13 fixed / 35 open) written; inventory/gaps updated; privacy pass done. Remaining: owner review; commit `docs/user-manual/` when the owner approves (not yet committed); optional: CRM sample lead for detail screenshots; act on open findings.

## 0. Session 2 update (2026-10-13)
Screenshot capture is COMPLETE (remaining finance/reports/admin/lifecycle/CRM/compliance/corrections captured). Corrections demo done: invoice TEST-TC1/26-27/002 cancelled → re-created as **TEST-TC1/26-27/003** (sent, outstanding 81,900); paysheet cancel attempts blocked (linked invoice / receipts exist); reject dialog captured on real PS-SMOF (closed, untouched). New findings: Statement of Account ignores TDS (closing 83,300 vs 81,900 owed); GST export is a summary, not GSTR-1 format; Comparative shows "Employee Count ₹3.00"; TPSS bank account IFSC stored in invalid format (no validation); audit log shows UUIDs not names; dashboard month figures are by invoice month (Received ₹0 in Oct despite Oct cash). CRM detail/activity/quotation not captured (needs a test lead) — document from code. NEXT: write DOCUMENTATION_FINDINGS.md, USER_MANUAL.md, FEATURE_TRACEABILITY.md, update inventory/gaps/matrix, PDF, privacy pass, commit.

## 1. Status in one line
Discovery is done; Phase 2 (sandbox walkthrough + screenshots) is about **70 % done**. Nine product defects were found and fixed with owner approval. Writing the manual itself has **not started**.

## 2. Decisions already made by the owner (do not re-ask)
- Sandbox only. Screenshots are captured as **Krishna (Super Admin)**; the name may appear.
- No COO/Accountant test users: document their access from code + DB role simulation, marked *"Traced, not verified in UI"*.
- Synthetic names: **Test Client 1**, **Test Employee 1–3**. Never show existing sandbox clients/employees (mask them).
- PF wage rule: document as the app works today, with a calculation note.
- Invoices cannot be emailed: say "not available", no workaround.
- **Wipe Sandbox: leave it out of the manual.**
- The approved scenario creates records that stay in the sandbox (no cleanup needed).
- Every code/DB change needs owner approval first. Pattern so far: sandbox, then prod, committed together.

## 3. Code and DB fixes already shipped (both environments, all pushed to `main`)
| Commit | Fix |
|---|---|
| `72c9af3` | New **Super Admin** role. Krishna = super_admin. CEO/COO unchanged |
| `3e5a618` | Add User shows the real invite error |
| `17d55e4` | Create dialogs clear stale data (Add User, Record Payment, Contract, Deployment, Relieve, Shift) |
| `3af0d82` | Client/employee auto-codes collision-safe (migrations 20261012120000/120100) |
| `1e2d101` | Bank Payment records batches atomically via `record_payment_batch` RPC; Excel only after save; approved-paysheet guard allows payment fields only |
| `4f65d64` | A: Bank Disbursement eligibility; B: ECR/ESI month lookup; C: invoice deductions pre-fill from paysheet |
| `a91e4ed` | D: outstanding = receivable − received (was net margin); E: invoice edit keeps saved lines; F: Edit button for draft invoices |
| `dcb0f3d` | G: month date ranges in local time (GST report, Monthly Summary, expenses, compliance calendar, MoM) |
| `171a7d8` | H: `approve_expense` ledger entry_type 'payment' (was invalid 'debit') |

## 4. Sandbox records created (all synthetic)
- Client **Test Client 1** (CLT-037), GST 18 %, TDS 1 %, PF/ESI/PT on, prefix TC1. Wage rows S.GUARD 12000/3000, SUPERVISOR 15000/3000, washing 500, uniform 300. Billing lines ₹22,000 guard, ₹26,000 supervisor.
- Shift **Test Day Shift** (TDAY). Contract **CNT-CLT-037-001** (PO TEST-PO-001).
- **Test Employee 1–3** = EMP-192/193/194 (Emp3 new joiner, SUPERVISOR). Fake UAN 99999999990n, ESI 9999999999999990n, IFSC TEST0000001, accounts 00000000000n. All deployed.
- Paysheet **TEST-PS-SEP2026-001**, approved. Duties 30/26/30. Earned 47,433.33; EPF 5,520 / 5,980; ESI 345 / 1,495; PT 300; final net 41,268.33.
- Bank batch **SB-BATCH-20261012-QUU** → all 3 employees Paid.
- Invoice **TEST-TC1/26-27/001** (SEP, from paysheet): 82,600 total, receivable 81,900, net margin 33,156.67. Receipts TEST-REC-OCT2026-002 (30,000) and -003 (51,900) → **Paid**.
- Invoice **TEST-TC1/26-27/002** (OCT, manual) → Sent, outstanding 81,900; follow-up logged (promised 20-10-2026). **Reserved for the corrections demo (cancel + re-create).**
- Expense **EXP-SEP2026-001**, ₹2,500, SECURITY/SAFETY MATERIALS → approved.
- Compliance payment EPF Sep-2026, ₹11,500, challan TEST-CHLN-EPF-001.
- Ledger reconciles: credits 81,900, debits 14,000, net 67,900.

## 5. Screenshots captured (`docs/user-manual/assets/screenshots/`, not yet committed)
login, dashboard, clients (5), shifts (3), contracts (3), employees (6), deployments (4), payroll (11 incl. full-width grid), bank-payment (4), payslips (3 incl. PDF render), statutory-docs (5 PDF renders), ecr-esi (2), bank-disbursement (2), invoices (8), receipts (4), followups (2), expenses (5), compliance-payments (4), finance (3).
- **Retake `finance/02-monthly-summary.png` with `{mask:false}`.** Masking hid its breakdown rows.
- `bank-disbursement/01-bank-disbursement-no-eligible-months.png` shows the pre-fix state. Use it only as finding evidence, or delete it.

## 6. Remaining work (in order)
1. **Screenshots still needed:** Statement of Account (+PDF), GST report, MoM Analysis, Comparative, Client History, Employee History, Annual Summary (check for other clients' names → mask), dashboard after scenario, Audit Logs, Activity Log (IPs masked), User Management, Role Permissions, Backups, Branch Summary, Expense Categories, Branches Mgmt, TPSS Bank Accounts (mask), Company Profile (check for real PAN/GST/bank → mask), Advances/FFS/Uniform confirm (lists + blank forms; do not open dropdowns), CRM (mask the real website lead), Compliance Calendar, Forgot password.
2. **Corrections demo:** cancel invoice 002 (Super Admin, reason ≥ 10 chars) → Re-create → edit draft → Mark as Sent. Then try cancelling paysheet SEP-2026 → blocked by the paid linked invoice; capture the error. Capture the Reject dialog on the Approval Queue (the earlier attempt approved by mistake). Note: receipts cannot be reversed in the UI, so paid invoices can't be cancelled.
3. **Write deliverables:** `USER_MANUAL.md` (35 chapters + End-to-End Monthly Example), `FEATURE_TRACEABILITY.md`, `DOCUMENTATION_FINDINGS.md`. Update `FEATURE_INVENTORY.md` / `GAPS_AND_ASSUMPTIONS.md` / `ROLE_PERMISSION_MATRIX.md` for the fixes and the Super Admin role. Produce a PDF if feasible (pdf.js/jsPDF are available in-browser; no Python PDF libraries installed).
4. Privacy pass on every image; commit docs + screenshots.

## 7. Open findings to put in DOCUMENTATION_FINDINGS.md (not fixed)
High / medium:
- Single Super Admin can demote/deactivate themselves (lockout).
- Sign-out is global; a revoked session still looks signed in until an action fails.
- `.env` points local dev at **production** while the UI says Sandbox (mitigated locally by `.env.local`).
- Employee form "auto-fills from client MW rates" reads empty legacy table `client_mw_rates`; nothing auto-fills.
- Paysheet maths runs in the browser (`calc.ts`); server `save_paysheet` unused. EPF wages = max(base, MW) (floor), employer 13 %. ESI threshold uses earned wages. PT ≥15k → 150, ≥20k → 200. All hard-coded.
- ECR: NCP days always 0 (uses month days, not duties); EPF ER diff = 13 % − 8.33 % (overstated); gross includes uniform. ESI challan "No of Days" = 30 regardless of duties; company header rows above the column headings (portal upload *Not verified*).
- Invoice issuing and bank salary payments post **nothing** to the ledger (only receipts, expenses, compliance payments do).
- No IGST: GST always split CGST/SGST.
- Receipts cannot be edited or reversed → paid invoices cannot be cancelled.
- Record Payment is offered on Draft invoices.
- Invoice quantity pre-fill is always 1 (ignores deployed headcount).
- Bank Disbursement CSV has no SANDBOX marker; payment reference = internal IDs.
- Expense numbers have no TEST- prefix in sandbox.
Low / UX:
- Client validation toast just says "Required"; employee toasts show internal field names (`full_name: …`).
- Paysheet list Submit uses a native confirm() even for info-only anomalies (new joiner).
- Approval Queue approve/reject are unlabelled icons (easy misclick).
- Month labels inconsistent ("SEP-2026" vs "2026-05").
- PDF statements: last column cut off; total row white text on light grey.
- Company profile in sandbox lacks GSTIN/PAN/bank (invoice shows "—").
- Narrow paysheet grid inputs truncate values.
- 142 pre-existing TypeScript errors (stale generated DB types).
- `client_posts` (sites) table has no UI.

## 8. How the screenshot pipeline works (rebuild each session)
- Capture from **localhost:8080** (preview server "tpsssecurity", uses `.env.local` → sandbox). The user must sign in to that tab; the hosted site's CSP blocks capture.
- Receiver: `python <scratchpad>/shot_receiver.py` (127.0.0.1:8765; writes PNGs under `docs/user-manual/assets/screenshots/`, outputs to `<scratchpad>/outputs`). The scratchpad is session-specific, so recreate the script (≈60 lines).
- In page: `html-to-image@1.11.11` and `pdfjs-dist@4.4.168` from esm.sh. Helpers: `__shoot(path,{mask,height,wait})`, `go(path)`, `setVal`, `btn`, `openSelect`/`pick`, `clickAndToast`, download interception (patch `URL.createObjectURL` + anchor click), `__pdfPage`.
- Before each capture: disable animations; hide `tbody tr` rows not matching the synthetic regex; mask 9–18-digit numbers (except 9999…/0000…), IFSCs other than TEST0000001, IP addresses.
- Viewport emulation resets after every user turn → call resize_window (1366×1000/1200) again.
- Radix tabs/checkboxes need real clicks (`find` → `computer left_click ref`). Native `confirm()` is auto-dismissed in the pane: override `window.confirm` for one approved click.
- Generated files containing the **real company debit account** must be deleted after inspection (done for the bank Excel).
