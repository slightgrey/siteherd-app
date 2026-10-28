import { describe, expect, it } from "vitest";
import { parseReport } from "./report";
import { compareVersions, isAffected, matchReport, rowKey, slugOf, type VulnRow } from "./vulnerabilities";

describe("compareVersions", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("2.10", "2.9")).toBe(1);
    expect(compareVersions("6.2.2", "6.2.3")).toBe(-1);
    expect(compareVersions("3.9.001", "3.9.1")).toBe(0);
  });

  it("ignores trailing zeros", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("5", "5.0.0")).toBe(0);
  });

  it("sorts pre-releases below the release, like PHP", () => {
    expect(compareVersions("5.3-beta", "5.3")).toBe(-1);
    expect(compareVersions("5.3-rc1", "5.3-beta2")).toBe(1);
    expect(compareVersions("1.0-dev", "1.0-alpha")).toBe(-1);
    expect(compareVersions("1.0.1", "1.0rc1")).toBe(1);
  });
});

describe("isAffected", () => {
  const range = (from: string, fromInc: boolean, to: string, toInc: boolean) => ({
    from_version: from,
    from_inclusive: fromInc,
    to_version: to,
    to_inclusive: toInc,
  });

  it("handles inclusive and exclusive upper bounds", () => {
    expect(isAffected("3.9.001", range("*", true, "3.9.001", false))).toBe(false);
    expect(isAffected("3.9", range("*", true, "3.9.001", false))).toBe(true);
    expect(isAffected("3.3", range("*", true, "3.3", true))).toBe(true);
    expect(isAffected("3.3.1", range("*", true, "3.3", true))).toBe(false);
  });

  it("handles lower bounds, open bounds and missing ones", () => {
    expect(isAffected("1.9", range("2.0", true, "2.5", true))).toBe(false);
    expect(isAffected("2.0", range("2.0", false, "2.5", true))).toBe(false);
    expect(isAffected("2.1", range("2.0", false, "2.5", true))).toBe(true);
    expect(isAffected("99", range("*", true, "*", true))).toBe(true);
    expect(isAffected("1.0", { to_version: "2.0", to_inclusive: false } as never)).toBe(true);
  });
});

describe("slugOf", () => {
  it("uses the folder, or the file name for single-file plugins", () => {
    expect(slugOf("contact-form-7/wp-contact-form-7.php")).toBe("contact-form-7");
    expect(slugOf("hello.php")).toBe("hello");
  });
});

describe("matchReport", () => {
  const report = parseReport({
    schema: 5,
    site_url: "https://example.test",
    wp_version: "6.4.1",
    php_version: "8.2",
    plugins: [
      { file: "contact-form-7/wp-contact-form-7.php", name: "Contact Form 7", version: "5.3.1", active: true },
      { file: "akismet/akismet.php", name: "Akismet", version: "5.3", active: true },
    ],
    themes: [{ stylesheet: "twentytwenty", name: "Twenty Twenty", version: "2.0", active: true }],
  })!;

  const row = (over: Partial<VulnRow>): VulnRow => ({
    id: "x",
    softwareType: "plugin",
    slug: "contact-form-7",
    title: "XSS",
    affected: [{ from_version: "*", from_inclusive: true, to_version: "5.3.2", to_inclusive: false }],
    patchedVersions: ["5.3.2"],
    cvssScore: 6.1,
    cvssRating: "Medium",
    cve: "CVE-2020-35489",
    link: null,
    ...over,
  });

  it("returns only items whose installed version is affected, most severe first", () => {
    const rows = new Map<string, VulnRow[]>([
      [rowKey("plugin", "contact-form-7"), [row({}), row({ id: "y", title: "RCE", cvssRating: "Critical", cvssScore: 10 })]],
      [rowKey("plugin", "akismet"), [row({ slug: "akismet", affected: [{ from_version: "*", from_inclusive: true, to_version: "5.0", to_inclusive: true }] })]],
      [rowKey("core", "wordpress"), [row({ softwareType: "core", slug: "wordpress", affected: [{ from_version: "6.4", from_inclusive: true, to_version: "6.4.2", to_inclusive: false }], patchedVersions: ["6.4.2"], cvssRating: "High", cvssScore: 7.5 })]],
    ]);
    const items = matchReport(report, rows);
    expect(items.map((i) => i.id)).toEqual(["contact-form-7/wp-contact-form-7.php", "core"]);
    expect(items[0].vulns.map((v) => v.title)).toEqual(["RCE", "XSS"]);
    expect(items[0].vulns[1].fixedIn).toBe("5.3.2");
    expect(items[1].name).toBe("WordPress");
  });

  it("reports no fix when no patched version is newer", () => {
    const rows = new Map([[rowKey("theme", "twentytwenty"), [row({ softwareType: "theme", slug: "twentytwenty", affected: [{ from_version: "*", from_inclusive: true, to_version: "*", to_inclusive: true }], patchedVersions: [] })]]]);
    expect(matchReport(report, rows)[0].vulns[0].fixedIn).toBeNull();
  });
});
