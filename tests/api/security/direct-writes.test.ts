// X-04 / X-11 — writes that go around the app's own steps, made directly against the database with each
// role's real session. Each test states the SAFE expectation; a failure is a finding, not a test bug.
// Only run-tagged test records are touched; cleanup cancels them as the QA Super Admin.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedInClient } from "../../support/clients";
import { accountFor } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { tagged } from "../../support/run-id";
import { createSubmittedPaysheet, monthLabel, monthStart, paysheetRow, seedClientWithEmployees, today, type SeededClient } from "../support/seed";

const enabled = (["super_admin", "ceo_admin", "coo_ops", "accountant", "inactive"] as const).every((r) => accountFor(r));
let sup: SupabaseClient, ceo: SupabaseClient, coo: SupabaseClient, acct: SupabaseClient, inactive: SupabaseClient;
const ceoCleanup = new CleanupRegistry();
const superCleanup = new CleanupRegistry();
let seed: SeededClient;

beforeAll(async () => {
  if (!enabled) return;
  [sup, ceo, coo, acct, inactive] = (await Promise.all(["super_admin", "ceo_admin", "coo_ops", "accountant", "inactive"].map((r) => signedInClient(r as never)))) as SupabaseClient[];
  seed = await seedClientWithEmployees(ceo, ceoCleanup, "SEC", 1);
});

afterAll(async () => {
  if (!enabled) return;
  console.log("[cleanup super]", JSON.stringify(await superCleanup.run(sup)));
  console.log("[cleanup ceo]", JSON.stringify(await ceoCleanup.run(ceo)));
  await Promise.all([sup, ceo, coo, acct, inactive].map((c) => c.auth.signOut()));
});

const paysheet = async (id: string) => (await ceo.from("paysheets").select("status, approved_by, total_net_salary").eq("id", id).single()).data!;

async function testInvoice() {
  const { data, error } = await acct
    .from("invoices")
    .insert({ invoice_number: "", client_id: seed.clientId, month: monthLabel(), month_date: monthStart(), invoice_date: today(), billing_lines: [{ description: "Security (test)", qty: 1, rate_per_month: 100 }], tds_percentage: 0, gst_applicable: false, gst_rcm: false, gst_percentage: 0, gst_type: "cgst_sgst", invoice_notes: tagged("Test invoice"), status: "sent", is_sandbox: true })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  superCleanup.track({ table: "invoices", id: data.id, labelColumn: "invoice_notes", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_invoice", args: { _id: data.id, _reason: "Automated test cleanup" } } });
  return data;
}

describe.skipIf(!enabled)("X-04 direct writes around the app's steps @security", () => {
  it("X-04-01 a COO cannot mark a submitted paysheet approved by editing it directly (must use the approval step)", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);
    const { data: updated } = await coo.from("paysheets").update({ status: "approved" }).eq("id", id).select("id");
    const after = await paysheet(id);
    expect({ rowsChanged: updated?.length ?? 0, status: after.status }, "direct approval bypasses approve_paysheet (advance deductions, notification, audit)").toEqual({ rowsChanged: 0, status: "submitted" });
  });

  it("X-04-02 an approved paysheet's totals can't be changed afterwards", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);
    expect((await coo.rpc("approve_paysheet", { _id: id })).error).toBeNull();
    const before = await paysheet(id);
    await coo.from("paysheets").update({ total_net_salary: 999999 }).eq("id", id);
    expect((await paysheet(id)).total_net_salary, "approved paysheet header is editable").toBe(before.total_net_salary);
  });

  it("X-04-03 (D-1) the database rejects paysheet rows whose amounts don't add up", async () => {
    const { data: me } = await acct.auth.getUser();
    const { data: number } = await acct.rpc("gen_paysheet_number", { _month_date: monthStart(), _sandbox: true });
    const { data: ps } = await acct.from("paysheets").insert({ paysheet_number: number, client_id: seed.clientId, month: monthLabel(), month_date: monthStart(), total_days_in_month: 30, status: "draft", is_sandbox: true, created_by: me.user!.id }).select("id").single();
    superCleanup.track({ table: "paysheets", id: ps!.id, labelColumn: "clients(client_name)", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_paysheet", args: { _id: ps!.id, _reason: "Automated test cleanup", _cascade_invoice: true } } });
    // Earned ₹100 but net pay ₹999,999 — impossible figures.
    const { error } = await acct.from("paysheet_employees").insert({ ...paysheetRow(ps!.id, seed.employeeIds[0], seed.employeeNames[0], 999999) });
    expect(error, "inconsistent salary amounts are stored as sent by the browser (finding D-1)").not.toBeNull();
  });

  it("X-04-04 an Accountant cannot mark an invoice paid without a receipt", async () => {
    const inv = await testInvoice();
    await acct.from("invoices").update({ amount_received: inv.amount_receivable, status: "paid" }).eq("id", inv.id);
    const { data: after } = await ceo.from("invoices").select("status, amount_received").eq("id", inv.id).single();
    const { data: receipts } = await ceo.from("payments").select("id").eq("invoice_id", inv.id);
    expect({ status: after!.status, received: Number(after!.amount_received), receipts: receipts!.length }, "invoice marked paid with no receipt").toEqual({ status: "sent", received: 0, receipts: 0 });
  });

  it("X-04-05 a recorded receipt can't be edited or deleted directly (only reversed by a Super Admin)", async () => {
    const inv = await testInvoice();
    const { data: me } = await acct.auth.getUser();
    const { data: rec } = await acct.rpc("gen_receipt_number", { _d: today(), _sandbox: true });
    const { data: p } = await acct.from("payments").insert({ receipt_number: rec, client_id: inv.client_id, invoice_id: inv.id, payment_date: today(), amount: 50, payment_mode: "NEFT", notes: tagged("Test receipt"), recorded_by: me.user!.id, is_sandbox: true }).select("id").single();
    superCleanup.track({ table: "payments", id: p!.id, labelColumn: "notes", undo: { kind: "rpc", fn: "reverse_payment", args: { _id: p!.id, _reason: "Automated test cleanup" } } });
    const edit = await acct.from("payments").update({ amount: 1 }).eq("id", p!.id).select("id");
    const del = await acct.from("payments").delete().eq("id", p!.id).select("id");
    expect([edit.data?.length ?? 0, del.data?.length ?? 0]).toEqual([0, 0]);
    const { data: still } = await ceo.from("payments").select("amount").eq("id", p!.id).single();
    expect(Number(still!.amount)).toBe(50);
  });
});

