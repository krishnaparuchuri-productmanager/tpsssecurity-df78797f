// Every browser test uses this `test`. It watches all network traffic:
// - requests that would reach production or send a real email are aborted and recorded;
// - any database traffic to a project other than the sandbox is recorded.
// A test fails at the end if anything was recorded, unless it explicitly expects it.
import { test as base, expect } from "@playwright/test";
import { blockedReason, redactUrl } from "../support/side-effects";
import { SANDBOX } from "../support/targets";

const PRODUCTION_WEBSITE_HOSTS = ["www.tpsssecurity.com", "tpsssecurity.com"] as const;

export interface NetworkGuard {
  violations: string[];
  /** Call in a test that deliberately attempts a blocked request. */
  expectViolations(count: number): void;
}

export const test = base.extend<{ networkGuard: NetworkGuard }>({
  networkGuard: [
    async ({ page }, use) => {
      const violations: string[] = [];
      let expected = 0;

      await page.route("**/*", (route) => {
        const req = route.request();
        const url = req.url();
        const reason = blockedReason(url);
        // Narrow exception: plain downloads of public images/fonts/styles from the production
        // *website* (e.g. the company logo). The production database stays blocked.
        if (
          reason === "production target" &&
          req.method() === "GET" &&
          ["image", "font", "stylesheet"].includes(req.resourceType()) &&
          (PRODUCTION_WEBSITE_HOSTS as readonly string[]).includes(new URL(url).hostname)
        ) {
          return route.continue();
        }
        if (reason) {
          violations.push(`${reason}: ${redactUrl(url)}`);
          return route.abort("blockedbyclient");
        }
        const host = (() => {
          try {
            return new URL(url).hostname;
          } catch {
            return "";
          }
        })();
        if (host.endsWith(".supabase.co") && host !== `${SANDBOX.projectRef}.supabase.co`) {
          violations.push(`non-sandbox database: ${redactUrl(url)}`);
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });

      await use({
        violations,
        expectViolations(count: number) {
          expected = count;
        },
      });

      expect(violations, `Network safety violations:\n${violations.join("\n")}`).toHaveLength(expected);
    },
    { auto: true },
  ],
});

export { expect };
