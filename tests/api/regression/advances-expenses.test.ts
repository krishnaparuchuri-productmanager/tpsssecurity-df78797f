// R-ADV / R-EXP — employee advances and expenses, with segregation-of-duties rules enforced by the database.
// Synthetic tagged data; ₹1–₹200 amounts so sandbox totals barely move.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedInClient } from "../../support/clients";
import { accountFor } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { tagged } from "../../support/run-id";
import { monthStart, seedClientWithEmployees, today, type SeededClient } from "../support/seed";

const enabled = (["ceo_admin", "coo_ops", "accountant"] as const).every((r) => accountFor(r));
let ceo: SupabaseClient, coo: SupabaseClient, acct: SupabaseClient;
const ceoCleanup = new CleanupRegistry();
const acctCleanup = new CleanupRegistry();
let seed: SeededClient;
let categoryId: string;

beforeAll(async () => {
  if (!enabled) return;
  [ceo, coo, acct] = (await Promise.all([signedInClient("ceo_admin"), signedInClient("coo_ops"), signedInClient("accountant")])) as SupabaseClient[];
  seed = await seedClientWithEmployees(ceo, ceoCleanup, "ADV", 1);
  const { data: cat } = await acct.from("expense_categories").select("id").eq("is_active", true).order("sort_order").limit(1).single();
  categoryId = cat!.id;
});

afterAll(async () => {
  if (!enabled) return;
  console.log("[cleanup accountant]", JSON.stringify(await acctCleanup.run(acct)));
  console.log("[cleanup ceo]", JSON.stringify(await ceoCleanup.run(ceo)));
  await Promise.all([ceo, coo, acct].map((c) => c.auth.signOut()));
});

async function requestAdvance(by: SupabaseClient, total = 200, monthly = 50) {
  const { data, error } = await by.rpc("request_advance", {
    _payload: { employee_id: seed.employeeIds[0], advance_type: "salary_advance", advance_date: today(), total_amount: total, monthly_deduction: monthly, recovery_start_month: monthStart(), reason: tagged("Test advance") },
  });
  if (!error) acctCleanup.track({ table: "employee_advances", id: data as string, labelColumn: "reason", alreadyDone: { column: "status", value: ["active", "cancelled", "completed"] }, undo: { kind: "rpc", fn: "cancel_advance", args: { _id: data } } });
  return { id: data as string, error };
}

describe.skipIf(!enabled)("R-ADV advances @regression", () => {
  it("R-ADV-01 Accountant requests, COO approves; a recovery schedule is created that adds up to the advance", async () => {
    const { id, error } = await requestAdvance(acct, 200, 50);
    expect(error).toBeNull();
    const { data: pending } = await ceo.from("employee_advances").select("status, amount_remaining").eq("id", id).single();
    expect(pending).toMatchObject({ status: "pending", amount_remaining: 200 });

    expect((await coo.rpc("approve_advance", { _id: id })).error).toBeNull();
    const { data: active } = await ceo.from("employee_advances").select("status").eq("id", id).single();
    expect(active!.status).toBe("active");
    const { data: schedule } = await ceo.from("advance_recovery_schedule").select("scheduled_amount").eq("advance_id", id);
    expect(schedule!.length).toBe(4);
    expect(schedule!.reduce((s, r) => s + Number(r.scheduled_amount), 0)).toBe(200);
  });

  it("R-ADV-02 an Accountant cannot approve an advance; a COO cannot request one", async () => {
    const { id } = await requestAdvance(acct);
    expect((await acct.rpc("approve_advance", { _id: id })).error?.message).toMatch(/Only CEO\/COO/);
    expect((await requestAdvance(coo)).error?.message).toMatch(/Only accountants can request/);
    const { data } = await ceo.from("employee_advances").select("status").eq("id", id).single();
    expect(data!.status).toBe("pending");
  });

  it("R-ADV-03 advances can't be written directly, only through the request/approve functions", async () => {
    const { error } = await acct.from("employee_advances").insert({ advance_number: "X", employee_id: seed.employeeIds[0], advance_type: "salary_advance", total_amount: 1, monthly_deduction: 1, recovery_start_month: monthStart(), is_sandbox: true });
    expect(error).not.toBeNull();
  });

  it("R-ADV-04 the requester can cancel their own pending advance", async () => {
    const { id } = await requestAdvance(acct);
    expect((await acct.rpc("cancel_advance", { _id: id })).error).toBeNull();
    const { data } = await ceo.from("employee_advances").select("status").eq("id", id).single();
    expect(data!.status).toBe("cancelled");
  });

  it.todo("R-ADV-05 may a CEO request AND approve the same advance? (currently allowed) — awaiting owner decision (question 7)");
});

describe.skipIf(!enabled)("R-EXP expenses @regression", () => {
  async function record(by: SupabaseClient, status: "draft" | "approved", amount = 1) {
    const { data, error } = await by.rpc("record_expense_v2", {
      _payload: { expense_date: today(), category_id: categoryId, description: tagged("Test expense"), amount, payment_mode: "Cash", status },
    });
    return { id: data as string | null, error };
  }

  it("R-EXP-01 Accountant records a draft; COO approves it and it posts to the ledger", async () => {
    const { id, error } = await record(acct, "draft");
    expect(error).toBeNull();
    expect((await coo.rpc("approve_expense", { _id: id })).error).toBeNull();
    const { data } = await ceo.from("expenses").select("status, ledger_entry_id").eq("id", id!).single();
    expect(data!.status).toBe("approved");
    expect(data!.ledger_entry_id, "approved expense is linked to a ledger entry").not.toBeNull();
  });

  it("R-EXP-02 an Accountant cannot approve their own expense, and no self-approved expense can come into being", async () => {
    const draft = await record(acct, "draft");
    expect((await acct.rpc("approve_expense", { _id: draft.id })).error?.message).toMatch(/Cannot approve your own expense/);

    const direct = await record(acct, "approved");
    expect(direct.error, "saving as 'approved' must not succeed for the recorder").not.toBeNull();
    const me = (await acct.auth.getUser()).data.user!.id;
    const { data: leaked } = await ceo.from("expenses").select("id").eq("description", tagged("Test expense")).eq("recorded_by", me).eq("approved_by", me);
    expect(leaked, "no expense approved by the same Accountant who recorded it").toEqual([]);
  });

  it("R-EXP-04 the New Expense screen's 'Approved (post to ledger now)' option works for a CEO (allowed to self-approve)", async () => {
    const direct = await record(ceo, "approved");
    expect(direct.error, "recording an expense directly as approved fails for everyone (finding D-7)").toBeNull();
  });

  it("R-EXP-03 amount must be positive and expenses can't be written directly", async () => {
    expect((await record(acct, "draft", 0)).error?.message).toMatch(/Amount must be > 0/);
    const direct = await acct.from("expenses").insert({ expense_number: "X", category_id: categoryId, description: tagged("Test expense"), amount: 1, payment_mode: "Cash", is_sandbox: true });
    expect(direct.error).not.toBeNull();
  });
});
