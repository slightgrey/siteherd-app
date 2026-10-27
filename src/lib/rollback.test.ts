import { describe, expect, it } from "vitest";
import { parseReport } from "./report";
import { rollbackTarget } from "./rollback";
import type { HistoryEntry } from "./updates";

const base = {
  plugins: [
    { file: "akismet/akismet.php", name: "Akismet", version: "5.4", active: true, update: null },
    { file: "premium/premium.php", name: "Premium", version: "2.0", active: true, update: null },
  ],
  integrity: {
    checked_at: "",
    core: { status: "ok" },
    plugins: [
      { file: "akismet/akismet.php", status: "ok" },
      { file: "premium/premium.php", status: "not_checkable" },
    ],
  },
};
const updated = (from: string, to: string): HistoryEntry => ({ kind: "update", status: "updated", from, to, message: null, when: "1 h ago" });
const akismet = { type: "plugin" as const, id: "akismet/akismet.php" };

describe("rollbackTarget", () => {
  it("prefers the copy the plugin saved", () => {
    const report = parseReport({ ...base, rollbacks: [{ type: "plugin", id: akismet.id, version: "5.3", kept_at: "" }] })!;
    expect(rollbackTarget(report, akismet, "5.4", [updated("5.2", "5.4")])).toEqual({ version: "5.3", source: "saved" });
  });

  it("falls back to the version before the last update, from wordpress.org", () => {
    expect(rollbackTarget(parseReport(base)!, akismet, "5.4", [updated("5.3", "5.4")])).toEqual({ version: "5.3", source: "wordpress.org" });
  });

  it("offers nothing when the last update isn't what's installed now", () => {
    // Updated to 5.4 earlier, but the site is now on 5.5 (updated outside WP Siteherd).
    expect(rollbackTarget(parseReport(base)!, akismet, "5.5", [updated("5.3", "5.4")])).toBeNull();
  });

  it("doesn't offer a wordpress.org download for premium plugins", () => {
    const premium = { type: "plugin" as const, id: "premium/premium.php" };
    expect(rollbackTarget(parseReport(base)!, premium, "2.0", [updated("1.9", "2.0")])).toBeNull();
  });

  it("ignores a saved copy of the version already installed", () => {
    const report = parseReport({ ...base, rollbacks: [{ type: "plugin", id: akismet.id, version: "5.4", kept_at: "" }] })!;
    expect(rollbackTarget(report, akismet, "5.4", undefined)).toBeNull();
  });
});
