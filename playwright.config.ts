// Browser tests (Playwright). Sandbox only — the target guard runs before anything starts.
// Local runs start a private dev server on port 8090 wired explicitly to the sandbox database
// (process env overrides .env files in Vite), so the app under test cannot reach production.
import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";
import { loadTestConfig } from "./tests/support/env";
import { RUN_ID } from "./tests/support/run-id";
import { assertSandboxConfig } from "./tests/support/target-guard";

const cfg = loadTestConfig();
assertSandboxConfig(cfg);

// The sandbox holds real client/employee data (owner decision 2026-10-16: kept for training).
// Failure artifacts must therefore never contain page content: no screenshots, no traces,
// and no page-text snapshot ("error-context"), which Playwright skips when this is set.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = "1";

const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cfg.appBaseUrl);
const port = isLocal ? Number(new URL(cfg.appBaseUrl).port || 80) : 0;

let gitSha = "unknown";
try {
  gitSha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {
  /* not a git checkout */
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `./tests/reports/runs/${RUN_ID}/artifacts`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["./tests/support/redact-reporter.ts"],
    ["list"],
    ["html", { outputFolder: `./tests/reports/runs/${RUN_ID}/html`, open: "never" }],
    ["json", { outputFile: `./tests/reports/runs/${RUN_ID}/results.json` }],
  ],
  metadata: { runId: RUN_ID, target: cfg.appBaseUrl, database: "sandbox", gitSha },
  use: {
    baseURL: cfg.appBaseUrl,
    // Traces record typed text (including passwords); screenshots show real sandbox data. Both off.
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: isLocal
    ? {
        command: `npm run dev -- --port ${port} --strictPort`,
        url: cfg.appBaseUrl,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          VITE_SUPABASE_URL: cfg.supabaseUrl,
          VITE_SUPABASE_PUBLISHABLE_KEY: cfg.publishableKey,
          VITE_SUPABASE_PROJECT_ID: new URL(cfg.supabaseUrl).hostname.split(".")[0],
        },
      }
    : undefined,
});
