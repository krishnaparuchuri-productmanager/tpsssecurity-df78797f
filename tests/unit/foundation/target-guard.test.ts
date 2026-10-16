import { describe, expect, it } from "vitest";
import { assertSandboxConfig, UnsafeTargetError } from "../../support/target-guard";

// Fake JWT-style keys built here; they only carry a project ref, no real credential.
const fakeKey = (ref: string, role = "anon") =>
  ["e30", Buffer.from(JSON.stringify({ ref, role })).toString("base64url"), "sig"].join(".");

const ok = {
  supabaseUrl: "https://femkwbgjvsdnxnihptiu.supabase.co",
  publishableKey: fakeKey("femkwbgjvsdnxnihptiu"),
  appBaseUrl: "http://localhost:8090",
};

describe("FND-01 target guard (offline layer)", () => {
  it("accepts the sandbox database with a local or sandbox-site app address", () => {
    expect(() => assertSandboxConfig(ok)).not.toThrow();
    expect(() => assertSandboxConfig({ ...ok, appBaseUrl: "https://tpss-security-sandbox.pages.dev" })).not.toThrow();
    expect(() => assertSandboxConfig({ ...ok, publishableKey: "sb_publishable_placeholder" })).not.toThrow();
  });

  it("refuses the production database address", () => {
    expect(() => assertSandboxConfig({ ...ok, supabaseUrl: "https://ihmyqifzhwnxhiltafkn.supabase.co" })).toThrow(UnsafeTargetError);
  });

  it("refuses a production key even with the sandbox address", () => {
    expect(() => assertSandboxConfig({ ...ok, publishableKey: fakeKey("ihmyqifzhwnxhiltafkn") })).toThrow(/PRODUCTION/);
  });

  it("refuses any other project", () => {
    expect(() => assertSandboxConfig({ ...ok, supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co" })).toThrow(/not the sandbox/);
    expect(() => assertSandboxConfig({ ...ok, publishableKey: fakeKey("abcdefghijklmnopqrst") })).toThrow(/different project/);
  });

  it.each(["https://portal.tpsssecurity.com", "https://www.tpsssecurity.com", "https://tpsssecurity.com", "https://tpsssecurity-df78797f.pages.dev"])(
    "refuses the production site %s as the app address",
    (appBaseUrl) => {
      expect(() => assertSandboxConfig({ ...ok, appBaseUrl })).toThrow(/PRODUCTION site/);
    },
  );

  it("refuses unknown app addresses", () => {
    expect(() => assertSandboxConfig({ ...ok, appBaseUrl: "https://example.com" })).toThrow(/not an approved sandbox/);
  });

  it("refuses admin keys", () => {
    expect(() => assertSandboxConfig({ ...ok, publishableKey: "sb_secret_placeholder" })).toThrow(/admin/);
    expect(() => assertSandboxConfig({ ...ok, publishableKey: fakeKey("femkwbgjvsdnxnihptiu", "service_role") })).toThrow(/admin/);
  });

  it("refuses missing settings", () => {
    expect(() => assertSandboxConfig({ ...ok, supabaseUrl: "" })).toThrow(/not set/);
    expect(() => assertSandboxConfig({ ...ok, publishableKey: "" })).toThrow(/not set/);
  });
});
