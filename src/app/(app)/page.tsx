import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ToneBadge } from "@/components/report-badges";
import { StatusBadge } from "@/components/site-status";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { attentionReasons, loadFleet } from "@/lib/fleet";
import { integrityProblems, pendingUpdates } from "@/lib/report";

export const metadata = { title: "Dashboard · WP Siteherd" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Everything across your WordPress sites at a glance." />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}

function Stat({ label, value, href, hint }: { label: string; value: number; href: string; hint: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl transition-colors hover:bg-muted/50">
      <Card size="sm" className="h-full bg-transparent">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-3xl">{value}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">{hint}</CardContent>
      </Card>
    </Link>
  );
}

async function Overview() {
  const { sites } = await loadFleet();

  if (sites.length === 0) {
    return (
      <EmptyState title="No sites yet">
        <p>Add your first WordPress site to start monitoring it.</p>
        <Link href="/sites/new" className={`${buttonVariants()} mt-4`}>
          Add site
        </Link>
      </EmptyState>
    );
  }

  const reporting = sites.filter((s) => s.state === "ok").length;
  const reports = sites.flatMap((s) => (s.report ? [s.report] : []));
  const pendingPerSite = sites.map((s) => (s.report ? pendingUpdates(s.report, s.excluded).total : 0));
  const updates = pendingPerSite.reduce((n, c) => n + c, 0);
  const sitesWithUpdates = pendingPerSite.filter((c) => c > 0).length;
  const critical = reports.reduce((n, r) => n + (r.health?.counts.critical ?? 0), 0);
  const changedFiles = reports.filter((r) => (integrityProblems(r.integrity)?.total ?? 0) > 0).length;
  const failedLogins = reports.reduce((n, r) => n + r.failed_logins_24h, 0);

  const attention = sites
    .map((site) => ({ site, reasons: attentionReasons(site) }))
    .filter((x) => x.reasons.length > 0);

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Sites" value={sites.length} href="/sites" hint={`${reporting} reporting`} />
        <Stat
          label="Pending updates"
          value={updates}
          href="/updates/plugins"
          hint={sitesWithUpdates ? `on ${sitesWithUpdates} ${sitesWithUpdates === 1 ? "site" : "sites"}` : "All up to date"}
        />
        <Stat label="Critical health issues" value={critical} href="/health" hint={critical ? "Needs fixing" : "None"} />
        <Stat
          label="Sites with changed files"
          value={changedFiles}
          href="/security"
          hint={changedFiles ? "Check for tampering" : "Files match"}
        />
        <Stat label="Failed logins (24 h)" value={failedLogins} href="/security" hint="Across all sites" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            {attention.length === 0
              ? "Nothing to do. Every site is reporting, updated and healthy."
              : `${attention.length} of ${sites.length} ${sites.length === 1 ? "site" : "sites"}`}
          </CardDescription>
        </CardHeader>
        {attention.length > 0 && (
          <CardContent>
            <ul className="divide-y">
              {attention.map(({ site, reasons }) => (
                <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/sites/${site.id}`} className="font-medium hover:underline">
                        {site.name}
                      </Link>
                      <StatusBadge state={site.state} />
                    </div>
                    <div className="text-xs text-muted-foreground">{site.url}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {reasons.map((reason) => (
                      <ToneBadge key={reason.text} t={reason.severity}>
                        {reason.text}
                      </ToneBadge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
