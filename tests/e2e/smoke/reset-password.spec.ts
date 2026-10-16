// S-07 reset-password page behaviour (NF-17). No email is requested: the request-a-link
// endpoint is blocked by the safety guard; only the landing page is exercised.
import { expect, test } from "../fixtures";

test("S-07 a reset link asks for confirmation first, and a bad link shows 'Reset link not valid' @smoke", async ({ page }) => {
  await page.goto("/reset-password?token_hash=not-a-real-token&type=recovery");
  const confirm = page.getByRole("button", { name: /continue to set new password/i });
  await expect(confirm).toBeVisible();
  await confirm.click();
  await expect(page.getByText(/reset link not valid/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /send a new link/i }).or(page.getByRole("link", { name: /send a new link/i }))).toBeVisible();
});

test("S-07 an expired-link error from the sign-in service shows 'Reset link not valid' @smoke", async ({ page }) => {
  await page.goto("/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.getByText(/reset link not valid/i)).toBeVisible();
});
