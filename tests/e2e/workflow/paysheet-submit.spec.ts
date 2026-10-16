// D-6 regression through the real screen: an Accountant creates a brand-new paysheet and presses
// "Submit for Approval" without saving a draft first. Synthetic tagged client + employee (fake UAN);
// PF/ESI off for the test client so no blocking anomalies. Cleanup: paysheet cancelled by the QA Super
// Admin, employee relieved, client deactivated.
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "../fixtures";
import { expectAppShell, loginAndWaitForDashboard, watchAppErrors } from "../helpers";
import { signedInClient } from "../../support/clients";
import { accountFor } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { tagged } from "../../support/run-id";

test("D-6 a new paysheet can be submitted straight from the Create Paysheet screen @regression", async ({ page }) => {
  test.skip(!(accountFor("accountant") && accountFor("ceo_admin") && accountFor("super_admin")), "accounts not configured");
  test.setTimeout(180_000);

  const ceo: SupabaseClient = (await signedInClient("ceo_admin"))!;
  const sup: SupabaseClient = (await signedInClient("super_admin"))!;
  const ceoCleanup = new CleanupRegistry();
  const superCleanup = new CleanupRegistry();
  const clientName = tagged("Test Client PSUI");
  const employeeName = tagged("Test Employee PSUI");

  try {
    const { data: me } = await ceo.auth.getUser();
    const { data: client } = await ceo.from("clients").insert({ client_name: clientName, client_code: "", service_type: "Security", client_type: "company_firm", pf_applicable: false, esi_applicable: false, pt_applicable: false, gst_applicable: false, is_active: true, is_sandbox: true, created_by: me.user!.id }).select("id").single();
    ceoCleanup.track({ table: "clients", id: client!.id, labelColumn: "client_name", undo: { kind: "update", values: { is_active: false }, reason: "clients cannot be deleted; deactivated" } });
    const { data: emp } = await ceo.from("employees").insert({ full_name: employeeName, designation: "S.GUARD", client_id: client!.id, date_of_joining: new Date().toISOString().slice(0, 10), status: "Active", employee_code: "", uan_number: "900000000001", basic: 100, da: 0, is_sandbox: true, created_by: me.user!.id }).select("id").single();
    ceoCleanup.track({ table: "employees", id: emp!.id, labelColumn: "full_name", undo: { kind: "update", values: { status: "Relieved" }, reason: "referenced by test paysheet; relieved" } });

    await loginAndWaitForDashboard(page, "accountant");
    const watch = watchAppErrors(page);
    await page.goto("/app/payroll/create");
    await expectAppShell(page);
    await page.getByRole("combobox").filter({ hasText: "Select client" }).click();
    await page.getByRole("option", { name: clientName }).click();
    await page.getByRole("button", { name: /Load Employees/ }).click();
    await expect(page.getByText(employeeName).or(page.locator(`input[value="${employeeName}"]`)).first()).toBeVisible();
    await page.getByRole("button", { name: /Next: Summary/ }).click();
    await page.getByRole("button", { name: /Submit for Approval/ }).click();
    await expect(page).toHaveURL(/\/app\/payroll\/list$/);

    const { data: sheets } = await ceo.from("paysheets").select("id, status, submitted_by").eq("client_id", client!.id);
    for (const s of sheets ?? []) superCleanup.track({ table: "paysheets", id: s.id, labelColumn: "clients(client_name)", alreadyDone: { column: "status", value: "cancelled" }, undo: { kind: "rpc", fn: "cancel_paysheet", args: { _id: s.id, _reason: "Automated test cleanup", _cascade_invoice: true } } });
    expect(sheets, "exactly one paysheet created").toHaveLength(1);
    expect(sheets![0].status).toBe("submitted");
    const { data: rows } = await ceo.from("paysheet_employees").select("employee_name").eq("paysheet_id", sheets![0].id);
    expect(rows!.map((r) => r.employee_name)).toEqual([employeeName]);
    expect(await watch.errors(), "no application errors").toEqual([]);
  } finally {
    console.log("[cleanup super]", JSON.stringify(await superCleanup.run(sup)));
    console.log("[cleanup ceo]", JSON.stringify(await ceoCleanup.run(ceo)));
    await Promise.all([ceo.auth.signOut(), sup.auth.signOut()]);
  }
});
