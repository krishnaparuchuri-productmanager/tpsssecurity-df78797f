// X-02 (sample) — the DATABASE refuses actions a role is not allowed to take, and nothing changes.
// Hidden buttons are not evidence; these call the database directly as the test user.
//
// Not included on purpose: calling wipe_sandbox() as a lower role. A broken check there would
// erase sandbox data, so it is verified by reading the function's guard instead (Phase 5).
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signedInClient } from "../../support/clients";
import { accountFor } from "../../support/env";
import { CleanupRegistry } from "../../support/cleanup";
import { tagged } from "../../support/run-id";

const have = (r: Parameters<typeof accountFor>[0]) => !!accountFor(r);
let accountant: SupabaseClient | null = null;
let coo: SupabaseClient | null = null;
let ceo: SupabaseClient | null = null;
const cleanup = new CleanupRegistry();

beforeAll(async () => {
  accountant = await signedInClient("accountant");
  coo = await signedInClient("coo_ops");
  ceo = await signedInClient("ceo_admin");
});

afterAll(async () => {
  if (ceo && cleanup.size) console.log("[cleanup]", JSON.stringify(await cleanup.run(ceo)));
  await Promise.all([accountant, coo, ceo].map((c) => c?.auth.signOut()));
});

describe("X-02 restricted actions are refused by the database @smoke", () => {
  it.skipIf(!have("accountant"))("an Accountant cannot approve a paysheet", async () => {
    const { error } = await accountant!.rpc("approve_paysheet", { _id: randomUUID() });
    expect(error?.message).toMatch(/Only CEO or COO can approve/);
  });

  it.skipIf(!have("coo_ops"))("a COO cannot cancel an invoice (Super Admin only)", async () => {
    const { error } = await coo!.rpc("cancel_invoice", { _id: randomUUID(), _reason: "Automated permission test" });
    expect(error?.message).toMatch(/Only Super Admin can cancel invoices/);
  });

  it.skipIf(!have("coo_ops"))("a COO cannot change the role-permission table, and the value is unchanged", async () => {
    const { data: rows } = await coo!.from("role_permissions").select("id, can_delete").eq("role", "coo_ops").eq("screen_name", "clients").single();
    expect(rows).not.toBeNull();
    const before = rows!.can_delete;
    const { data: updated, error } = await coo!.from("role_permissions").update({ can_delete: !before }).eq("id", rows!.id).select("id");
    expect(error ? [] : updated, "update must not affect any row").toEqual([]);
    const { data: after } = await coo!.from("role_permissions").select("can_delete").eq("id", rows!.id).single();
    expect(after!.can_delete).toBe(before);
  });

  it.skipIf(!have("accountant"))("an Accountant cannot give themselves the Super Admin role, and keeps their role", async () => {
    const { data: me } = await accountant!.auth.getUser();
    const { error } = await accountant!.from("user_roles").insert({ user_id: me.user!.id, role: "super_admin" });
    expect(error).not.toBeNull();
    const { data: roles } = await accountant!.from("user_roles").select("role").eq("user_id", me.user!.id);
    expect((roles ?? []).map((r) => r.role)).toEqual(["accountant"]);
  });

  it.skipIf(!have("accountant") || !have("ceo_admin"))("an Accountant (view-only on clients) cannot create a client", async () => {
    const name = tagged("Test Client (should not exist)");
    const { data, error } = await accountant!.from("clients").insert({ client_name: name, client_code: "", is_sandbox: true }).select("id");
    if (data?.length) cleanup.track({ table: "clients", id: data[0].id, labelColumn: "client_name", undo: { kind: "update", values: { is_active: false }, reason: "unexpectedly created; deactivated" } });
    expect(error).not.toBeNull();
    const { data: found } = await ceo!.from("clients").select("id").eq("client_name", name);
    expect(found).toEqual([]);
  });

  it.skipIf(!have("inactive"))("a deactivated user signs in but sees no business data", async () => {
    const inactive = await signedInClient("inactive");
    for (const table of ["clients", "employees", "invoices", "paysheets"]) {
      const { data, error } = await inactive!.from(table).select("id").limit(1);
      expect(error ? [] : data, `${table} must be empty for a deactivated user`).toEqual([]);
    }
    await inactive!.auth.signOut();
  });
});
