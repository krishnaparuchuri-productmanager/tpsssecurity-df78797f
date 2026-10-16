// X-09 storage and X-SESS session behaviour. Backup files hold real data: tests only check whether
// access is ALLOWED (status / names), never read or keep file contents.
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { anonClient, signedInClient } from "../../support/clients";
import { accountFor, loadTestConfig } from "../../support/env";
import { guardedFetch } from "../../support/side-effects";

const have = (r: Parameters<typeof accountFor>[0]) => !!accountFor(r);

describe("X-09 backup storage @security", () => {
  it("X-09-01 signed-out visitors cannot list or upload backup files", async () => {
    const anon = anonClient();
    const { data: list } = await anon.storage.from("backups").list("", { limit: 5 });
    expect(list ?? []).toEqual([]);
    const up = await anon.storage.from("backups").upload(`probe-${Date.now()}.txt`, new Blob(["x"]), { upsert: false });
    expect(up.error).not.toBeNull();
  });

  it.skipIf(!have("accountant") || !have("coo_ops"))("X-09-02 Accountant and COO cannot list backup files", async () => {
    for (const role of ["accountant", "coo_ops"] as const) {
      const c = (await signedInClient(role))!;
      const { data } = await c.storage.from("backups").list("", { limit: 5 });
      expect(data ?? [], `${role} listed backups`).toEqual([]);
      await c.auth.signOut();
    }
  });

  it.skipIf(!have("ceo_admin"))("X-09-04 signed-in users (even CEO) cannot upload or replace files in storage directly", async () => {
    const ceo = (await signedInClient("ceo_admin"))!;
    const up = await ceo.storage.from("backups").upload(`probe-${Date.now()}.txt`, new Blob(["x"]), { upsert: false });
    expect(up.error, "direct storage upload accepted").not.toBeNull();
    await ceo.auth.signOut();
  });

  it.skipIf(!have("super_admin") || !have("accountant"))("X-09-03 an Accountant cannot download a backup file even knowing its name", async () => {
    const sup = (await signedInClient("super_admin"))!;
    const { data: months } = await sup.storage.from("backups").list("", { limit: 1 });
    const folder = months?.[0]?.name;
    const { data: files } = folder ? await sup.storage.from("backups").list(folder, { limit: 1 }) : { data: [] };
    await sup.auth.signOut();
    expect(folder && files?.length, "Super Admin can see backup names (needed for this check)").toBeTruthy();

    const acct = (await signedInClient("accountant"))!;
    const token = (await acct.auth.getSession()).data.session!.access_token;
    const cfg = loadTestConfig();
    const res = await guardedFetch(`${cfg.supabaseUrl}/storage/v1/object/backups/${folder}/${files![0].name}`, { headers: { apikey: cfg.publishableKey, Authorization: `Bearer ${token}` } });
    await res.body?.cancel(); // never read the contents
    expect(res.ok, "Accountant downloaded a backup").toBe(false);
    await acct.auth.signOut();
  });
});

describe.skipIf(!have("coo_ops"))("X-SESS sign-out @security", () => {
  async function freshSession() {
    const cfg = loadTestConfig();
    const c = createClient(cfg.supabaseUrl, cfg.publishableKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: guardedFetch } });
    const acc = accountFor("coo_ops")!;
    const { data, error } = await c.auth.signInWithPassword({ email: acc.email, password: acc.password });
    if (error) throw error;
    return { c, cfg, access: data.session!.access_token, refresh: data.session!.refresh_token };
  }

  it("X-SESS-01 after the app's sign-out, the old refresh token can no longer start a new session", async () => {
    const { c, cfg, refresh } = await freshSession();
    await c.auth.signOut({ scope: "local" }); // what the app's Sign Out does (AuthContext.signOut)
    const res = await guardedFetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: cfg.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }),
    });
    const body = res.ok ? ((await res.json()) as { access_token?: string; refresh_token?: string }) : null;
    if (body?.access_token) {
      // End the session we just revived so it doesn't linger.
      await guardedFetch(`${cfg.supabaseUrl}/auth/v1/logout?scope=global`, { method: "POST", headers: { apikey: cfg.publishableKey, Authorization: `Bearer ${body.access_token}` } });
    }
    expect(res.ok, "sign-out only clears the browser; the session stays valid on the server").toBe(false);
  });

  it("X-SESS-02 after a full (global) sign-out, the old refresh token is refused", async () => {
    const { c, cfg, refresh } = await freshSession();
    await c.auth.signOut({ scope: "global" });
    const res = await guardedFetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: cfg.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }),
    });
    expect(res.ok).toBe(false);
  });
});
