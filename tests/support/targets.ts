// Known TPSS environments. The test runner may only ever write to SANDBOX.
// Production identifiers are listed so they can be refused, never used.

export const SANDBOX = {
  projectRef: "femkwbgjvsdnxnihptiu",
  supabaseUrl: "https://femkwbgjvsdnxnihptiu.supabase.co",
  // Web addresses allowed as the browser-test target (local dev server or the sandbox site).
  appHosts: ["localhost", "127.0.0.1", "tpss-security-sandbox.pages.dev"],
} as const;

export const PRODUCTION = {
  projectRef: "ihmyqifzhwnxhiltafkn",
  appHosts: [
    "tpsssecurity.com",
    "www.tpsssecurity.com",
    "portal.tpsssecurity.com",
    "tpsssecurity-df78797f.pages.dev",
  ],
} as const;

// Requests that would send a real email or create a real login, and must never
// be made by an automated test (Add User invite, password reset, sign-up, magic link).
export const BLOCKED_SIDE_EFFECT_PATHS = [
  "/auth/v1/recover",
  "/auth/v1/invite",
  "/auth/v1/signup",
  "/auth/v1/otp",
  "/auth/v1/magiclink",
  "/functions/v1/admin-create-user",
  "/functions/v1/monthly-backup",
] as const;
