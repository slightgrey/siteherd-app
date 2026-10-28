import { and, desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";
import { siteState } from "@/components/site-status";
import { db } from "@/db";
import { reports, sites } from "@/db/schema";
import { loadExclusions } from "@/lib/exclusions";
import { isUuid } from "@/lib/ids";
import { parseReport } from "@/lib/report";
import { requireUser } from "@/lib/session";
import { ensureFreshFeed, loadVulns } from "@/lib/vuln-feed";

/**
 * One site of the current user with its latest report, or null if it doesn't
 * exist or isn't theirs. Wrapped in React cache() so the /sites/[id] layout and
 * page share one query per request. Calls connection(): render behind <Suspense>.
 */
export const loadSite = cache(async (id: string) => {
  const user = await requireUser();
  await connection();
  if (!isUuid(id)) return null;
  const row = await db.query.sites.findFirst({
    where: and(eq(sites.id, id), eq(sites.userId, user.id)),
    with: { reports: { orderBy: [desc(reports.receivedAt)], limit: 1 } },
  });
  if (!row) return null;
  const { reports: latest, ...site } = row;
  const excluded = (await loadExclusions([site.id])).get(site.id)!;
  const now = Date.now();
  const report = parseReport(latest[0]?.payload);
  await ensureFreshFeed();
  const vulns = (await loadVulns([{ id: site.id, report }])).get(site.id)!;
  return {
    site,
    vulns,
    now,
    excluded,
    state: siteState(site.lastReportAt, now),
    lastReport: latest[0] ?? null,
    report,
  };
});

export type SiteData = NonNullable<Awaited<ReturnType<typeof loadSite>>>;
