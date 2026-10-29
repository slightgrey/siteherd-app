import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reports, type UpdateJob } from "@/db/schema";
import { loadAdminEvents } from "@/lib/login-data";
import { integrityProblems, parseReport } from "@/lib/report";
import { loadJobs } from "@/lib/updates";

// The activity log is assembled from data already stored: update jobs,
// daily-check results inside reports, admin changes noticed between reports,
// and the site's own timestamps.

export type ActivityEntry =
  | { kind: "update"; at: Date; job: UpdateJob }
  | {
      kind: "checks";
      at: Date;
      health: { critical: number; recommended: number; good: number } | null;
      files: { problems: number; error: string | null } | null;
    }
  | { kind: "admin"; at: Date; added: boolean; name: string; login: string }
  | { kind: "site"; at: Date; title: string };

// Upper bound on history assembled per view; the page shows it 20 at a time.
const MAX_ENTRIES = 500;

export async function loadActivity(site: { id: string; createdAt: Date }): Promise<ActivityEntry[]> {
  const [jobs, checks, first, admins] = await Promise.all([
    loadJobs([site.id], MAX_ENTRIES).then((m) => m.get(site.id) ?? []),
    // One row per daily-check run: each run's results appear in many reports,
    // so keep the first report that carried each health.checked_at.
    db.execute<{ health: unknown; integrity: unknown }>(sql`
      select distinct on (payload->'health'->>'checked_at') payload->'health' as health, payload->'integrity' as integrity
      from ${reports}
      where ${reports.siteId} = ${site.id} and payload->'health'->>'checked_at' is not null
      order by payload->'health'->>'checked_at' desc, ${reports.receivedAt} asc
      limit ${MAX_ENTRIES}
    `),
    db.query.reports.findFirst({
      columns: { receivedAt: true },
      where: and(eq(reports.siteId, site.id)),
      orderBy: [asc(reports.receivedAt)],
    }),
    loadAdminEvents(site.id, MAX_ENTRIES),
  ]);

  const entries: ActivityEntry[] = [
    ...jobs.map((job) => ({ kind: "update" as const, at: job.createdAt, job })),
    ...checks.map((row) => {
      const parsed = parseReport({ health: row.health, integrity: row.integrity });
      const health = parsed?.health ?? null;
      const problems = integrityProblems(parsed?.integrity ?? null);
      return {
        kind: "checks" as const,
        at: new Date(health?.checked_at ?? 0),
        health: health ? health.counts : null,
        files: problems ? { problems: problems.total, error: problems.coreError } : null,
      };
    }),
    ...admins.map((e) => ({ kind: "admin" as const, at: e.at, added: e.kind === "admin_added", name: e.data.name, login: e.data.login })),
    { kind: "site", at: site.createdAt, title: "Site added to WP Siteherd" },
    ...(first ? [{ kind: "site" as const, at: first.receivedAt, title: "First report received from the plugin" }] : []),
  ];

  return entries
    .filter((e) => !Number.isNaN(e.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, MAX_ENTRIES);
}
