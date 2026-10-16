// Foundation checks against the real sandbox, signed out (read-only) unless accounts exist.
import { describe, expect, it } from "vitest";
import { anonClient, signedInClient } from "../../support/clients";
import { accountFor, loadTestConfig, ROLES } from "../../support/env";
import { BlockedSideEffectError, guardedFetch } from "../../support/side-effects";
import { SANDBOX } from "../../support/targets";

describe("FND-05 sandbox target (live)", () => {
  it("reaches the sandbox database's sign-in service with the configured key", async () => {
    const cfg = loadTestConfig();
    const res = await guardedFetch(`${cfg.supabaseUrl}/auth/v1/settings`, { headers: { apikey: cfg.publishableKey } });
    expect(res.status).toBe(200);
    expect(new URL(res.url).hostname).toBe(`${SANDBOX.projectRef}.supabase.co`);
  });

  it("test database clients refuse to send a password-reset email", async () => {
    await expect(anonClient().auth.resetPasswordForEmail("qa-nobody@example.invalid")).resolves.toMatchObject({
      error: expect.objectContaining({ message: expect.stringContaining("Blocked by test safety guard") }),
    });
  });

  it("guardedFetch refuses production even with a valid-looking request", async () => {
    await expect(guardedFetch("https://ihmyqifzhwnxhiltafkn.supabase.co/auth/v1/settings")).rejects.toBeInstanceOf(BlockedSideEffectError);
  });

  it.skipIf(!accountFor("super_admin"))("signed-in check: the database itself reports 'sandbox'", async () => {
    const client = await signedInClient("super_admin");
    expect(client).not.toBeNull();
    await client!.auth.signOut();
  });
});

describe("FND-07 test accounts (live)", () => {
  // Sign-in only proves the credentials and target; what each role may do is tested in later phases.
  it.each(ROLES.map((r) => [r]))("%s test account signs in to the sandbox", async (role) => {
    if (!accountFor(role)) return expect.soft(accountFor(role), `${role} account not configured`).not.toBeNull();
    const client = await signedInClient(role);
    const { data } = await client!.auth.getUser();
    expect(data.user?.email).toBe(accountFor(role)!.email);
    await client!.auth.signOut();
  });
});
