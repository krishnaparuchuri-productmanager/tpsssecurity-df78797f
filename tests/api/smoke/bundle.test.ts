// S-06 — the published sandbox site contains only public keys and points only at the sandbox database.
import { describe, expect, it } from "vitest";
import { guardedFetch } from "../../support/side-effects";
import { PRODUCTION, SANDBOX } from "../../support/targets";

const SITE = "https://tpss-security-sandbox.pages.dev";

describe("S-06 published sandbox site files @smoke", () => {
  it("reference only the sandbox database and carry no admin keys", async () => {
    const html = await (await guardedFetch(SITE)).text();
    const scripts = [...html.matchAll(/\/assets\/[^"]+\.js/g)].map((m) => m[0]);
    expect(scripts.length).toBeGreaterThan(0);

    let all = "";
    for (const s of new Set(scripts)) all += await (await guardedFetch(SITE + s)).text();

    expect(all).toContain(`${SANDBOX.projectRef}.supabase.co`);
    expect(all).not.toContain(PRODUCTION.projectRef);
    expect(all).not.toMatch(/sb_secret_[A-Za-z0-9]/);

    // Every token-shaped key in the files must be a public (anon) key for the sandbox.
    const jwts = [...all.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map((m) => m[0]);
    for (const jwt of new Set(jwts)) {
      const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
      expect(payload.role, "only public keys may ship in the site").toBe("anon");
      expect(payload.ref).toBe(SANDBOX.projectRef);
    }
  });
});