describe.skipIf(!enabled)("X-07 cash book and internal functions @security", () => {
  it("X-07-01 staff cannot post entries straight into the cash book (ledger)", async () => {
    const { data, error } = await acct.from("financial_ledger").insert({ voucher_number: tagged("TEST-PROBE"), entry_date: today(), entry_type: "receipt", category: "payment_received", particulars: tagged("Security probe"), debit_amount: 0, credit_amount: 0, balance_after: 0, is_sandbox: true }).select("id");
    expect({ inserted: data?.length ?? 0, refused: !!error }, "direct ledger entry accepted").toEqual({ inserted: 0, refused: true });
  });

  it.each([
    ["generate_recovery_schedule", { _advance_id: "00000000-0000-0000-0000-000000000000" }],
    ["apply_advance_deductions_on_approve", { _paysheet_id: "00000000-0000-0000-0000-000000000000" }],
    ["mark_overdue_invoices", {}],
    ["get_user_role", { _user_id: "00000000-0000-0000-0000-000000000000" }],
  ])("X-07-02 a signed-in user cannot call the internal function %s", async (fn, args) => {
    const { error } = await acct.rpc(fn, args);
    expect(error?.message ?? "", `${fn} is callable by a signed-in user`).toMatch(/permission denied/i);
  });
});

describe.skipIf(!enabled)("X-02c allowed CRM work still works @security", () => {
  it("X-02c-01 a COO can create a lead, edit it and log an activity", async () => {
    const { data: lead, error } = await coo.from("crm_leads").insert({ lead_number: tagged("LEAD-TEST-COO"), source: "referral", status: "new", priority: "medium", company_name: tagged("Test Prospect COO"), contact_person_name: "Test Contact", phone: "9000000008", is_sandbox: true }).select("id").single();
    expect(error).toBeNull();
    ceoCleanup.track({ table: "crm_leads", id: lead!.id, labelColumn: "company_name", undo: { kind: "update", values: { is_deleted: true }, reason: "CRM leads have no delete; marked deleted" } });
    const { data: edited } = await coo.from("crm_leads").update({ priority: "high" }).eq("id", lead!.id).select("id");
    expect(edited).toHaveLength(1);
    const { error: aErr } = await coo.from("crm_lead_activities").insert({ lead_id: lead!.id, activity_type: "call_made", activity_datetime: new Date().toISOString(), notes: tagged("Test activity") });
    expect(aErr).toBeNull();
  });
});

describe.skipIf(!enabled)("X-06 deactivated users @security", () => {
  it("X-06-01 a deactivated user sees no CRM leads or lead activities", async () => {
    const { data: leads } = await inactive.from("crm_leads").select("id").limit(1);
    const { data: acts } = await inactive.from("crm_lead_activities").select("id").limit(1);
    expect({ leads: leads?.length ?? 0, activities: acts?.length ?? 0 }, "CRM tables have no active-user check").toEqual({ leads: 0, activities: 0 });
  });

  it("X-06-02 a deactivated user cannot request an advance or record an expense", async () => {
    expect((await inactive.rpc("request_advance", { _payload: { employee_id: seed.employeeIds[0], advance_type: "salary_advance", total_amount: 1, monthly_deduction: 1, recovery_start_month: monthStart(), reason: tagged("Test advance") } })).error?.message).toMatch(/Inactive user/);
    expect((await inactive.rpc("record_expense_v2", { _payload: { amount: 1, category_id: seed.clientId, description: tagged("Test expense"), payment_mode: "Cash" } })).error?.message).toMatch(/Inactive user/);
  });
});

describe.skipIf(!enabled)("X-02b view-only roles @security", () => {
  it("X-02b-01 an Accountant (view-only on CRM leads) cannot edit a lead", async () => {
    const { data: lead } = await ceo.from("crm_leads").insert({ lead_number: tagged("LEAD-TEST-VIEW"), source: "referral", status: "new", priority: "medium", company_name: tagged("Test Prospect"), contact_person_name: "Test Contact", phone: "9000000009", is_sandbox: true }).select("id").single();
    if (lead) ceoCleanup.track({ table: "crm_leads", id: lead.id, labelColumn: "company_name", undo: { kind: "update", values: { is_deleted: true }, reason: "CRM leads have no delete; marked deleted" } });
    expect(lead, "CEO can create the test lead").not.toBeNull();
    const { data: changed } = await acct.from("crm_leads").update({ priority: "high" }).eq("id", lead!.id).select("id");
    expect(changed?.length ?? 0, "view-only role edited a CRM lead").toBe(0);
  });
});
