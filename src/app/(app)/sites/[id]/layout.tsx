import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { siteState, timeAgo } from "@/components/site-status";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { AutoRefresh } from "@/components/auto-refresh";
import { LabelPicker } from "@/components/label-picker";
import { awaitingReport, isPending, loadJobs } from "@/lib/updates";
import { loadLabels, loadSiteLabelIds } from "@/lib/labels";
import { integrityProblems, pendingUpdates } from "@/lib/report";
import { loadSite } from "@/lib/site";
import { ResyncButton } from "./resync-button";
import { SiteNav } from "./site-nav";
import { SiteSwitcher } from "./site-switcher";
import { WpAdminButton } from "./wp-admin-button";

export default function SiteLayout({ children, params }: LayoutProps<"/sites/[id]">) {
  return (
    <>
      <Link href="/sites" className="text-sm text-muted-foreground hover:underline">
        ← All sites
      </Link>
      <Suspense fallback={<p className="mt-6 text-sm text-muted-foreground">Loading site…</p>}>
        <SiteShell params={params}>{children}</SiteShell>
      </Suspense>
    </>
  );
}

async function SiteShell({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = await params;
  const data = await loadSite(id);
  if (!data) notFound();
  const { site, report, lastReport, now, state, excluded } = data;
  const [labels, siteLabelIds, allSites, jobs] = await Promise.all([
    loadLabels(site.userId),
    loadSiteLabelIds([site.id]),
    // For the site switcher.
    db.query.sites.findMany({
      columns: { id: true, name: true, url: true, lastReportAt: true },
      where: eq(sites.userId, site.userId),
      orderBy: [sites.name],
    }),
    loadJobs([site.id], 1).then((m) => m.get(site.id) ?? []),
  ]);
  // Running jobs refresh the page through <JobQueue>. Once they finish, keep refreshing
  // until the site's fresh report arrives, so finished updates stop showing as pending.
  const waitForReport = !jobs.some(isPending) && awaitingReport(jobs, site.lastReportAt, now);

  const updates = report ? pendingUpdates(report, excluded) : null;
  const counts = report
    ? {
        plugins: updates!.plugins.length,
        themes: updates!.themes.length,
        core: updates!.core ? 1 : 0,
        translations: updates!.translations,
        critical: report.health?.counts.critical ?? 0,
        files: integrityProblems(report.integrity)?.total ?? 0,
      }
    : null;

  return (
    <>
      <AutoRefresh active={waitForReport} />
      <header className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="min-w-0">
          <SiteSwitcher
            current={{ id: site.id, name: site.name }}
            state={state}
            sites={allSites.map((s) => ({ id: s.id, name: s.name, url: s.url, state: siteState(s.lastReportAt, now) }))}
          />
          <p className="mt-0.5 text-sm text-muted-foreground">
            <a href={site.url} target="_blank" rel="noreferrer" className="hover:underline">
              {site.url}
            </a>
            {lastReport && ` · Last report ${timeAgo(lastReport.receivedAt, now)}`}
          </p>
          <div className="mt-1.5">
            <LabelPicker
              siteId={site.id}
              labels={labels.map(({ id, name, color }) => ({ id, name, color }))}
              assigned={siteLabelIds.get(site.id) ?? []}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ResyncButton siteId={site.id} />
          <WpAdminButton siteId={site.id} siteUrl={site.url} sso={report?.sso ?? null} />
        </div>
      </header>
      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <SiteNav siteId={site.id} counts={counts} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
