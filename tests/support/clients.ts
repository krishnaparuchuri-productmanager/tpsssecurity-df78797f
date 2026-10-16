// Database clients for tests. Always the publishable key (never an admin key), always the
// side-effect guard, never a saved session on disk.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { accountFor, loadTestConfig, type TestRole } from "./env";
import { guardedFetch } from "./side-effects";
import { assertDatabaseSaysSandbox, assertSandboxConfig } from "./target-guard";

function baseClient(): SupabaseClient {
  const cfg = loadTestConfig();
  assertSandboxConfig(cfg);
  return createClient(cfg.supabaseUrl, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: guardedFetch },
  });
}

/** Signed-out (anonymous) client. */
export function anonClient(): SupabaseClient {
  return baseClient();
}

/**
 * Client signed in as the test account for a role, after confirming the database says "sandbox".
 * Returns null if that account is not configured yet.
 */
export async function signedInClient(role: TestRole): Promise<SupabaseClient | null> {
  const account = accountFor(role);
  if (!account) return null;
  const client = baseClient();
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw new Error(`Sign-in failed for the ${role} test account: ${error.message}`);
  await assertDatabaseSaysSandbox(client);
  return client;
}
