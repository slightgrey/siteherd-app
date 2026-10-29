import { describe, expect, it } from "vitest";
import { loginProtection } from "./login-protection";
import { parseReport } from "./report";

const report = (plugins: { file: string; active: boolean }[], hardening?: unknown) =>
  parseReport({ plugins: plugins.map((p) => ({ ...p, name: p.file, version: "1", update: null })), hardening })!;

describe("loginProtection", () => {
  it("finds active security plugins by folder", () => {
    const p = loginProtection(
      report([
        { file: "wordfence/wordfence.php", active: true },
        { file: "two-factor/two-factor.php", active: false },
        { file: "akismet/akismet.php", active: true },
      ]),
    );
    expect(p.plugins.map((x) => x.name)).toEqual(["Wordfence"]);
    expect(p.any).toBe(true);
  });

  it("counts blocked XML-RPC as protection and notices Jetpack", () => {
    const p = loginProtection(report([{ file: "jetpack/jetpack.php", active: true }], { xmlrpc_off: true }));
    expect(p).toMatchObject({ plugins: [], xmlrpcOff: true, jetpack: true, any: true });
  });

  it("counts WP Siteherd's lockout only while it's active", () => {
    const lockout = { enabled: true, active: true, conflict: null, max_retries: 5, lockout_minutes: 15, lockouts_24h: 0, blocked_24h: 0 };
    expect(loginProtection(parseReport({ lockout })!)).toMatchObject({ lockout: true, any: true });
    expect(loginProtection(parseReport({ lockout: { ...lockout, active: false, conflict: "Wordfence" } })!)).toMatchObject({ lockout: false, any: false });
  });

  it("finds nothing on a bare site or an old report", () => {
    expect(loginProtection(report([])).any).toBe(false);
  });
});
