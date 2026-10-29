import { describe, expect, it } from "vitest";
import { editedPlugins, failedLoginSources, integrityProblems, parseReport, pendingUpdates, ssoUserFor, translationOwner } from "./report";

const v2 = {
  schema: 2,
  plugin_version: "0.1.0",
  site_url: "https://plugin.test",
  wp_version: "7.1.3",
  php_version: "8.4.12",
  db_version: "8.0.30",
  is_multisite: false,
  locale: "en_US",
  core_update: "7.2",
  plugins: [
    { file: "akismet/akismet.php", name: "Akismet", version: "5.3", active: true, update: "5.4" },
    { file: "hello.php", name: "Hello Dolly", version: "1.7", active: false, update: null },
  ],
  themes: [{ stylesheet: "twentytwentyfive", name: "Twenty Twenty-Five", version: "1.2", active: true, update: null }],
  failed_logins_24h: 3,
  health: {
    checked_at: "2026-10-20T08:00:00+00:00",
    counts: { good: 20, recommended: 4, critical: 1 },
    issues: [{ test: "php_version", label: "PHP is outdated", status: "critical", badge: "Security", description: "..." }],
    skipped: 0,
  },
  integrity: {
    checked_at: "2026-10-20T08:00:00+00:00",
    core: { status: "issues", modified: ["wp-login.php"], modified_count: 1, missing: [], missing_count: 0, unexpected: ["wp-includes/x.php"], unexpected_count: 1 },
    plugins: [
      { file: "akismet/akismet.php", status: "issues", modified: ["akismet.php"], modified_count: 1, missing: [], missing_count: 0 },
      { file: "hello.php", status: "not_checkable" },
    ],
  },
  report_id: "abc",
  generated_at: "2026-10-20T08:00:00+00:00",
};

describe("parseReport", () => {
  it("parses a full schema 2 report", () => {
    const r = parseReport(v2)!;
    expect(r.wp_version).toBe("7.1.3");
    expect(r.health?.counts.critical).toBe(1);
    expect(r.integrity?.plugins[1]).toMatchObject({ status: "not_checkable", modified: [], modified_count: 0 });
  });

  it("accepts schema 1 reports without health or integrity", () => {
    const v1: Record<string, unknown> = { ...v2, schema: 1 };
    delete v1.health;
    delete v1.integrity;
    const r = parseReport(v1)!;
    expect(r.health).toBeNull();
    expect(r.integrity).toBeNull();
    expect(r.plugins).toHaveLength(2);
  });

  it("falls back to defaults for malformed fields instead of failing", () => {
    const r = parseReport({ wp_version: 7, plugins: "nope", health: { counts: "x" } })!;
    expect(r.wp_version).toBe("");
    expect(r.plugins).toEqual([]);
    expect(r.health).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(parseReport(null)).toBeNull();
    expect(parseReport("x")).toBeNull();
  });
});

describe("ssoUserFor", () => {
  const admins = [
    { id: 1, login: "admin", name: "Admin" },
    { id: 7, login: "jane", name: "Jane" },
  ];

  it("uses the site's fixed admin regardless of the request", () => {
    expect(ssoUserFor({ enabled: true, user_id: 1, admins }, 7)).toBe(1);
  });

  it("in ask-every-time mode, accepts only a listed admin", () => {
    expect(ssoUserFor({ enabled: true, user_id: null, admins }, 7)).toBe(7);
    expect(ssoUserFor({ enabled: true, user_id: null, admins }, 2)).toBeNull();
    expect(ssoUserFor({ enabled: true, user_id: null, admins })).toBeNull();
  });

  it("is unavailable when turned off or not reported", () => {
    expect(ssoUserFor({ enabled: false, user_id: 1, admins }, 1)).toBeNull();
    expect(ssoUserFor(null, 1)).toBeNull();
  });

  it("is parsed from schema 3 reports and null for older ones", () => {
    expect(parseReport({ ...v2, sso: { enabled: true, user_id: null, admins } })!.sso?.admins).toHaveLength(2);
    expect(parseReport(v2)!.sso).toBeNull();
  });
});

