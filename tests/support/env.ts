// Loads test settings from tests/.env.test.local (gitignored, created by the owner from
// tests/.env.test.example). Values already present in the process environment win.
// No secrets live in the repository.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const ROLES = ["super_admin", "ceo_admin", "coo_ops", "accountant", "inactive"] as const;
export type TestRole = (typeof ROLES)[number];

export interface TestAccount {
  role: TestRole;
  email: string;
  password: string;
}

export interface TestConfig {
  supabaseUrl: string;
  publishableKey: string;
  appBaseUrl: string;
  accounts: Partial<Record<TestRole, TestAccount>>;
  envFile: string | null;
}

const ENV_FILE = resolve(process.cwd(), "tests/.env.test.local");

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of readFileSync(path, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

let cached: TestConfig | null = null;

export function loadTestConfig(): TestConfig {
  if (cached) return cached;
  const fileVars = existsSync(ENV_FILE) ? parseEnvFile(ENV_FILE) : {};
  const get = (k: string) => process.env[k] ?? fileVars[k] ?? "";

  const accounts: TestConfig["accounts"] = {};
  for (const role of ROLES) {
    const key = role.toUpperCase();
    const email = get(`TEST_${key}_EMAIL`);
    const password = get(`TEST_${key}_PASSWORD`);
    if (email && password) accounts[role] = { role, email, password };
  }

  cached = {
    supabaseUrl: get("TEST_SUPABASE_URL").replace(/\/+$/, ""),
    publishableKey: get("TEST_SUPABASE_PUBLISHABLE_KEY"),
    appBaseUrl: (get("TEST_APP_BASE_URL") || "http://localhost:8090").replace(/\/+$/, ""),
    accounts,
    envFile: existsSync(ENV_FILE) ? ENV_FILE : null,
  };
  return cached;
}

/** Account for a role, or null when the owner has not configured it yet (tests then skip with a reason). */
export function accountFor(role: TestRole): TestAccount | null {
  return loadTestConfig().accounts[role] ?? null;
}
