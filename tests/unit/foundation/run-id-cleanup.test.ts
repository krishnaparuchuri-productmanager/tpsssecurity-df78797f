import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CleanupRegistry } from "../../support/cleanup";
import { hasRunTag, makeRunId, RUN_ID, RUN_ID_PATTERN, tagged } from "../../support/run-id";

describe("FND-03 run identifier", () => {
  it("has the documented format and is stable within a run", () => {
    expect(RUN_ID).toMatch(RUN_ID_PATTERN);
    expect(makeRunId(new Date(2026, 9, 17, 10, 30))).toMatch(/^T20261017-1030-[0-9a-f]{4}$/);
  });

  it("tags labels and recognises only its own tag", () => {
    const label = tagged("Test Client");
    expect(label).toBe(`Test Client [${RUN_ID}]`);
    expect(hasRunTag(label)).toBe(true);
    expect(hasRunTag("Test Client [T20200101-0000-0000]")).toBe(false);
    expect(hasRunTag("Real Client Pvt Ltd")).toBe(false);
    expect(hasRunTag(null)).toBe(false);
  });
});

// Minimal in-memory stand-in for the database client: records what cleanup asks for.
function fakeClient(rows: Record<string, Record<string, string>>) {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: (_c: string, id: string) => ({
            maybeSingle: async () => ({ data: rows[`${table}/${id}`] ?? null, error: null }),
          }),
        }),
        delete: () => ({
          eq: async (_c: string, id: string) => {
            calls.push(`delete ${table}/${id}`);
            return { error: null };
          },
        }),
        update: (values: Record<string, unknown>) => ({
          eq: async (_c: string, id: string) => {
            calls.push(`update ${table}/${id} ${JSON.stringify(values)}`);
            return { error: null };
          },
        }),
      };
    },
    async rpc(fn: string) {
      calls.push(`rpc ${fn}`);
      return { error: null };
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("FND-04 narrow cleanup", () => {
  it("removes only records that still carry this run's tag, newest first", async () => {
    const { client, calls } = fakeClient({
      "clients/1": { client_name: tagged("Test Client") },
      "employees/2": { name: tagged("Test Employee 1") },
      "clients/3": { client_name: "Real Client Pvt Ltd" },
    });
    const reg = new CleanupRegistry();
    reg.track({ table: "clients", id: "1", labelColumn: "client_name", undo: { kind: "rpc", fn: "soft_delete_client", args: {} } });
    reg.track({ table: "employees", id: "2", labelColumn: "name", undo: { kind: "delete" } });
    reg.track({ table: "clients", id: "3", labelColumn: "client_name", undo: { kind: "delete" } });
    reg.track({ table: "invoices", id: "4", labelColumn: "invoice_number", undo: { kind: "keep", reason: "issued invoices are permanent" } });

    const report = await reg.run(client);

    expect(calls).toEqual(["delete employees/2", "rpc soft_delete_client"]);
    expect(report.refused).toHaveLength(1);
    expect(report.refused[0]).toContain("clients/3");
    expect(report.kept[0]).toContain("invoices/4");
    expect(reg.size).toBe(0);
  });

  it("neutralises (e.g. deactivates) tagged records the app never deletes, and reports them as kept", async () => {
    const { client, calls } = fakeClient({ "clients/9": { client_name: tagged("Test Client") } });
    const reg = new CleanupRegistry();
    reg.track({ table: "clients", id: "9", labelColumn: "client_name", undo: { kind: "update", values: { is_active: false }, reason: "clients cannot be deleted; deactivated" } });
    const report = await reg.run(client);
    expect(calls).toEqual(['update clients/9 {"is_active":false}']);
    expect(report.kept[0]).toContain("deactivated");
    expect(report.removed).toHaveLength(0);
  });
});
