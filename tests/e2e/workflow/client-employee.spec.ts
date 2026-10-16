// F-01 / F-03 through the real screens: a CEO adds a client (with a wage row and a billing line),
// edits it, and adds an employee assigned to it. Synthetic, run-tagged data.
// Cleanup runs in the database afterwards as the CEO test user: employee deleted, client deactivated.
import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "../fixtures";
import { field, loginAndWaitForDashboard, watchAppErrors } from "../helpers";
import { signedInClient } from "../../support/clients";
import { accountFor } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { tagged } from "../../support/run-id";

test("F-01/F-03 CEO creates and edits a client, then adds an employee, through the screens @smoke", async ({ page }) => {
  test.skip(!accountFor("ceo_admin"), "ceo_admin test account not configured");
  test.setTimeout(180_000);

  const db: SupabaseClient = (await signedInClient("ceo_admin"))!;
  const cleanup = new CleanupRegistry();
  const clientName = tagged("Test Client UI");
  const employeeName = tagged("Test Employee UI");

  try {
    await loginAndWaitForDashboard(page, "ceo_admin");
    const watch = watchAppErrors(page);

    // --- Create client ------------------------------------------------------------------
    await page.goto("/app/masters/clients/new");
    await field(page, "Client Name *").fill(clientName);
    await page.getByPlaceholder("e.g. ASO").first().fill("S.GUARD");
    const lineRow = page.locator("tr", { has: page.getByPlaceholder("e.g. Security Services") }).first();
    await lineRow.getByPlaceholder("e.g. Security Services").fill("Security Services (UI test)");
    await lineRow.locator('input[type="number"]').first().fill("18000");
    await page.getByRole("button", { name: "Save to Sandbox", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/masters\/clients$/);

    const { data: created } = await db.from("clients").select("id, client_code, is_sandbox").eq("client_name", clientName);
    expect(created, "exactly one client saved").toHaveLength(1);
    const clientId = created![0].id;
    cleanup.track({ table: "clients", id: clientId, labelColumn: "client_name", undo: { kind: "update", values: { is_active: false }, reason: "clients cannot be deleted; deactivated" } });
    expect(created![0].is_sandbox).toBe(true);
    await expect(page.getByText(clientName)).toBeVisible();

    // --- Edit client, save unchanged lines — NF-01 regression ------------------------------
    await page.goto(`/app/masters/clients/${clientId}/edit`);
    await expect(field(page, "Client Name *")).toHaveValue(clientName);
    await field(page, "Notes").fill("Edited by automated test");
    await page.getByRole("button", { name: "Save to Sandbox", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/masters\/clients$/);
    const { data: lines } = await db.from("client_billing_lines").select("id").eq("client_id", clientId).eq("is_deleted", false);
    expect(lines, "still exactly one billing line after editing").toHaveLength(1);

    // --- Add employee assigned to the client --------------------------------------------
    await page.goto("/app/masters/employees/new");
    await field(page, "Full Name *").fill(employeeName);
    await page.getByRole("combobox").filter({ hasText: "Select client" }).click();
    await page.getByRole("option", { name: clientName }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/masters\/employees$/);

    const { data: emp } = await db.from("employees").select("id, client_id, employee_code, is_sandbox").eq("full_name", employeeName);
    expect(emp, "exactly one employee saved").toHaveLength(1);
    cleanup.track({ table: "employees", id: emp![0].id, labelColumn: "full_name", undo: { kind: "delete" } });
    expect(emp![0].client_id).toBe(clientId);
    expect(emp![0].employee_code).toMatch(/\S/);
    expect(emp![0].is_sandbox).toBe(true);
    // The list shows 25 per page sorted by code, so find the new employee the way a user would.
    await page.getByPlaceholder("Search by name or UAN…").fill(employeeName);
    await expect(page.getByText(employeeName)).toBeVisible();

    expect(await watch.errors(), "no application errors during the workflow").toEqual([]);
  } finally {
    console.log("[cleanup]", JSON.stringify(await cleanup.run(db)));
    await db.auth.signOut();
  }
});
