// Stops tests from triggering real emails or reaching production.
// Used as the fetch implementation of every test database client, and mirrored by
// the browser network guard in tests/e2e/fixtures.ts.
import { BLOCKED_SIDE_EFFECT_PATHS, PRODUCTION } from "./targets";

export class BlockedSideEffectError extends Error {
  constructor(url: string, reason: string) {
    super(`Blocked by test safety guard (${reason}): ${redactUrl(url)}`);
    this.name = "BlockedSideEffectError";
  }
}

/** Removes query strings (they can carry tokens or personal data) before a URL is logged. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}${u.search ? "?…" : ""}`;
  } catch {
    return "[unparseable url]";
  }
}

/** Returns a reason string if the request must not be sent, otherwise null. */
export function blockedReason(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null; // relative app URLs are fine
  }
  if (u.hostname.includes(PRODUCTION.projectRef) || (PRODUCTION.appHosts as readonly string[]).includes(u.hostname)) {
    return "production target";
  }
  if (BLOCKED_SIDE_EFFECT_PATHS.some((p) => u.pathname.startsWith(p))) {
    return "sends real email or creates a login";
  }
  return null;
}

export const guardedFetch: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const reason = blockedReason(url);
  if (reason) throw new BlockedSideEffectError(url, reason);
  return fetch(input, init);
};
