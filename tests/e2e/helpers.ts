import type { Page } from "@playwright/test";
import { expect } from "./fixtures";
import { accountFor, type TestRole } from "../support/env";
import { redactUrl } from "../support/side-effects";

/** Signs in through the real login form. Returns false when the account isn't configured. */
export async function loginAs(page: Page, role: TestRole): Promise<boolean> {
  const account = accountFor(role);
  if (!account) return false;
  // The login form refuses passwords under 8 characters (the browser blocks the submit silently).
  if (account.password.length < 8) {
    throw new Error(`The ${role} test password is shorter than the login form's 8-character minimum. Set a longer one in Supabase and tests/.env.test.local.`);
  }
  await page.goto("/login");
  await page.locator("#email").fill(account.email);
  await page.locator("#password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Keep the password out of failure snapshots: the form has already captured it on submit.
  await page.locator("#password").fill("", { timeout: 1_000 }).catch(() => {});
  return true;
}

export async function loginAndWaitForDashboard(page: Page, role: TestRole): Promise<boolean> {
  if (!(await loginAs(page, role))) return false;
  await expect(page).toHaveURL(/\/app\/dashboard$/);
  await expectAppShell(page);
  return true;
}

/**
 * The real app layout is showing: top bar present, nothing loading, and not one of the
 * full-page stop screens ("No role assigned", "Account deactivated") that keep the URL unchanged.
 */
export async function expectAppShell(page: Page) {
  await expect(page.getByText("Loading…")).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /no role assigned|account deactivated/i }), "account has a role and is active").toHaveCount(0);
  await expect(page.locator("header"), "app layout (top bar) is showing").toHaveCount(1);
}

/** Input or text area inside the app's `<Field label=…>` wrapper (label and box are siblings, not linked). */
export function field(page: Page, label: string) {
  return page.locator("div.space-y-1").filter({ has: page.getByText(label, { exact: true }) }).locator("input, textarea").first();
}

export interface AppErrorWatch {
  /** Uncaught exceptions, red error toasts and failed database calls seen so far. */
  errors: () => Promise<string[]>;
  reset: () => void;
}

/**
 * Collects signals of an application error on the current page:
 * uncaught JavaScript exceptions, database/API responses with status >= 400
 * (except 406, which the database library uses for "no row" lookups), and visible error toasts.
 */
export function watchAppErrors(page: Page): AppErrorWatch {
  let found: string[] = [];
  page.on("pageerror", (e) => found.push(`uncaught error: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => {
    const url = r.url();
    if (!url.includes(".supabase.co/")) return;
    const s = r.status();
    if (s >= 400 && s !== 406) found.push(`HTTP ${s} ${r.request().method()} ${redactUrl(url)}`);
  });
  return {
    async errors() {
      const toasts = await page.locator('[data-sonner-toast][data-type="error"]').allInnerTexts().catch(() => []);
      return [...found, ...toasts.map((t) => `error toast: ${t.replace(/\s+/g, " ").slice(0, 160)}`)];
    },
    reset() {
      found = [];
    },
  };
}
