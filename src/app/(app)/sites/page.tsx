import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { FailedLoginsBadge, HealthBadge, IntegrityBadge, ToneBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { buttonVariants } from "@/components/ui/button";
import { UpdatesBreakdown } from "@/components/updates-breakdown";
import { loadFleet } from "@/lib/fleet";
import { loadLabels, loadSiteLabelIds } from "@/lib/labels";
import { integrityProblems, pendingUpdates, siteIconUrl, type Report } from "@/lib/report";
import { requireUser } from "@/lib/session";
import { SitesList, type SiteFilters, type SiteListRow } from "./sites-list";

export const metadata = { title: "Sites · WP Siteherd" };

const badgeLink = "rounded-full outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50";

/** Section of the site's Security page to open: core files, unless only plugin files changed. */
function filesAnchor(report: Report) {
  const problems = integrityProblems(report.integrity);
  return problems && problems.coreFiles === 0 && !problems.coreError && problems.plugins.length > 0 ? "plugin-files" : "core-files";
}

export default function SitesPage({ searchParams }: PageProps<"/sites">) {
  return (
    <>
      <PageHeader
        title="Sites"
        description="Latest report from each connected WordPress site."
        action={
          <Link href="/sites/new" className={buttonVariants()}>
            Add site
          </Link>
        }
      />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading sites…</p>}>
        <SitesTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SitesTable({ searchParams }: { searchParams: PageProps<"/sites">["searchParams"] }) {
  const { sites, now } = await loadFleet();
  if (sites.length === 0) {
    return (
      <EmptyState title="No sites yet">
        Add a site to get its connection key, then paste it into the WP Siteherd plugin.
      </EmptyState>
    );
  }

  const user = await requireUser();
  const [labels, siteLabelIds, params] = await Promise.all([
    loadLabels(user.id),
    loadSiteLabelIds(sites.map((s) => s.id)),
    searchParams,
  ]);
  const param = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");
  // Filters come from the URL so a filtered list can be bookmarked or linked (e.g. from the Labels page).
  const initial: SiteFilters = {
    q: param("q"),
    label: param("label"),
    status: param("status"),
    wp: param("wp"),
    php: param("php"),
    sort: param("sort"),
  };

  const rows: SiteListRow[] = sites.map((site) => {
    const report = site.report;
    const pending = report ? pendingUpdates(report, site.excluded) : null;
    return {
      id: site.id,
      name: site.name,
      url: site.url,
      icon: siteIconUrl(report),
      lastReport: site.lastReportAt ? timeAgo(site.lastReportAt, now) : null,
      state: site.state,
      wp: report?.wp_version || null,
      php: report?.php_version || null,
      coreUpdate: pending?.core ?? null,
      updates: pending ? pending.total : null,
      labelIds: siteLabelIds.get(site.id) ?? [],
      sso: report?.sso ?? null,
      // Rendered here so the client gets the badges, not the full health and file-check data.
      cells: report
        ? {
            updates: (
              <UpdatesBreakdown
                href={`/sites/${site.id}/plugins`}
                counts={{
                  core: pending!.core,
                  plugins: pending!.plugins.length,
                  themes: pending!.themes.length,
                  translations: pending!.translations,
                  total: pending!.total,
                }}
              />
            ),
            // Each badge opens the page (and section) with the details.
            health: (
              <Link href={`/sites/${site.id}/health`} className={badgeLink} title="Open Site Health">
                <HealthBadge health={report.health} />
              </Link>
            ),
            security: (
              <div className="flex flex-wrap gap-1">
                <Link href={`/sites/${site.id}/security#${filesAnchor(report)}`} className={badgeLink} title="Open the file check">
                  <IntegrityBadge integrity={report.integrity} />
                </Link>
                {report.failed_logins_24h > 0 && (
                  <Link href={`/sites/${site.id}/logins`} className={badgeLink} title="Open failed logins">
                    <FailedLoginsBadge count={report.failed_logins_24h} />
                  </Link>
                )}
              </div>
            ),
            coreUpdate: pending!.core ? <ToneBadge t="warn">{pending!.core} available</ToneBadge> : null,
          }
        : null,
    };
  });

  return <SitesList rows={rows} labels={labels.map(({ id, name, color }) => ({ id, name, color }))} initial={initial} />;
}
