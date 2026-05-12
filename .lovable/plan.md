# Post-Approval Cancel & Re-create — Plan

Goal: When a client disputes an already-approved bill, the CEO can cancel the paysheet and/or invoice and re-create a corrected one. No in-place edit. No data loss — full audit trail.

## Rules (agreed)

- **Scope**: Applies to both **paysheets** (after COO approval) and **invoices** (after Sent/Approved).
- **Cancel allowed only if no receipts exist** against the invoice. If any receipt is recorded, user must first reverse it from the Receipts screen, then cancel.
- **No edit-in-place**. Cancelled record is locked read-only; user clicks "Re-create" to spawn a fresh draft pre-filled from the cancelled one.
- **CEO role only** can cancel. COO/Accountant see the action greyed-out with tooltip.

## Backend changes

### 1. Status additions
- `paysheet_status` enum → add value `cancelled`.
- `invoice_status` enum → add value `cancelled`.
- New columns on `paysheets` and `invoices`:
  - `cancelled_at timestamptz`
  - `cancelled_by uuid`
  - `cancellation_reason text`
  - `replaced_by_id uuid` (link to the new draft created from this one)
  - `replaces_id uuid` (back-link on the new record)

### 2. RPC functions (SECURITY DEFINER, CEO-gated)

`cancel_invoice(_id uuid, _reason text)`
- Verify caller is CEO + active.
- Verify invoice status ∈ ('draft','sent','partially_paid','approved','overdue').
- Block if any non-deleted receipt rows reference this invoice → raise `RECEIPTS_EXIST`.
- Reverse any `financial_ledger` entry posted for this invoice (insert mirror entry, mark original `is_deleted`).
- Close any open `invoice_followups` with `closed_reason='invoice_cancelled'`.
- Set status='cancelled' + cancellation fields. Insert audit_logs row.

`cancel_paysheet(_id uuid, _reason uuid, _cascade_invoice bool)`
- CEO-only. Status must be 'approved' or 'submitted'.
- If linked invoice exists and not cancelled:
  - If `_cascade_invoice=true` → call `cancel_invoice` first (will fail if receipts exist).
  - Else raise `LINKED_INVOICE_EXISTS`.
- Reverse any compliance auto-postings tied to paysheet (mark related `compliance_payments` rows as needing re-link — flag only, no delete).
- Set status='cancelled', record audit.

`recreate_invoice(_old_id uuid)` and `recreate_paysheet(_old_id uuid)`
- CEO-only, original must be `cancelled`.
- Deep-copy the row into a new draft (new id, new number, status='draft'), set `replaces_id = _old_id` and back-fill `replaced_by_id` on the original.
- Returns new id so the UI can navigate to the edit form.

### 3. Triggers
- Update existing immutability triggers on `paysheets` and `invoices` to allow status transitions to `cancelled` only via the RPC (check `current_setting('app.bypass_lock', true) = 'on'` set inside the SECURITY DEFINER fn).

## Frontend changes

### Invoice View (`src/pages/app/invoices/InvoiceView.tsx`)
- Header action group (CEO only):
  - **Cancel Bill** button (red outline). Opens dialog → reason textarea (required, ≥10 chars) → confirm.
    - On `RECEIPTS_EXIST` error → toast "Reverse receipts first" + deep-link to Receipts list filtered by this invoice.
  - When status='cancelled': show **Re-create Invoice** button → calls RPC → navigates to `/app/invoices/:newId/edit`.
- Cancelled banner at top with reason, who, when, and link to replacement draft if any.
- Status badge styling: muted grey with strikethrough.

### Paysheet View (`src/pages/app/payroll/PaysheetView.tsx`)
- Same pattern: **Cancel Paysheet** button (CEO only).
  - Dialog includes checkbox "Also cancel linked invoice INV-xxx" (shown only if linked invoice exists and is cancellable).
  - On `LINKED_INVOICE_EXISTS` error → instruct user to tick the cascade box or cancel invoice first.
- **Re-create Paysheet** button on cancelled paysheets.

### List screens
- `InvoicesList.tsx` and `PaysheetList.tsx`: 
  - Add 'Cancelled' to status filter dropdown.
  - Strikethrough + grey row styling for cancelled entries.
  - Exclude cancelled from outstanding/aging totals (verify SQL views — see downstream below).

### Downstream impact (read-only verification + filter additions)
- **Aging Report, SOA, Followups, Cashbook, GST Report, Monthly Summary, Annual Summary, MoM, Comparative Analysis, Financial Dashboard KPIs**: add `status <> 'cancelled'` filter wherever invoices are aggregated.
- **Receipts list**: cancelled invoices already cannot have receipts (blocked at cancel-time), so no change.
- **Compliance payments**: paysheet cancellation does not delete already-paid PF/ESI challans — they remain but get a flag "linked paysheet cancelled" shown in payments list.

### Audit Log screen
- New action types `CANCEL_INVOICE`, `CANCEL_PAYSHEET`, `RECREATE_INVOICE`, `RECREATE_PAYSHEET` already captured by existing `audit_logs` insert path — just ensure filter chips include them.

## Out of scope
- Credit Note generation (deferred).
- Partial revision / line-item edits (deferred — explicitly rejected in favour of cancel + re-create).
- Notifying client by email of cancellation (manual for now).

## Files touched (estimate)
- 1 new migration (enums, columns, 4 RPCs, trigger updates).
- `InvoiceView.tsx`, `PaysheetView.tsx` — add action buttons + cancelled banner.
- `InvoicesList.tsx`, `PaysheetList.tsx` — status filter + row styling.
- ~8 report/aggregation queries — add `status <> 'cancelled'` filter.
- 1 small shared `CancelDialog.tsx` component.
