import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { HealthBadge, ToneBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadFleet } from "@/lib/fleet";

export const metadata = { title: "Site Health · WP Siteherd" };

export default function HealthPage() {
  return (
    <>
      <PageHeader title="Site Health" description="WordPress's own Site Health checks, run daily on every site." />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading…</p>}>
        <HealthOverview />
      </Suspense>
    </>
  );
}

type IssueGroup = { key: string; label: string; status: "critical" | "recommended"; badge: string; sites: { id: string; name: string }[] };

async function HealthOverview() {
  const { sites, now } = await loadFleet();
  const checked = sites.filter((s) => s.report?.health);
  if (checked.length === 0) {
    return <EmptyState title="No Site Health results yet">Results arrive after each site&apos;s first daily check.</EmptyState>;
  }

  // The same issue on many sites usually has one fix (e.g. a hosting setting), so group by test.
  const groups = new Map<string, IssueGroup>();
  for (const site of checked) {
    for (const issue of site.report!.health!.issues) {
      const key = `${issue.status}:${issue.test || issue.label}`;
      const g = groups.get(key) ?? { key, label: issue.label, status: issue.status, badge: issue.badge, sites: [] };
      g.sites.push({ id: site.id, name: site.name });
      groups.set(key, g);
    }
  }
  const issues = [...groups.values()].sort(
    (a, b) => Number(b.status === "critical") - Number(a.status === "critical") || b.sites.length - a.sites.length,
  );
  const bySite = [...checked].sort(
    (a, b) =>
      b.report!.health!.counts.critical - a.report!.health!.counts.critical ||
      b.report!.health!.counts.recommended - a.report!.health!.counts.recommended,
  );

  return (
    <div className="mt-6 grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Issues across sites</CardTitle>
          <CardDescription>{issues.length === 0 ? "No issues on any site." : "Most widespread first."}</CardDescription>
        </CardHeader>
        {issues.length > 0 && (
          <CardContent>
            <ul className="divide-y">
              {issues.map((g) => (
                <li key={g.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge t={g.status === "critical" ? "bad" : "warn"}>
                      {g.status === "critical" ? "Critical" : "Recommended"}
                    </ToneBadge>
                    <span className="font-medium">{g.label}</span>
                    {g.badge && <span className="text-xs text-muted-foreground">{g.badge}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    <span>
                      {g.sites.length} {g.sites.length === 1 ? "site" : "sites"}:
                    </span>
                    {g.sites.map((s) => (
                      <Link key={s.id} href={`/sites/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By site</CardTitle>
          {checked.length < sites.length && (
            <CardDescription>
              {sites.length - checked.length} {sites.length - checked.length === 1 ? "site hasn't" : "sites haven't"} been
              checked yet.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Critical</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead>Passed</TableHead>
                <TableHead>Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySite.map((site) => {
                const h = site.report!.health!;
                const at = new Date(h.checked_at);
                return (
                  <TableRow key={site.id}>
                    <TableCell>
                      <Link href={`/sites/${site.id}`} className="font-medium hover:underline">
                        {site.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <HealthBadge health={h} />
                    </TableCell>
                    <TableCell>{h.counts.critical}</TableCell>
                    <TableCell>{h.counts.recommended}</TableCell>
                    <TableCell>{h.counts.good}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {Number.isNaN(at.getTime()) ? "—" : timeAgo(at, now)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
