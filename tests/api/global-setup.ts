// Runs once before any API test: refuses to start unless the configuration points at the sandbox.
import { loadTestConfig, ROLES } from "../support/env";
import { RUN_ID } from "../support/run-id";
import { assertSandboxConfig } from "../support/target-guard";

export default function setup() {
  const cfg = loadTestConfig();
  assertSandboxConfig(cfg);
  const configured = ROLES.filter((r) => cfg.accounts[r]);
  console.log(
    `\n[tests] run ${RUN_ID} · database: sandbox (${new URL(cfg.supabaseUrl).hostname}) · ` +
      `test accounts configured: ${configured.length ? configured.join(", ") : "none"}\n`,
  );
}
