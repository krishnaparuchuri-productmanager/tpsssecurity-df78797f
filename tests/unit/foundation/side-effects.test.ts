import { describe, expect, it } from "vitest";
import { blockedReason, BlockedSideEffectError, guardedFetch, redactUrl } from "../../support/side-effects";

const SB = "https://femkwbgjvsdnxnihptiu.supabase.co";

describe("FND-02 side-effect guard", () => {
  it.each([
    `${SB}/auth/v1/recover`,
    `${SB}/auth/v1/invite`,
    `${SB}/auth/v1/signup`,
    `${SB}/auth/v1/otp`,
    `${SB}/auth/v1/magiclink`,
    `${SB}/functions/v1/admin-create-user`,
    `${SB}/functions/v1/monthly-backup`,
  ])("blocks email/login-creating request %s", (url) => {
    expect(blockedReason(url)).toMatch(/email|login/);
  });

  it.each([
    "https://ihmyqifzhwnxhiltafkn.supabase.co/rest/v1/clients",
    "https://portal.tpsssecurity.com/app",
    "https://www.tpsssecurity.com/",
  ])("blocks production %s", (url) => {
    expect(blockedReason(url)).toBe("production target");
  });

  it("allows ordinary sandbox database and sign-in requests", () => {
    expect(blockedReason(`${SB}/rest/v1/clients?select=id`)).toBeNull();
    expect(blockedReason(`${SB}/auth/v1/token?grant_type=password`)).toBeNull();
    expect(blockedReason("/app/dashboard")).toBeNull();
  });

  it("guardedFetch throws before sending a blocked request", async () => {
    await expect(guardedFetch(`${SB}/auth/v1/recover`, { method: "POST" })).rejects.toBeInstanceOf(BlockedSideEffectError);
  });

  it("redacts query strings from logged URLs", () => {
    expect(redactUrl(`${SB}/auth/v1/verify?token=secret&type=recovery`)).toBe(`${SB}/auth/v1/verify?…`);
  });
});
