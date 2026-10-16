// X-01 (basic) — each role reaches only the screens its role allows (route guards in App.tsx).
// Screen-level checks only; Phase 3 API tests prove the database also refuses the actions.
import { expect, test } from "../fixtures";
import { expectAppShell, loginAndWaitForDashboard } from "../helpers";
import { accountFor, type TestRole } from "../../support/env";

// path → roles allowed by the route guard (Super Admin always passes; CEO-only screens include super_admin).
const GUARDED: Array<{ path: string; allowed: TestRole[] }> = [
  { path: "/app/admin/users", allowed: ["super_admin"] },
  { path: "/app/admin/audit-logs", allowed: ["super_admin"] },
  { path: "/app/masters/company-profile", allowed: ["super_admin", "ceo_admin"] },
  { path: "/app/masters/expense-categories", allowed: ["super_admin", "ceo_admin"] },
  { path: "/app/payroll/approvals", allowed: ["super_admin", "ceo_admin", "coo_ops"] },
  { path: "/app/employees/advances/approvals", allowed: ["super_admin", "ceo_admin", "coo_ops"] },
  { path: "/app/masters/branches", allowed: ["super_admin", "ceo_admin", "coo_ops"] },
  { path: "/app/payroll/bank-payment", allowed: ["super_admin", "ceo_admin", "coo_ops", "accountant"] },
];

for (const role of ["ceo_admin", "coo_ops", "accountant"] as const) {
  test(`X-01 ${role} reaches allowed screens and is turned away from the rest @smoke`, async ({ page }) => {
    test.skip(!accountFor(role), `${role} test account not configured`);
    await loginAndWaitForDashboard(page, role);
    const wrong: string[] = [];
    for (const { path, allowed } of GUARDED) {
      await page.goto(path);
      await expectAppShell(page);
      const landed = new URL(page.url()).pathname;
      const shouldReach = allowed.includes(role);
      if (shouldReach && landed !== path) wrong.push(`${path}: expected access, was sent to ${landed}`);
      if (!shouldReach && landed !== "/app/dashboard") wrong.push(`${path}: expected redirect to dashboard, landed on ${landed}`);
    }
    expect(wrong, wrong.join("\n")).toEqual([]);
  });
}
