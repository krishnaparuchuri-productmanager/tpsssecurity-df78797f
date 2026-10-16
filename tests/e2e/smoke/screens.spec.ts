// S-05 core screens load for a Super Admin without application errors.
// Read-only: each screen is opened and checked; nothing is clicked or saved.
import { expect, test } from "../fixtures";
import { expectAppShell, loginAndWaitForDashboard, watchAppErrors } from "../helpers";
import { accountFor } from "../../support/env";

const SCREENS = [
  "/app/dashboard",
  "/app/masters/clients", "/app/masters/employees", "/app/masters/company-profile", "/app/masters/branches",
  "/app/masters/deployments", "/app/masters/contracts/list",
  "/app/payroll/list", "/app/payroll/approvals", "/app/payroll/bank-payment", "/app/payroll/payslip",
  "/app/invoices/list", "/app/finance/receipts", "/app/finance/cashbook", "/app/finance/statement",
  "/app/finance/aging", "/app/finance/gst", "/app/finance/followups",
  "/app/employees/advances/list", "/app/employees/ffs/list",
  "/app/expenses/v2", "/app/compliance", "/app/compliance/payments",
  "/app/reports/mom-analysis", "/app/reports/comparative", "/app/reports/annual-summary", "/app/reports/supporting-documents",
  "/app/crm/dashboard", "/app/crm/leads",
  "/app/admin/users", "/app/admin/audit-logs", "/app/admin/activity-log",
];

test("S-05 core screens load without application errors (Super Admin) @smoke", async ({ page }) => {
  test.skip(!accountFor("super_admin"), "super_admin test account not configured");
  test.setTimeout(240_000);
  await loginAndWaitForDashboard(page, "super_admin");
  const watch = watchAppErrors(page);
  const problems: string[] = [];

  for (const path of SCREENS) {
    watch.reset();
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectAppShell(page);
    const landed = new URL(page.url()).pathname;
    if (landed !== path) problems.push(`${path}: redirected to ${landed}`);
    // The app's NotFound page (NotFound.tsx) — matched exactly, so a "404" inside listed data doesn't count.
    if (await page.getByText("Oops! Page not found", { exact: true }).isVisible().catch(() => false)) problems.push(`${path}: not found page`);
    for (const e of await watch.errors()) problems.push(`${path}: ${e}`);
  }

  expect(problems, `Screens with problems:\n${problems.join("\n")}`).toEqual([]);
});