describe("summaries", () => {
  it("counts pending updates", () => {
    const u = pendingUpdates(parseReport(v2)!);
    expect(u.total).toBe(2);
    expect(u.plugins.map((p) => p.name)).toEqual(["Akismet"]);
  });

  it("counts all pending translations as one update and names their owners", () => {
    const r = parseReport({
      ...v2,
      translations: [
        { type: "core", slug: "default", language: "de_DE", version: "7.1.3", updated: "2026-10-01 10:00:00" },
        { type: "plugin", slug: "akismet", language: "de_DE", version: "5.3", updated: "2026-10-01 10:00:00" },
        { type: "theme", slug: "twentytwentyfive", language: "de_DE", version: "1.2", updated: "2026-10-01 10:00:00" },
      ],
    })!;
    const u = pendingUpdates(r);
    expect(u.translations).toBe(3);
    expect(u.total).toBe(3); // core + Akismet + translations
    expect(r.translations.map((t) => translationOwner(r, t))).toEqual(["WordPress", "Akismet", "Twenty Twenty-Five"]);
    expect(parseReport(v2)!.translations).toEqual([]);
  });

  it("leaves excluded items out of pending updates", () => {
    const u = pendingUpdates(parseReport(v2)!, new Set(["plugin:akismet/akismet.php", "core:core"]));
    expect(u.total).toBe(0);
    expect(u.core).toBeNull();
    expect(u.plugins).toEqual([]);
  });

  it("counts integrity problems, ignoring plugins that can't be checked", () => {
    const p = integrityProblems(parseReport(v2)!.integrity)!;
    expect(p.coreFiles).toBe(2);
    expect(p.plugins).toHaveLength(1);
    expect(p.total).toBe(3);
    expect(integrityProblems(null)).toBeNull();
  });

  it("lists edited plugins, leaving out ones that can't be checked", () => {
    const edited = editedPlugins(parseReport(v2)!);
    expect([...edited.keys()]).toEqual(["akismet/akismet.php"]);
    expect(edited.get("akismet/akismet.php")?.modified_count).toBe(1);
    expect(editedPlugins(parseReport({ ...v2, integrity: null })!).size).toBe(0);
  });
});

describe("failedLoginSources", () => {
  it("lists sources with failures, most first", () => {
    const r = parseReport({ ...v2, schema: 7, failed_logins_by_source: { login: 40, xmlrpc: 3100, rest: 0, other: 10 } })!;
    expect(failedLoginSources(r)).toEqual([
      { source: "xmlrpc", label: "XML-RPC", count: 3100 },
      { source: "login", label: "Login forms", count: 40 },
      { source: "other", label: "Unknown", count: 10 },
    ]);
  });

  it("is null for plugins that don't report sources", () => {
    expect(failedLoginSources(parseReport(v2)!)).toBeNull();
  });

  it("treats missing or malformed counts as zero", () => {
    const r = parseReport({ ...v2, failed_logins_by_source: { xmlrpc: 5, login: "x" } })!;
    expect(failedLoginSources(r)).toEqual([{ source: "xmlrpc", label: "XML-RPC", count: 5 }]);
  });
});

describe("schema 8 login fields", () => {
  it("parses hourly counts and hardening", () => {
    const r = parseReport({ ...v2, schema: 8, failed_logins_hourly: [{ hour: 1793264400, xmlrpc: 2 }], hardening: { xmlrpc_off: true } })!;
    expect(r.failed_logins_hourly).toEqual([{ hour: 1793264400, login: 0, xmlrpc: 2, rest: 0, other: 0 }]);
    expect(r.hardening).toEqual({ xmlrpc_off: true });
  });

  it("defaults for older reports", () => {
    const r = parseReport(v2)!;
    expect(r.failed_logins_hourly).toEqual([]);
    expect(r.hardening).toBeNull();
  });
});
