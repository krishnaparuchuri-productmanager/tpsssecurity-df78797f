// R-PAY — paysheet workflow and the database's own guards (sandbox, synthetic tagged data).
// Amounts are fixed test inputs; statutory calculations are NOT asserted here (awaiting
// owner confirmation of the payroll rules — see TESTING_CHECKPOINT open questions 1–5).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedInClient } from "../../support/clients";
import { accountFor } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { createSubmittedPaysheet, monthLabel, monthStart, paysheetRow, seedClientWithEmployees, type SeededClient } from "../support/seed";

const enabled = (["super_admin", "ceo_admin", "coo_ops", "accountant"] as const).every((r) => accountFor(r));
let sup: SupabaseClient, ceo: SupabaseClient, coo: SupabaseClient, acct: SupabaseClient;
const ceoCleanup = new CleanupRegistry();
const superCleanup = new CleanupRegistry();
let seed: SeededClient;

beforeAll(async () => {
  if (!enabled) return;
  [sup, ceo, coo, acct] = (await Promise.all([signedInClient("super_admin"), signedInClient("ceo_admin"), signedInClient("coo_ops"), signedInClient("accountant")])) as SupabaseClient[];
  seed = await seedClientWithEmployees(ceo, ceoCleanup, "PAY");
});

afterAll(async () => {
  if (!enabled) return;
  console.log("[cleanup super]", JSON.stringify(await superCleanup.run(sup)));
  console.log("[cleanup ceo]", JSON.stringify(await ceoCleanup.run(ceo)));
  await Promise.all([sup, ceo, coo, acct].map((c) => c.auth.signOut()));
});

const status = async (id: string) => (await ceo.from("paysheets").select("status").eq("id", id).single()).data?.status;

