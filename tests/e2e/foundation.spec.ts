// Foundation checks for the browser layer. Signed out; no business data touched.
import { expect, test } from "./fixtures";
import { SANDBOX } from "../support/targets";

test.describe("FND-06 browser safety net", () => {
  test("app under test loads and talks only to the sandbox database", async ({ page }) => {
    const dbHosts = new Set<string>();
    page.on("request", (r) => {
      const host = new URL(r.url()).hostname;
      if (host.endsWith(".supabase.co")) dbHosts.add(host);
    });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
    for (const host of dbHosts) expect(host).toBe(`${SANDBOX.projectRef}.supabase.co`);

    // The login page may not call the database yet, so also check the address the app was built with.
    const source = await page.evaluate(async () => {
      const local = await fetch("/src/integrations/supabase/client.ts").then((r) => (r.ok ? r.text() : ""), () => "");
      if (local) return local;
      const html = await fetch("/").then((r) => r.text());
      const js = html.match(/\/assets\/index-[^"]+\.js/)?.[0];
      return js ? fetch(js).then((r) => r.text()) : "";
    });
    expect(source).toContain(`${SANDBOX.projectRef}.supabase.co`);
    expect(source).not.toContain("ihmyqifzhwnxhiltafkn");
  });

  test("requests to production or email-sending endpoints are blocked and recorded", async ({ page, networkGuard }) => {
    await page.goto("/login");
    networkGuard.expectViolations(2);
    const outcome = await page.evaluate(async () => {
      const attempt = (url: string, init?: RequestInit) =>
        fetch(url, init).then(() => "sent", () => "blocked");
      return [
        await attempt("https://ihmyqifzhwnxhiltafkn.supabase.co/rest/v1/"),
        await attempt("https://femkwbgjvsdnxnihptiu.supabase.co/auth/v1/recover", { method: "POST", body: "{}" }),
      ];
    });
    expect(outcome).toEqual(["blocked", "blocked"]);
    expect(networkGuard.violations.join("\n")).toMatch(/production target[\s\S]*email/);
  });
});
