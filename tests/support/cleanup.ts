// Narrow cleanup: only records registered by THIS run, and only if their label still carries
// this run's tag when re-read. No bulk deletes, no truncation, no "wipe sandbox".
//
// Each tracked record names how to undo it (a soft-delete/cancel function or a plain delete the
// test user is allowed to make). Records the application deliberately keeps (issued invoices,
// receipts, ledger entries) cannot be removed by an ordinary user; they stay in sandbox as
// clearly tagged test records and are listed in the run summary.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasRunTag, RUN_ID } from "./run-id";

export interface TrackedRecord {
  table: string;
  id: string;
  /** Column that holds the tagged label, re-checked before removal. */
  labelColumn: string;
  /** How to remove it. */
  undo: { kind: "delete" } | { kind: "rpc"; fn: string; args: Record<string, unknown> } | { kind: "keep"; reason: string };
}

export interface CleanupReport {
  removed: string[];
  kept: string[];
  refused: string[];
  failed: string[];
}

export class CleanupRegistry {
  private items: TrackedRecord[] = [];
  constructor(private readonly runId: string = RUN_ID) {}

  track(item: TrackedRecord): void {
    this.items.push(item);
  }

  get size(): number {
    return this.items.length;
  }

  /** Undo in reverse creation order (children before parents). */
  async run(client: SupabaseClient): Promise<CleanupReport> {
    const report: CleanupReport = { removed: [], kept: [], refused: [], failed: [] };
    for (const item of [...this.items].reverse()) {
      const name = `${item.table}/${item.id}`;
      if (item.undo.kind === "keep") {
        report.kept.push(`${name} (${item.undo.reason})`);
        continue;
      }
      const { data, error } = await client.from(item.table).select(item.labelColumn).eq("id", item.id).maybeSingle();
      if (error) {
        report.failed.push(`${name}: could not re-read (${error.message})`);
        continue;
      }
      const label = data ? (data as unknown as Record<string, string | null>)[item.labelColumn] : null;
      if (!data) {
        report.removed.push(`${name} (already gone)`);
        continue;
      }
      if (!hasRunTag(label, this.runId)) {
        report.refused.push(`${name}: label does not carry run tag ${this.runId}`);
        continue;
      }
      const res =
        item.undo.kind === "delete"
          ? await client.from(item.table).delete().eq("id", item.id)
          : await client.rpc(item.undo.fn, item.undo.args);
      if (res.error) report.failed.push(`${name}: ${res.error.message}`);
      else report.removed.push(name);
    }
    this.items = [];
    return report;
  }
}