describe.skipIf(!enabled)("R-PAY paysheet workflow @regression", () => {
  it("R-PAY-01 Accountant creates a draft, adds rows and submits; COO approves", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);
    expect(await status(id)).toBe("submitted");
    const { data: rows } = await acct.from("paysheet_employees").select("employee_name").eq("paysheet_id", id);
    expect(rows).toHaveLength(seed.employeeIds.length);

    const { error } = await coo.rpc("approve_paysheet", { _id: id });
    expect(error).toBeNull();
    const { data: ps } = await ceo.from("paysheets").select("status, approved_by").eq("id", id).single();
    expect(ps!.status).toBe("approved");
    const { data: cooUser } = await coo.auth.getUser();
    expect(ps!.approved_by).toBe(cooUser.user!.id);
  });

  it("R-PAY-02 an Accountant cannot approve, by function or by direct update; status unchanged", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);
    const viaFunction = await acct.rpc("approve_paysheet", { _id: id });
    expect(viaFunction.error?.message).toMatch(/Only CEO or COO/);
    const viaUpdate = await acct.from("paysheets").update({ status: "approved" }).eq("id", id);
    expect(viaUpdate.error?.message).toMatch(/cannot (approve|be edited)|can only be set through the approval/i);
    expect(await status(id)).toBe("submitted");
  });

  it("R-PAY-03 rows of an approved paysheet are locked (no edit, no delete, no insert)", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);
    expect((await coo.rpc("approve_paysheet", { _id: id })).error).toBeNull();
    const { data: row } = await ceo.from("paysheet_employees").select("id, net_salary").eq("paysheet_id", id).limit(1).single();

    const edit = await acct.from("paysheet_employees").update({ net_salary: 999999 }).eq("id", row!.id);
    expect(edit.error?.message).toMatch(/parent paysheet is approved/);
    const del = await coo.from("paysheet_employees").delete().eq("id", row!.id);
    expect(del.error?.message).toMatch(/parent paysheet is approved/);
    const add = await acct.from("paysheet_employees").insert(paysheetRow(id, seed.employeeIds[0], seed.employeeNames[0], 1));
    expect(add.error?.message).toMatch(/parent paysheet is approved/);

    const { data: after } = await ceo.from("paysheet_employees").select("id, net_salary").eq("paysheet_id", id);
    expect(after).toHaveLength(seed.employeeIds.length);
    expect(after!.find((r) => r.id === row!.id)!.net_salary).toBe(row!.net_salary);
  });

  it("R-PAY-04 the database refuses creating a paysheet directly as 'submitted' (by design; the screen saves a draft first — see the D-6 browser test)", async () => {
    const { data: me } = await acct.auth.getUser();
    const { data: number } = await acct.rpc("gen_paysheet_number", { _month_date: monthStart(), _sandbox: true });
    const { data, error } = await acct
      .from("paysheets")
      .insert({ paysheet_number: number, client_id: seed.clientId, month: monthLabel(), month_date: monthStart(), total_days_in_month: 30, status: "submitted", submitted_by: me.user!.id, submitted_at: new Date().toISOString(), is_sandbox: true, created_by: me.user!.id })
      .select("id");
    if (data?.length) superCleanup.track({ table: "paysheets", id: data[0].id, labelColumn: "clients(client_name)", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_paysheet", args: { _id: data[0].id, _reason: "Automated test cleanup", _cascade_invoice: true } } });
    expect(error, "new paysheets must start as drafts").not.toBeNull();
  });

  it("R-PAY-05 cancel: Super Admin only, reason ≥ 10 characters, linked invoice must be cancelled first or cascaded", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);
    expect((await coo.rpc("approve_paysheet", { _id: id })).error).toBeNull();
    const { data: inv, error: iErr } = await acct
      .from("invoices")
      .insert({ invoice_number: "", client_id: seed.clientId, paysheet_id: id, month: monthLabel(), month_date: monthStart(), invoice_date: monthStart(), billing_lines: [{ description: "Security (test)", qty: 1, rate_per_month: 100 }], tds_percentage: 2, gst_applicable: true, gst_rcm: false, gst_percentage: 18, gst_type: "cgst_sgst", invoice_notes: seed.clientName, status: "sent", is_sandbox: true })
      .select("id")
      .single();
    expect(iErr).toBeNull();

    expect((await coo.rpc("cancel_paysheet", { _id: id, _reason: "Automated permission test", _cascade_invoice: true })).error?.message).toMatch(/Only Super Admin/);
    expect((await sup.rpc("cancel_paysheet", { _id: id, _reason: "too short", _cascade_invoice: true })).error?.message).toMatch(/at least 10 characters/);
    expect((await sup.rpc("cancel_paysheet", { _id: id, _reason: "Automated test cancellation", _cascade_invoice: false })).error?.message).toMatch(/LINKED_INVOICE_EXISTS/);
    expect(await status(id)).toBe("approved");

    expect((await sup.rpc("cancel_paysheet", { _id: id, _reason: "Automated test cancellation", _cascade_invoice: true })).error).toBeNull();
    expect(await status(id)).toBe("cancelled");
    const { data: invAfter } = await ceo.from("invoices").select("status").eq("id", inv!.id).single();
    expect(invAfter!.status).toBe("cancelled");

    // Cancelled paysheets can't be revived.
    const revive = await sup.from("paysheets").update({ status: "draft" }).eq("id", id);
    expect(revive.error?.message).toMatch(/immutable|can only be changed through Cancel \/ Re-create/);
  });

  it("R-PAY-06 recreate after cancellation creates a new draft linked to the old paysheet", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);
    expect((await sup.rpc("cancel_paysheet", { _id: id, _reason: "Automated test cancellation", _cascade_invoice: true })).error).toBeNull();
    const { data: newId, error } = await sup.rpc("recreate_paysheet", { _old_id: id });
    expect(error, "recreate_paysheet fails (finding D-8)").toBeNull();
    superCleanup.track({ table: "paysheets", id: newId as string, labelColumn: "clients(client_name)", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_paysheet", args: { _id: newId, _reason: "Automated test cleanup", _cascade_invoice: true } } });
    const { data: fresh } = await ceo.from("paysheets").select("status, replaces_id, client_id").eq("id", newId as string).single();
    expect(fresh!.status).toBe("draft");
    expect(fresh!.replaces_id).toBe(id);
    expect(fresh!.client_id).toBe(seed.clientId);
  });

  it("R-PAY-07a a draft (not yet submitted) paysheet can't be approved", async () => {
    const { data: me } = await acct.auth.getUser();
    const { data: number } = await acct.rpc("gen_paysheet_number", { _month_date: monthStart(), _sandbox: true });
    const { data: ps } = await acct.from("paysheets").insert({ paysheet_number: number, client_id: seed.clientId, month: monthLabel(), month_date: monthStart(), total_days_in_month: 30, status: "draft", is_sandbox: true, created_by: me.user!.id }).select("id").single();
    superCleanup.track({ table: "paysheets", id: ps!.id, labelColumn: "clients(client_name)", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_paysheet", args: { _id: ps!.id, _reason: "Automated test cleanup", _cascade_invoice: true } } });
    expect((await coo.rpc("approve_paysheet", { _id: ps!.id })).error?.message).toMatch(/Only submitted paysheets/);
    expect(await status(ps!.id)).toBe("draft");
  });

  it("R-PAY-07b approving a paysheet id that doesn't exist is reported as an error (not a silent success)", async () => {
    expect((await coo.rpc("approve_paysheet", { _id: randomUUID() })).error, "approve_paysheet returns success for a non-existent id (finding D-9)").not.toBeNull();
  });

  it.todo("R-PAY-08 duplicate paysheet for the same client + month: should the database block it? (screen only warns) — awaiting owner decision");
  it.todo("R-PAY-09 statutory amounts (PF, ESI, PT, uniform allowance, canteen, advances, rounding) — awaiting owner confirmation of rules 1–5");
});
