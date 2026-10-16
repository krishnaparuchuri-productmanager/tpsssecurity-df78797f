// S-02 sign-in per role · S-03 sign-out removes access · S-04 signed-out access to protected screens.
import { expect, test } from "../fixtures";
import { loginAndWaitForDashboard, loginAs } from "../helpers";
import { accountFor, type TestRole } from "../../support/env";

// Exact role labels shown in the top bar (TopBar.tsx ROLE_LABEL).
const ROLE_BADGE: Record<Exclude<TestRole, "inactive">, string> = {
  super_admin: "Super Admin",
  ceo_admin: "CEO",
  coo_ops: "COO / Operations",
  accountant: "Accountant",
};

test.describe("S-02 sign-in", () => {
  for (const role of Object.keys(ROLE_BADGE) as Array<keyof typeof ROLE_BADGE>) {
    test(`${role} signs in and lands on the dashboard @smoke`, async ({ page }) => {
      test.skip(!accountFor(role), `${role} test account not configured`);
      await loginAndWaitForDashboard(page, role);
      await expect(page.locator("header").getByText(ROLE_BADGE[role], { exact: true })).toBeVisible();
    });
  }

  test("deactivated account is shown 'Account deactivated' and no app data @smoke", async ({ page }) => {
    test.skip(!accountFor("inactive"), "inactive test account not configured");
    await loginAs(page, "inactive");
    await expect(page.getByRole("heading", { name: "Account deactivated" })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toHaveCount(0);
  });

  test("wrong password is rejected @smoke", async ({ page }) => {
    const account = accountFor("accountant");
    test.skip(!account, "accountant test account not configured");
    await page.goto("/login");
    await page.locator("#email").fill(account!.email);
    await page.locator("#password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("S-03 sign-out", () => {
  test("signing out returns to login and protected screens are no longer reachable @smoke", async ({ page }) => {
    test.skip(!accountFor("coo_ops"), "coo_ops test account not configured");
    await loginAndWaitForDashboard(page, "coo_ops");
    await page.locator("header button").filter({ hasText: /coo/i }).click();
    await page.getByRole("menuitem", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    for (const path of ["/app/dashboard", "/app/masters/clients", "/app/payroll/list"]) {
      await page.goto(path);
      await expect(page, `${path} should redirect to login after sign-out`).toHaveURL(/\/login$/);
    }
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("auth-token")));
    expect(stored, "no saved session after sign-out").toEqual([]);
  });
});

test.describe("S-04 signed-out access", () => {
  const protectedPaths = [
    "/app", "/app/dashboard", "/app/masters/clients", "/app/masters/employees", "/app/payroll/list",
    "/app/payroll/approvals", "/app/invoices/list", "/app/finance/receipts", "/app/admin/users",
    "/app/admin/audit-logs", "/app/reports/annual-summary", "/app/crm/leads",
  ];
  for (const path of protectedPaths) {
    test(`${path} redirects to login when signed out @smoke`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    });
  }
});
