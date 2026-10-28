// When a site's job goes quiet without a final result (e.g. the host ended the
// background PHP request after the work was done), the site's next report can
// still show whether each item happened. Pure, so it can be unit-tested.

import type { Report } from "./report";
import type { JobKind, UpdateItem, UpdateResult } from "./update-types";
import { compareVersions, slugOf } from "./vulnerabilities";

export const RECONCILED_MESSAGE = "Confirmed from the site's next report (the site didn't send a final result).";

function result(item: UpdateItem, status: UpdateResult["status"], to: string | null): UpdateResult {
  return { type: item.type, id: item.id, name: item.name, from: item.from || null, to, status, message: RECONCILED_MESSAGE };
}

/** The outcome of one item as far as the report shows it, or null if it doesn't show it done. */
function inferItem(kind: JobKind, item: UpdateItem, report: Report): UpdateResult | null {
  if (item.type === "core") {
    return (kind === "update" ? compareVersions(report.wp_version, item.to) >= 0 : report.wp_version === item.to)
      ? result(item, "updated", report.wp_version)
      : null;
  }
  if (item.type === "translations") return report.translations.length === 0 ? result(item, "updated", null) : null;

  if (item.type === "theme") {
    const theme = report.themes.find((t) => t.stylesheet === item.id);
    if (!theme) return null;
    const done = kind === "update" ? compareVersions(theme.version, item.to) >= 0 : theme.version === item.to;
    return done ? result(item, "updated", theme.version) : null;
  }

  // Plugins. Install items use the wordpress.org slug as id; the others the plugin file.
  if (kind === "install") {
    const plugin = report.plugins.find((p) => slugOf(p.file) === item.id);
    if (!plugin) return null;
    if (item.activate && !plugin.active) return null;
    return result(item, item.activate ? "activated" : "installed", plugin.version);
  }
  const plugin = report.plugins.find((p) => p.file === item.id);
  if (kind === "delete") return plugin ? null : result(item, "deleted", null);
  if (!plugin) return null;
  if (kind === "activate") return plugin.active ? result(item, "activated", plugin.version) : null;
  if (kind === "deactivate") return !plugin.active ? result(item, "deactivated", plugin.version) : null;
  const done = kind === "update" ? compareVersions(plugin.version, item.to) >= 0 : plugin.version === item.to;
  return done ? result(item, "updated", plugin.version) : null;
}

/**
 * Results for every item of the job if the report shows all of them done
 * (keeping results the site already pushed), otherwise null.
 */
export function inferJobResults(
  job: { kind: JobKind; items: UpdateItem[]; results: UpdateResult[] },
  report: Report,
): UpdateResult[] | null {
  const pushed = new Map(job.results.map((r) => [`${r.type}:${r.id}`, r]));
  const results: UpdateResult[] = [];
  for (const item of job.items) {
    const known = pushed.get(`${item.type}:${item.id}`);
    if (known) {
      results.push(known);
      continue;
    }
    const inferred = inferItem(job.kind, item, report);
    if (!inferred) return null;
    results.push(inferred);
  }
  return results;
}
