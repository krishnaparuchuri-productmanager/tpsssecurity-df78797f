// R-INV — invoices, receipts, reversals and the ledger (sandbox, synthetic tagged data, tiny amounts).
// Tax bases and rates are NOT asserted (awaiting owner confirmation, question 6). What IS asserted:
// the invoice's own totals add up, numbering works, payment status/outstanding move correctly,
// receipts post to the ledger, and only a Super Admin can reverse/cancel.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedInClient } from "../../support/clients";
import { accountFor } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { tagged } from "../../support/run-id";
import { monthLabel, monthStart, seedClientWithEmployees, today, type SeededClient } from "../support/seed";

const enabled = (["super_admin", "ceo_admin", "coo_ops", "accountant"] as const).every((r) => accountFor(r));
let sup: SupabaseClient, ceo: SupabaseClient, coo: SupabaseClient, acct: SupabaseClient;
const ceoCleanup = new CleanupRegistry();
const superCleanup = new CleanupRegistry();
let seed: SeededClient;

beforeAll(async () => {
  if (!enabled) return;
  [sup, ceo, coo, acct] = (await Promise.all([signedInClient("super_admin"), signedInClient("ceo_admin"), signedInClient("coo_ops"), signedInClient("accountant")])) as SupabaseClient[];
  seed = await seedClientWithEmployees(ceo, ceoCleanup, "INV", 1);
});

afterAll(async () => {
  if (!enabled) return;
  console.log("[cleanup super]", JSON.stringify(await superCleanup.run(sup)));
  console.log("[cleanup ceo]", JSON.stringify(await ceoCleanup.run(ceo)));
  await Promise.all([sup, ceo, coo, acct].map((c) => c.auth.signOut()));
});

const LINES = [
  { description: "Security Services (test)", qty: 2, rate_per_month: 100 },
  { description: "Supervisor (test)", qty: 1, rate_per_month: 150 },
];

