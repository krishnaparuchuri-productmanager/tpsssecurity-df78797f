# Plan: Comprehensive, Security-Safe README.md

Replace the placeholder `README.md` with a full project document for the TPSS Security ERP + marketing site, scrubbed of anything that could aid an attacker.

## Security guardrails (what the README will NOT contain)
- No Supabase project ref, project URL, anon key, or any environment variable values
- No edge-function URLs, cron secret names, or webhook endpoints
- No table names, column names, RLS policy details, or SQL snippets
- No internal route paths beyond the high-level module list (no `/app/admin/...` deep links)
- No role-name strings (`ceo_admin`, `coo_ops`, `accountant`) — described generically as "Admin / Operations / Finance" tiers
- No file paths into `src/integrations/...`, `supabase/functions/...`, or migration filenames
- No mention of specific security mechanisms (trigger names, security-definer functions, audit-log table, failed-login tracking internals)
- No credentials, seed-user instructions, or "how to become admin" steps
- No live admin URL in any "try it" section — only the public marketing URL
- No screenshots that show real client, employee, or financial data (placeholders only)

## README sections

1. **Title & Overview** — TPSS Security Operations & Finance Portal: a private, role-aware web portal that consolidates client, workforce, payroll, billing, and statutory-compliance management for a security-services business, plus a public marketing website.
2. **Background / Context** — Why it exists: manpower-security firms in India juggle monthly paysheets across branches, statutory filings, client invoicing, receivables follow-up, and guard advances/settlements — typically across many spreadsheets. This portal centralises those workflows with proper approvals and audit trails.
3. **Key Features** — High-level bullets only: Client & Employee masters, Branch/Shift/Deployment tracking, Payroll generation with multi-step approval, GST invoicing, Receipts & Cashbook, Statement of Account / Aging / Follow-ups, Employee Advances and Full-&-Final Settlement, Compliance Calendar with statutory-return helpers, Management Reports (MoM, Comparative, Annual), role-aware dashboards with branch filtering, automated monthly backups.
4. **System Architecture** — ASCII diagram: Browser → React SPA → Managed Backend (database + auth + serverless functions + storage). Note hostname-split deployment (public marketing site vs. private admin portal) without naming the hosts in any exploitable way; the admin host is referenced generically as "the private subdomain".
5. **Tech Stack** — React 18, Vite 5, TypeScript 5, Tailwind CSS, shadcn/ui, React Router, TanStack Query, Recharts, Lovable Cloud (managed Postgres + Auth + Edge Functions + Storage), Lovable AI Gateway (available for future use).
6. **How It Works** — Generic user journey: sign in → role-scoped navigation appears → maintain masters → generate monthly paysheet → submit for approval → raise client invoice → record receipt → reconcile cashbook → run compliance and reports.
7. **AI/ML Components** — None in production today. Lovable AI Gateway is wired-ready for planned features (payroll anomaly detection, invoice OCR, natural-language report Q&A). Marked as roadmap.
8. **Setup Instructions** — High-level only: clone the GitHub repo, `bun install`, `bun dev`. Backend is provisioned automatically by Lovable Cloud — no manual database setup, no env-var configuration, no secret-handling instructions in the README. First-user provisioning is described as "performed by the project owner via the Lovable Cloud admin tools" (no step-by-step).
9. **Example Use Case** — Narrative walkthrough using fictional data (Branch "North", client "ACME Pvt Ltd", guard "Employee #1234"): generate March paysheet → operations approves → invoice raised → payment received → ledger and dashboards update.
10. **Challenges & Learnings** — Discussed at concept level only: designing a clean role-and-permission model, enforcing immutability of approved financial records, splitting public marketing and private admin experiences, building reports that stay performant on growing data. No implementation specifics.
11. **Future Improvements / Roadmap** — Mobile attendance app, AI-driven payroll anomaly alerts, WhatsApp invoice delivery, deeper GST e-invoice integration, biometric-attendance ingestion.
12. **Screenshots / Demo** — Public marketing URL only. Placeholder lines for screenshots (`docs/screenshots/...`) with a note that admin-portal screenshots are intentionally omitted.

Plus short closing sections: **License** (placeholder — "Proprietary, all rights reserved"), **Contact** (point to the public marketing site only).

## Pushing to GitHub
Lovable's GitHub integration syncs every committed change to the connected repository automatically. Once the README is written and the change is committed in Lovable, it will appear in the GitHub repo on the next sync — no manual `git` push is needed (and is not permitted from the sandbox).

If the project is **not** yet connected to GitHub, the user needs to do that one-time step from the Lovable editor: Plus (+) menu → GitHub → Connect project. The README change will then sync on the next commit.

## Deliverable
- One file change: overwrite `README.md` (~250–400 lines), professional tone, ASCII diagram, no emojis, no sensitive details.
- No code, schema, or runtime changes.
