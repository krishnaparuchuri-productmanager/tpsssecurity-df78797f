// Refuses to run tests against anything except the TPSS sandbox.
//
// Layer 1 (offline, always): the configured database address, key and app address must
// all identify the sandbox and must not mention production anywhere.
// Layer 2 (online, before any signed-in or writing test): a signed-in test user asks the
// database which environment it is; the answer must be "sandbox".
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCTION, SANDBOX } from "./targets";
import type { TestConfig } from "./env";

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(`UNSAFE TEST TARGET — run stopped. ${message}`);
    this.name = "UnsafeTargetError";
  }
}

/** Project ref and role inside a legacy JWT-style key, if the key is one. */
function decodeKey(key: string): { ref: string | null; role: string | null } | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return {
      ref: typeof payload.ref === "string" ? payload.ref : null,
      role: typeof payload.role === "string" ? payload.role : null,
    };
  } catch {
    return null;
  }
}

export function assertSandboxConfig(cfg: Pick<TestConfig, "supabaseUrl" | "publishableKey" | "appBaseUrl">): void {
  const { supabaseUrl, publishableKey, appBaseUrl } = cfg;

  if (!supabaseUrl) throw new UnsafeTargetError("TEST_SUPABASE_URL is not set.");
  if (!publishableKey) throw new UnsafeTargetError("TEST_SUPABASE_PUBLISHABLE_KEY is not set.");

  const everything = `${supabaseUrl} ${publishableKey} ${appBaseUrl}`.toLowerCase();
  if (everything.includes(PRODUCTION.projectRef)) {
    throw new UnsafeTargetError("The configuration mentions the PRODUCTION database. Production testing is not approved.");
  }

  let dbHost: string;
  try {
    dbHost = new URL(supabaseUrl).hostname;
  } catch {
    throw new UnsafeTargetError(`TEST_SUPABASE_URL is not a valid address.`);
  }
  if (dbHost !== `${SANDBOX.projectRef}.supabase.co`) {
    throw new UnsafeTargetError(`Database address is not the sandbox project (got host "${dbHost}").`);
  }

  // Legacy anon keys name their project and role and can be checked here; sb_publishable_ keys
  // don't, so for those the online check (layer 2) is what proves the target.
  const decoded = decodeKey(publishableKey);
  if (/^sb_secret_/i.test(publishableKey) || (decoded && decoded.role !== "anon")) {
    throw new UnsafeTargetError("An admin (secret/service-role) key was supplied. Tests must use the publishable key only.");
  }
  if (decoded) {
    if (decoded.ref === PRODUCTION.projectRef) {
      throw new UnsafeTargetError("The key belongs to the PRODUCTION database. Production testing is not approved.");
    }
    if (decoded.ref !== SANDBOX.projectRef) {
      throw new UnsafeTargetError("The key belongs to a different project than the sandbox.");
    }
  } else if (!/^sb_publishable_/.test(publishableKey)) {
    throw new UnsafeTargetError("The key is neither a sandbox anon key nor a publishable key.");
  }

  let appHost: string;
  try {
    appHost = new URL(appBaseUrl).hostname;
  } catch {
    throw new UnsafeTargetError("TEST_APP_BASE_URL is not a valid address.");
  }
  if ((PRODUCTION.appHosts as readonly string[]).includes(appHost)) {
    throw new UnsafeTargetError(`App address "${appHost}" is a PRODUCTION site.`);
  }
  if (!(SANDBOX.appHosts as readonly string[]).includes(appHost)) {
    throw new UnsafeTargetError(`App address "${appHost}" is not an approved sandbox address.`);
  }
}

/** Layer 2: call with a client that is already signed in as a test user. */
export async function assertDatabaseSaysSandbox(signedIn: SupabaseClient): Promise<void> {
  const { data, error } = await signedIn.rpc("current_environment");
  if (error) throw new UnsafeTargetError(`Could not confirm the database environment: ${error.message}`);
  if (data !== "sandbox") {
    throw new UnsafeTargetError(`The database reports environment "${String(data)}", not "sandbox".`);
  }
}
