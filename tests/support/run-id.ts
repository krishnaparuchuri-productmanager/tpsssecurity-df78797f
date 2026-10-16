// Every record a test creates carries this run's identifier, e.g. "Test Client [T20261017-1030-ab12]",
// so it can be recognised, cleaned up, and never confused with real or manual data.
import { randomBytes } from "node:crypto";

function makeRunId(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `T${stamp}-${randomBytes(2).toString("hex")}`;
}

// Shared by all workers of one run when set by the runner; otherwise generated once per process.
export const RUN_ID: string = process.env.TEST_RUN_ID || (process.env.TEST_RUN_ID = makeRunId());

export const RUN_ID_PATTERN = /^T\d{8}-\d{4}-[0-9a-f]{4}$/;

/** Synthetic label for a test record, always ending in the run tag. */
export function tagged(label: string, runId: string = RUN_ID): string {
  return `${label} [${runId}]`;
}

export function hasRunTag(value: string | null | undefined, runId: string = RUN_ID): boolean {
  return typeof value === "string" && value.endsWith(`[${runId}]`);
}

export { makeRunId };
