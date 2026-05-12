# TPSS Security — Operations & Finance Portal

A private, role-aware web portal that consolidates client management, workforce
deployment, payroll, billing, receivables and statutory compliance for a
manpower-security business — paired with a public marketing website that
introduces the company to prospective clients.

The portal replaces a sprawl of spreadsheets and ad-hoc trackers with a single
auditable system where every approval, invoice and payment is logged and
attributable.

---

## Table of Contents

1. [Overview](#overview)
2. [Background & Context](#background--context)
3. [Key Features](#key-features)
4. [System Architecture](#system-architecture)
5. [Tech Stack](#tech-stack)
6. [How It Works](#how-it-works)
7. [AI / ML Components](#ai--ml-components)
8. [Setup Instructions](#setup-instructions)
9. [Example Use Case](#example-use-case)
10. [Challenges & Learnings](#challenges--learnings)
11. [Roadmap](#roadmap)
12. [Screenshots & Demo](#screenshots--demo)
13. [License](#license)
14. [Contact](#contact)

---

## Overview

The project ships **two experiences from a single codebase**:

- **Public marketing site** — a fast, mobile-first single-page site that
  introduces the company, services, certifications, leadership and gallery.
  Optimised for SEO and lead awareness.
- **Internal operations portal** — a private, authenticated application used
  by the company's leadership, operations and finance teams to run the
  day-to-day business: clients, employees, deployments, payroll, invoicing,
  receipts, compliance and management reports.

The two experiences are served from different hostnames; the marketing site is
public, the portal is restricted to authenticated staff.

## Background & Context

Mid-sized security and manpower firms in India typically run their back-office
on a patchwork of Excel files: one spreadsheet per branch for attendance,
another per client for invoices, a third for receivables, and yet more for
statutory compliance (PF, ESI, ECR, GST). This makes month-end stressful,
introduces calculation errors, and leaves no audit trail for who approved
what and when.

This project was built to centralise those workflows into a single tool that:

- Enforces a clean **maker–checker workflow** for paysheets, advances and
  full-and-final settlements.
- Produces **GST-compliant invoices** and tracks the receivable to the rupee.
- Surfaces **statutory deadlines** instead of relying on memory.
- Gives leadership a **role-aware dashboard** that summarises the business at
  a glance, with the ability to drill down by branch.

## Key Features

- **Masters** — Clients, Employees, Branches, Shifts, Deployments, Contracts,
  Expense Categories, Company Profile.
- **Payroll** — Monthly paysheet generation, salary computation, structured
  approval workflow, exportable paysheets and payslips.
- **Billing** — GST invoices with line items, tax breakdown, status tracking
  and downloadable PDFs.
- **Receivables & Cash** — Receipts, Cashbook, Statement of Account, Aging
  Report, GST report and a follow-up tracker for overdue invoices.
- **Employees** — Salary advances with approval flow, Full-and-Final
  Settlement (FFS) computation and approval.
- **Compliance** — A monthly compliance calendar (PF, ESI, GST, etc.) with
  helpers for ECR/ESI return generation and a payments register.
- **Reports** — Month-on-month analysis, comparative analysis, client billing
  history, employee history and an annual summary.
- **Dashboards** — Leadership dashboard with KPIs, charts, branch filtering
  and a security overview; a slimmed-down view for finance users.
- **Administration** — User management, fine-grained per-screen permissions,
  audit logs, an activity log, branch summary and automated periodic backups.

## System Architecture

The application is a single-page React application backed by a managed cloud
backend. It deploys from one codebase to two hostnames; lightweight routing
in the browser decides which experience to render.

```text
                        ┌──────────────────────────────┐
                        │        Web Browser           │
                        └─────────────┬────────────────┘
                                      │ HTTPS
                                      ▼
                ┌────────────────────────────────────────┐
                │          React SPA (Vite build)        │
                │                                        │
                │  ┌──────────────┐    ┌──────────────┐  │
                │  │  Public      │    │  Private     │  │
                │  │  marketing   │    │  operations  │  │
                │  │  experience  │    │  portal      │  │
                │  └──────────────┘    └──────┬───────┘  │
                └──────────────────────────────┼─────────┘
                                               │ authenticated calls
                                               ▼
                        ┌──────────────────────────────┐
                        │       Managed Backend        │
                        │  (Lovable Cloud)             │
                        │                              │
                        │   • Postgres database        │
                        │   • Authentication service   │
                        │   • Serverless functions     │
                        │   • File storage             │
                        │   • Scheduled jobs           │
                        └──────────────────────────────┘
```

Key architectural choices:

- **Single codebase, two hostnames.** The marketing site lives on the public
  domain; the portal lives on a separate private subdomain. A small router
  decides at runtime which surface to expose, so the two experiences stay in
  lock-step without two separate deployments.
- **Role-aware UI.** Every menu, action and route is guarded by the signed-in
  user's role and per-screen permissions. The same React tree renders very
  different navigation for leadership, operations and finance users.
- **Server-enforced rules.** UI-level checks are convenience only; the
  authoritative rules (who can read what, who can approve, what becomes
  immutable after approval) are enforced server-side in the database.
- **Scheduled jobs.** A handful of serverless functions run on a schedule to
  perform overdue-invoice checks, contract checks, follow-up sweeps and a
  monthly backup.

## Tech Stack

**Frontend**
- React 18 + Vite 5
- TypeScript 5
- Tailwind CSS v3
- shadcn/ui component library
- React Router (client-side routing)
- TanStack Query (data fetching & cache)
- Recharts (dashboards)
- Framer Motion (subtle motion)

**Backend (managed)**
- Postgres (relational database)
- Managed authentication (email + password)
- Serverless functions (Deno runtime)
- Object storage (file uploads, exports, backups)
- Scheduled job runner

**Tooling**
- Bun (package manager / dev runtime)
- ESLint + TypeScript strict checks
- Vitest (unit tests)

**Build & deploy**
- Built and hosted on Lovable
- GitHub integration for source-of-truth and external review

The Lovable AI Gateway is available in the stack and reserved for upcoming
features (see [Roadmap](#roadmap)).

## How It Works

A typical user journey through the portal:

1. **Sign in.** A staff member signs in with email and password. The portal
   loads the navigation, KPIs and shortcuts that match their role.
2. **Maintain masters.** Operations users keep clients, employees, branches,
   shifts and deployments up to date. Each record carries an audit trail.
3. **Run monthly payroll.** A paysheet is generated for the month, salary
   components are computed, and the draft is submitted for approval.
4. **Approve.** A senior user reviews the paysheet and approves (or rejects)
   it. Once approved, the underlying records become immutable so historical
   numbers cannot drift.
5. **Bill the client.** A GST invoice is raised against the client's
   contract, lines are reviewed and the invoice is issued.
6. **Record receipts.** When the client pays, a receipt is recorded against
   the invoice; the cashbook, statement of account and aging report all
   update accordingly.
7. **Stay compliant.** The compliance calendar lists statutory tasks for the
   month with a clear "Done / Total" indicator. Helpers generate the files
   needed for PF/ESI returns.
8. **Review.** Leadership opens the dashboard, optionally filters by branch,
   and reviews KPIs, trends, recent activity and a security overview.
   Detailed reports are one click away.

## AI / ML Components

There are no AI or machine-learning components running in production today.
The Lovable AI Gateway is wired into the stack and is reserved for these
roadmap features:

- **Payroll anomaly detection** — flag paysheets whose totals or per-employee
  amounts deviate sharply from the trailing average.
- **Invoice / document OCR** — extract structured fields from uploaded
  vendor bills and statutory receipts.
- **Natural-language report Q&A** — let leadership ask questions like
  *"compare this quarter's salary outflow against the same quarter last
  year"* and get a chart back.

## Setup Instructions

This project is developed and hosted on Lovable. The backend is provisioned
automatically — there is **no manual database setup** and **no environment
configuration** required to run the app locally.

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd <repo-folder>

# 2. Install dependencies
bun install

# 3. Start the development server
bun dev
```

The dev server prints a local URL you can open in the browser. You will land
on either the public marketing surface or the portal sign-in screen,
depending on the route.

User accounts and the initial administrator are provisioned by the project
owner from the Lovable Cloud admin tools; the application itself does not
expose self-serve signup.

## Example Use Case

> **Scenario** — closing the books for **March** at the **North** branch.

1. The operations executive opens **Payroll → Create**, picks March and the
   North branch, and the system pre-fills attendance for every deployed
   employee. They review and submit the draft.
2. The operations head opens **Payroll → Approvals**, audits the paysheet
   and approves it. The paysheet is now locked.
3. Finance opens **Invoices → New**, raises the March invoice against
   *ACME Pvt Ltd* (one of the North branch's clients), reviews the GST
   breakdown and issues it.
4. A week later, ACME pays. Finance opens **Finance → Receipts** and records
   the payment against the invoice.
5. The leadership dashboard, filtered to the North branch, now shows the
   updated billing total, collected amount and net margin for March. The
   aging report shows ACME's outstanding has dropped to zero, and the
   statement of account for ACME reflects the closed cycle.

Throughout, the activity log and audit log capture who did what and when.

## Challenges & Learnings

- **Designing the role and permission model.** Three distinct roles with
  overlapping but not identical access required a permission matrix that is
  both expressive and easy for an admin to reason about. The result is a
  per-screen, per-action grid that an administrator can toggle without
  developer involvement.
- **Locking history without freezing the product.** Approved paysheets,
  issued invoices and recorded receipts must not change after the fact —
  but the rest of the app must stay editable. This is enforced server-side
  so a buggy or malicious client can't bypass it.
- **Two surfaces, one codebase.** Serving a public marketing site and a
  private operations portal from the same project keeps the build pipeline
  and design system unified, but required a careful runtime split so that
  visitors to the public site never accidentally reach private routes.
- **Reports that scale.** As data grew, naive reports became slow.
  Aggregations were pushed closer to the database and result sets were
  paginated and bounded.
- **Mobile usability.** Field users open the portal on phones in low-light
  conditions, so the navigation, contrast and tap targets all had to be
  designed mobile-first rather than treating mobile as an afterthought.

## Roadmap

- Native-feeling **mobile attendance** capture for branch supervisors.
- **AI-driven anomaly alerts** on monthly payroll runs.
- **WhatsApp / email delivery** of invoices and payslips.
- Deeper **GST e-invoice** integration (IRN generation, e-way bills).
- **Biometric attendance** ingestion from on-site devices.
- Configurable **approval workflows** beyond the current two-step model.

## Screenshots & Demo

A live walkthrough of the public marketing site is available on the
production URL (see the project owner for the link).

Screenshots of the internal portal are intentionally omitted from this
public README to avoid leaking commercial or personal data. Approved,
masked screenshots can be added later under `docs/screenshots/` if needed:

```text
docs/screenshots/
  ├── dashboard.png        (TODO — masked)
  ├── payroll-approval.png (TODO — masked)
  └── invoice.png          (TODO — masked)
```

## License

Proprietary. All rights reserved. This codebase is not open-source and may
not be redistributed, sublicensed or used to operate a competing service
without written permission from the project owner.

## Contact

For business enquiries, please use the contact form on the public website.
For repository-related questions, open an issue on the connected GitHub
repository.