async function createInvoice(opts: { status?: "draft" | "sent"; rcm?: boolean } = {}) {
  const { data, error } = await acct
    .from("invoices")
    .insert({
      invoice_number: "", client_id: seed.clientId, month: monthLabel(), month_date: monthStart(), invoice_date: today(),
      billing_lines: LINES, tds_percentage: 2, gst_applicable: true, gst_rcm: !!opts.rcm, gst_percentage: 18, gst_type: "cgst_sgst",
      deduction_rows: [], invoice_notes: tagged("Test invoice"), status: opts.status ?? "sent", is_sandbox: true,
    })
    .select("*")
    .single();
  if (error) throw new Error(`create invoice: ${error.message}`);
  superCleanup.track({ table: "invoices", id: data.id, labelColumn: "invoice_notes", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_invoice", args: { _id: data.id, _reason: "Automated test cleanup" } } });
  return data;
}

async function pay(invoice: { id: string; client_id: string }, amount: number) {
  const { data: rec } = await acct.rpc("gen_receipt_number", { _d: today(), _sandbox: true });
  const { data: me } = await acct.auth.getUser();
  const { data, error } = await acct
    .from("payments")
    .insert({ receipt_number: rec, client_id: invoice.client_id, invoice_id: invoice.id, payment_date: today(), amount, payment_mode: "NEFT", notes: tagged("Test receipt"), recorded_by: me.user!.id, is_sandbox: true })
    .select("id")
    .single();
  if (error) throw new Error(`record payment: ${error.message}`);
  superCleanup.track({ table: "payments", id: data.id, labelColumn: "notes", undo: { kind: "rpc", fn: "reverse_payment", args: { _id: data.id, _reason: "Automated test cleanup" } } });
  return data.id as string;
}

const reload = async (id: string) => (await ceo.from("invoices").select("*").eq("id", id).single()).data!;

describe.skipIf(!enabled)("R-INV invoices and receipts @regression", () => {
  it("R-INV-01 the database fills in the invoice number and totals that add up", async () => {
    const inv = await createInvoice();
    expect(inv.invoice_number).toMatch(/\S/);
    expect(inv.is_sandbox).toBe(true);
    const lineSum = LINES.reduce((s, l) => s + l.qty * l.rate_per_month, 0);
    expect(Number(inv.billing_amount)).toBe(lineSum);
    expect(Number(inv.total_invoice_value)).toBeCloseTo(Number(inv.billing_amount) + Number(inv.gst_amount), 2);
    expect(Number(inv.amount_receivable)).toBeCloseTo(Number(inv.total_invoice_value) - Number(inv.tds_amount), 2);
    expect(Number(inv.outstanding_amount)).toBeCloseTo(Number(inv.amount_receivable), 2);
    expect(inv.amount_in_words).toMatch(/\S/);
  });

  it("R-INV-02 invoice numbers are unique across invoices", async () => {
    const a = await createInvoice({ status: "draft" });
    const b = await createInvoice({ status: "draft" });
    expect(a.invoice_number).not.toBe(b.invoice_number);
  });

  it("R-INV-03 partial then full payment move status and outstanding, and each receipt posts to the ledger", async () => {
    const inv = await createInvoice();
    const receivable = Number(inv.amount_receivable);

    const p1 = await pay(inv, 100);
    let now = await reload(inv.id);
    expect(now.status).toBe("partially_paid");
    expect(Number(now.amount_received)).toBe(100);
    expect(Number(now.outstanding_amount)).toBeCloseTo(receivable - 100, 2);
    const { data: ledger1 } = await ceo.from("financial_ledger").select("credit_amount, reference_type").eq("reference_id", p1);
    expect(ledger1).toEqual([{ credit_amount: 100, reference_type: "payment" }]);

    await pay(inv, Number((receivable - 100).toFixed(2)));
    now = await reload(inv.id);
    expect(now.status).toBe("paid");
    expect(Number(now.outstanding_amount)).toBeCloseTo(0, 2);
  });

  it("R-INV-04 only a Super Admin can reverse a receipt; reversal restores the outstanding and posts a ledger reversal", async () => {
    const inv = await createInvoice();
    const p = await pay(inv, 100);
    expect((await acct.rpc("reverse_payment", { _id: p, _reason: "Automated permission test" })).error?.message).toMatch(/Only Super Admin/);
    expect((await sup.rpc("reverse_payment", { _id: p, _reason: "short" })).error?.message).toMatch(/at least 10 characters/);

    const { error } = await sup.rpc("reverse_payment", { _id: p, _reason: "Automated test reversal" });
    expect(error).toBeNull();
    const now = await reload(inv.id);
    expect(Number(now.amount_received)).toBe(0);
    expect(Number(now.outstanding_amount)).toBeCloseTo(Number(now.amount_receivable), 2);
    expect(["sent", "overdue"]).toContain(now.status);
    const { data: ledger } = await ceo.from("financial_ledger").select("debit_amount, credit_amount").eq("reference_id", p);
    const net = (ledger ?? []).reduce((s, r) => s + Number(r.credit_amount) - Number(r.debit_amount), 0);
    expect(net, "receipt and its reversal cancel out in the ledger").toBeCloseTo(0, 2);
  });

  it("R-INV-05 an invoice with receipts can't be cancelled until they are reversed; only a Super Admin cancels", async () => {
    const inv = await createInvoice();
    const p = await pay(inv, 50);
    expect((await coo.rpc("cancel_invoice", { _id: inv.id, _reason: "Automated permission test" })).error?.message).toMatch(/Only Super Admin/);
    expect((await sup.rpc("cancel_invoice", { _id: inv.id, _reason: "Automated test cancellation" })).error?.message).toMatch(/RECEIPTS_EXIST/);
    expect((await sup.rpc("reverse_payment", { _id: p, _reason: "Automated test reversal" })).error).toBeNull();
    expect((await sup.rpc("cancel_invoice", { _id: inv.id, _reason: "Automated test cancellation" })).error).toBeNull();
    expect((await reload(inv.id)).status).toBe("cancelled");
  });

  it("R-INV-06 recreate a cancelled invoice (Super Admin only): a new draft with the same billing lines", async () => {
    const inv = await createInvoice();
    expect((await sup.rpc("cancel_invoice", { _id: inv.id, _reason: "Automated test cancellation" })).error).toBeNull();
    expect((await acct.rpc("recreate_invoice", { _old_id: inv.id })).error?.message).toMatch(/Only Super Admin/);
    const { data: newId, error } = await sup.rpc("recreate_invoice", { _old_id: inv.id });
    expect(error).toBeNull();
    superCleanup.track({ table: "invoices", id: newId as string, labelColumn: "invoice_notes", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_invoice", args: { _id: newId, _reason: "Automated test cleanup" } } });
    const fresh = await reload(newId as string);
    expect(fresh.status).toBe("draft");
    expect(Number(fresh.billing_amount)).toBe(Number(inv.billing_amount));
    expect(fresh.invoice_number).not.toBe(inv.invoice_number);
  });

  it.todo("R-INV-07 tax rules: TDS base (before/after GST), GST under reverse charge, CGST+SGST vs IGST split — awaiting owner confirmation (question 6)");
  it("R-INV-08 the database refuses a receipt larger than the outstanding amount (owner decision, question 12)", async () => {
    const inv = await createInvoice();
    const receivable = Number(inv.amount_receivable);
    const { data: rec } = await acct.rpc("gen_receipt_number", { _d: today(), _sandbox: true });
    const { data: me } = await acct.auth.getUser();
    const over = await acct.from("payments").insert({ receipt_number: rec, client_id: inv.client_id, invoice_id: inv.id, payment_date: today(), amount: receivable + 1, payment_mode: "NEFT", notes: tagged("Test receipt"), recorded_by: me.user!.id, is_sandbox: true }).select("id");
    if (over.data?.length) superCleanup.track({ table: "payments", id: over.data[0].id, labelColumn: "notes", undo: { kind: "rpc", fn: "reverse_payment", args: { _id: over.data[0].id, _reason: "Automated test cleanup" } } });
    expect(over.error?.message).toMatch(/OVERPAYMENT/);

    await pay(inv, Number(receivable.toFixed(2)));
    expect((await reload(inv.id)).status).toBe("paid");
    await expect(pay(inv, 1), "no further receipt once fully paid").rejects.toThrow(/OVERPAYMENT/);
  });

  it("R-INV-09 a late payment in a new financial year is recorded against the original invoice (number unchanged; receipt numbered by payment month)", async () => {
    // Invoice dated in the previous financial year (March), paid today.
    const { data: inv, error } = await acct
      .from("invoices")
      .insert({ invoice_number: "", client_id: seed.clientId, month: "Mar 2026", month_date: "2026-03-01", invoice_date: "2026-03-20", billing_lines: LINES, tds_percentage: 2, gst_applicable: true, gst_rcm: false, gst_percentage: 18, gst_type: "cgst_sgst", deduction_rows: [], invoice_notes: tagged("Test invoice"), status: "sent", is_sandbox: true })
      .select("*")
      .single();
    expect(error).toBeNull();
    superCleanup.track({ table: "invoices", id: inv!.id, labelColumn: "invoice_notes", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_invoice", args: { _id: inv!.id, _reason: "Automated test cleanup" } } });

    const paymentId = await pay(inv!, Number(Number(inv!.amount_receivable).toFixed(2)));
    const after = await reload(inv!.id);
    expect(after.invoice_number, "original invoice keeps its number").toBe(inv!.invoice_number);
    expect(after.status).toBe("paid");
    const { data: receipt } = await ceo.from("payments").select("receipt_number, payment_date").eq("id", paymentId).single();
    const monthTag = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase() + new Date().getFullYear();
    expect(receipt!.receipt_number, "receipt numbered in the payment month (new year)").toContain(monthTag);
    expect(receipt!.payment_date).toBe(today());
  });
});
