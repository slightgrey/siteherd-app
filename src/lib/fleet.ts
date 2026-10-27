import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { siteState } from "@/components/site-status";
import { db } from "@/db";
import { reports, sites } from "@/db/schema";
import { loadExclusions } from "@/lib/exclusions";
import { integrityProblems, parseReport, pendingUpdates } from "@/lib/report";
import { requireUser } from "@/lib/session";

/**
 * Every site of the current user with its latest parsed report. Used by the
 * cross-site pages (dashboard, updates, security, health). Calls connection(),
 * so render it behind <Suspense>.
 */
export async function loadFleet() {
  const user = await requireUser();
  await connection();
  const rows = await db.query.sites.findMany({
    columns: { secret: false },
    where: eq(sites.userId, user.id),
    orderBy: [sites.name],
    with: { reports: { orderBy: [desc(reports.receivedAt)], limit: 1 } },
  });
  const exclusions = await loadExclusions(rows.map((r) => r.id));
  const now = Date.now();
  return {
    now,
    sites: rows.map(({ reports: latest, ...site }) => ({
      ...site,
      state: siteState(site.lastReportAt, now),
      report: parseReport(latest[0]?.payload),
      excluded: exclusions.get(site.id)!,
    })),
  };
}

export type FleetSite = Awaited<ReturnType<typeof loadFleet>>["sites"][number];

export type AttentionReason = { text: string; severity: "bad" | "warn" | "muted" };

/** Reasons a site needs attention, most urgent first. Empty when all is well. */
export function attentionReasons(
  site: Pick<FleetSite, "state" | "report" | "excluded">,
): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (site.state === "never") reasons.push({ text: "Not connected yet", severity: "muted" });
  if (site.state === "stale") reasons.push({ text: "Stopped reporting", severity: "bad" });
  const r = site.report;
  if (!r) return reasons;

  const problems = integrityProblems(r.integrity);
  if (problems && problems.total > 0) reasons.push({ text: "Files changed", severity: "bad" });
  const critical = r.health?.counts.critical ?? 0;
  if (critical > 0) {
    reasons.push({ text: `${critical} critical Site Health ${critical === 1 ? "issue" : "issues"}`, severity: "bad" });
  }
  if (r.failed_logins_24h >= 20) reasons.push({ text: `${r.failed_logins_24h} failed logins`, severity: "bad" });
  const pending = pendingUpdates(r, site.excluded);
  if (pending.core) reasons.push({ text: `WordPress ${pending.core} available`, severity: "warn" });
  const updates = pending.plugins.length + pending.themes.length;
  if (updates > 0) {
    reasons.push({ text: `${updates} plugin/theme ${updates === 1 ? "update" : "updates"}`, severity: "warn" });
  }
  return reasons;
}
