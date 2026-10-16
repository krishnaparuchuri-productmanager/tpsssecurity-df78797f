// R-RPT / R-XPT — reports exclude cancelled and draft records; the paysheet export endpoint
// returns the right paysheet to the right roles only. Synthetic tagged data.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedInClient } from "../../support/clients";
import { accountFor, loadTestConfig } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { guardedFetch } from "../../support/side-effects";
import { tagged } from "../../support/run-id";
import { createSubmittedPaysheet, monthLabel, monthStart, seedClientWithEmployees, today, type SeededClient } from "../support/seed";

const enabled = (["super_admin", "ceo_admin", "coo_ops", "accountant"] as const).every((r) => accountFor(r));
let sup: SupabaseClient, ceo: SupabaseClient, coo: SupabaseClient, acct: SupabaseClient;
const ceoCleanup = new CleanupRegistry();
const superCleanup = new CleanupRegistry();
let seed: SeededClient;

beforeAll(async () => {
  if (!enabled) return;
  [sup, ceo, coo, acct] = (await Promise.all([signedInClient("super_admin"), signedInClient("ceo_admin"), signedInClient("coo_ops"), signedInClient("accountant")])) as SupabaseClient[];
  seed = await seedClientWithEmployees(ceo, ceoCleanup, "RPT", 2);
});

afterAll(async () => {
  if (!enabled) return;
  console.log("[cleanup super]", JSON.stringify(await superCleanup.run(sup)));
  console.log("[cleanup ceo]", JSON.stringify(await ceoCleanup.run(ceo)));
  await Promise.all([sup, ceo, coo, acct].map((c) => c.auth.signOut()));
});

async function invoice(status: "draft" | "sent", amount: number) {
  const { data, error } = await acct
    .from("invoices")
    .insert({ invoice_number: "", client_id: seed.clientId, month: monthLabel(), month_date: monthStart(), invoice_date: today(), billing_lines: [{ description: "Security (test)", qty: 1, rate_per_month: amount }], tds_percentage: 0, gst_applicable: false, gst_rcm: false, gst_percentage: 0, gst_type: "cgst_sgst", invoice_notes: tagged("Test invoice"), status, is_sandbox: true })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  superCleanup.track({ table: "invoices", id: data.id, labelColumn: "invoice_notes", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_invoice", args: { _id: data.id, _reason: "Automated test cleanup" } } });
  return data.id as string;
}

describe.skipIf(!enabled)("R-RPT report totals @regression", () => {
  it("R-RPT-01 month-on-month billing counts issued invoices only (drafts and cancelled excluded)", async () => {
    await invoice("sent", 300);
    await invoice("draft", 7000);
    const cancelled = await invoice("sent", 9000);
    expect((await sup.rpc("cancel_invoice", { _id: cancelled, _reason: "Automated test cancellation" })).error).toBeNull();

    const { data, error } = await acct.rpc("mom_metric_series", { _metric: "billing", _branch_id: null, _client_id: seed.clientId, _months: 1 });
    expect(error).toBeNull();
    const thisMonth = (data as Array<{ month_label: string; month_start: string; value: number }>).find((r) => r.month_start === monthStart());
    expect(Number(thisMonth?.value), "only the ₹300 issued invoice counts").toBe(300);
  });
});

describe.skipIf(!enabled)("R-XPT paysheet export endpoint @regression", () => {
  async function callExport(client: SupabaseClient | null, paysheetId: string) {
    const cfg = loadTestConfig();
    const token = client ? (await client.auth.getSession()).data.session!.access_token : null;
    return guardedFetch(`${cfg.supabaseUrl}/functions/v1/export-paysheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ paysheet_id: paysheetId }),
    });
  }

  it("R-XPT-01 COO receives exactly this paysheet's rows; Accountant is refused (403); signed-out is refused (401)", async () => {
    const id = await createSubmittedPaysheet(acct, superCleanup, seed);

    const ok = await callExport(coo, id);
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { paysheet: { id: string; client_id: string }; employees: Array<{ employee_name: string }> };
    expect(body.paysheet.id).toBe(id);
    expect(body.paysheet.client_id).toBe(seed.clientId);
    expect(body.employees.map((e) => e.employee_name).sort()).toEqual([...seed.employeeNames].sort());

    expect((await callExport(acct, id)).status).toBe(403);
    expect((await callExport(null, id)).status).toBe(401);
  });
});
