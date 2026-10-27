// Pure (no DB) so it can be unit tested and used by server components.
import type { Report } from "./report";
import type { HistoryEntry } from "./updates";

/**
 * Which earlier version a plugin/theme can be rolled back to, if any: the copy
 * the plugin saved at its last update, otherwise the version before the most
 * recent successful update (the plugin then fetches it from wordpress.org,
 * which only works for directory plugins/themes).
 */
export function rollbackTarget(
  report: Report,
  item: { type: "plugin" | "theme"; id: string },
  currentVersion: string,
  history: HistoryEntry[] | undefined,
): { version: string; source: "saved" | "wordpress.org" } | null {
  const kept = report.rollbacks.find((r) => r.type === item.type && r.id === item.id);
  if (kept && kept.version !== currentVersion) return { version: kept.version, source: "saved" };

  const last = history?.find((h) => h.status === "updated" && h.to === currentVersion && h.from);
  if (!last?.from || last.from === currentVersion) return null;
  // Premium/custom plugins aren't on wordpress.org, so there'd be nothing to download.
  const integrity = item.type === "plugin" ? report.integrity?.plugins.find((p) => p.file === item.id)?.status : undefined;
  if (integrity === "not_checkable") return null;
  return { version: last.from, source: "wordpress.org" };
}
