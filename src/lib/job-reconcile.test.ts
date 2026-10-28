import { describe, expect, it } from "vitest";
import { inferJobResults } from "./job-reconcile";
import { parseReport } from "./report";
import type { UpdateItem } from "./update-types";

const report = parseReport({
  schema: 6,
  site_url: "https://example.test",
  wp_version: "6.8.3",
  plugins: [
    { file: "wp-siteherd/wp-siteherd.php", name: "WP Siteherd", version: "0.7.2", active: true },
    { file: "akismet/akismet.php", name: "Akismet", version: "5.3", active: false, update: "5.4" },
    { file: "hello-dolly/hello.php", name: "Hello Dolly", version: "1.7.2", active: true },
  ],
  themes: [{ stylesheet: "twentytwentyfive", name: "Twenty Twenty-Five", version: "1.2", active: true }],
})!;

const item = (over: Partial<UpdateItem>): UpdateItem => ({ type: "plugin", id: "wp-siteherd/wp-siteherd.php", name: "WP Siteherd", from: "0.7.0", to: "0.7.2", ...over });

describe("inferJobResults", () => {
  it("confirms an update once the report shows the new version", () => {
    const results = inferJobResults({ kind: "update", items: [item({})], results: [] }, report);
    expect(results).toHaveLength(1);
    expect(results![0]).toMatchObject({ status: "updated", from: "0.7.0", to: "0.7.2" });
  });

  it("waits while any item isn't done yet", () => {
    const items = [item({}), item({ id: "akismet/akismet.php", name: "Akismet", from: "5.3", to: "5.4" })];
    expect(inferJobResults({ kind: "update", items, results: [] }, report)).toBeNull();
  });

  it("keeps results the site already pushed", () => {
    const pushed = { type: "plugin" as const, id: "akismet/akismet.php", name: "Akismet", from: "5.3", to: "5.4", status: "failed" as const, message: "x" };
    const items = [item({}), item({ id: "akismet/akismet.php", name: "Akismet", from: "5.3", to: "5.4" })];
    const results = inferJobResults({ kind: "update", items, results: [pushed] }, report);
    expect(results!.map((r) => r.status)).toEqual(["updated", "failed"]);
  });

  it("handles installs, deletes, activation and themes", () => {
    expect(inferJobResults({ kind: "install", items: [item({ id: "hello-dolly", activate: true })], results: [] }, report)![0].status).toBe("activated");
    expect(inferJobResults({ kind: "install", items: [item({ id: "classic-editor" })], results: [] }, report)).toBeNull();
    expect(inferJobResults({ kind: "delete", items: [item({ id: "gone/gone.php" })], results: [] }, report)![0].status).toBe("deleted");
    expect(inferJobResults({ kind: "delete", items: [item({ id: "akismet/akismet.php" })], results: [] }, report)).toBeNull();
    expect(inferJobResults({ kind: "activate", items: [item({ id: "akismet/akismet.php" })], results: [] }, report)).toBeNull();
    expect(inferJobResults({ kind: "deactivate", items: [item({ id: "akismet/akismet.php" })], results: [] }, report)![0].status).toBe("deactivated");
    const theme = item({ type: "theme", id: "twentytwentyfive", from: "1.1", to: "1.2" });
    expect(inferJobResults({ kind: "update", items: [theme], results: [] }, report)![0].status).toBe("updated");
  });

  it("checks core and translations", () => {
    const core = item({ type: "core", id: "core", from: "6.8.2", to: "6.8.3" });
    expect(inferJobResults({ kind: "update", items: [core], results: [] }, report)![0].status).toBe("updated");
    const tr = item({ type: "translations", id: "translations", from: "", to: "" });
    expect(inferJobResults({ kind: "update", items: [tr], results: [] }, report)![0].status).toBe("updated");
  });
});
