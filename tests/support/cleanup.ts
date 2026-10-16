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
  /**
   * Column that holds the tagged label, re-checked before removal. May be a related column
   * (e.g. "clients(client_name)" for a paysheet whose own row has no free-text field).
   */
  labelColumn: string;
  /** Skip the undo when the record is already in this state (e.g. status = "cancelled"); one value or a list. */
  alreadyDone?: { column: string; value: unknown };
  /** How to remove it. */
  undo:
    | { kind: "delete" }
    | { kind: "rpc"; fn: string; args: Record<string, unknown> }
    /** For records the app never deletes (e.g. clients): neutralise them, e.g. deactivate. */
    | { kind: "update"; values: Record<string, unknown>; reason: string }
    | { kind: "keep"; reason: string };
}

export interface CleanupReport {
  removed: string[];
  kept: string[];
  refused: string[];
  failed: string[];
}

/** "client_name" → row.client_name; "clients(client_name)" → row.clients.client_name */
function readLabel(row: Record<string, unknown>, labelColumn: string): string | null {
  const rel = labelColumn.match(/^(\w+)\((\w+)\)$/);
  if (!rel) return (row[labelColumn] as string | null) ?? null;
  const parent = row[rel[1]] as Record<string, unknown> | null;
  return (parent?.[rel[2]] as string | null) ?? null;
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
      const columns = item.alreadyDone ? `${item.labelColumn}, ${item.alreadyDone.column}` : item.labelColumn;
      const { data, error } = await client.from(item.table).select(columns).eq("id", item.id).maybeSingle();
      if (error) {
        report.failed.push(`${name}: could not re-read (${error.message})`);
        continue;
      }
      const label = data ? readLabel(data as unknown as Record<string, unknown>, item.labelColumn) : null;
      if (!data) {
        report.removed.push(`${name} (already gone)`);
        continue;
      }
      if (!hasRunTag(label, this.runId)) {
        report.refused.push(`${name}: label does not carry run tag ${this.runId}`);
        continue;
      }
      if (item.alreadyDone) {
        const current = (data as unknown as Record<string, unknown>)[item.alreadyDone.column];
        const done = Array.isArray(item.alreadyDone.value) ? item.alreadyDone.value.includes(current) : current === item.alreadyDone.value;
        if (done) {
          report.kept.push(`${name} (already ${String(current)} by the test)`);
          continue;
        }
      }
      const res =
        item.undo.kind === "delete"
          ? await client.from(item.table).delete().eq("id", item.id)
          : item.undo.kind === "update"
            ? await client.from(item.table).update(item.undo.values).eq("id", item.id)
            : await client.rpc(item.undo.fn, item.undo.args);
      if (res.error) report.failed.push(`${name}: ${res.error.message}`);
      else if (item.undo.kind === "update") report.kept.push(`${name} (${item.undo.reason})`);
      else report.removed.push(name);
    }
    this.items = [];
    return report;
  }
}
