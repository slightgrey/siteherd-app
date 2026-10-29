import Link from "next/link";
import { cn } from "@/lib/utils";
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

  const totals = checked.reduce(
    (t, s) => {
      const c = s.report!.health!.counts;
      return { critical: t.critical + c.critical, recommended: t.recommended + c.recommended, good: t.good + c.good };
    },
    { critical: 0, recommended: 0, good: 0 },
  );
  const summary = [
    { label: "Critical", n: totals.critical, dot: "bg-bad" },
    { label: "Recommended", n: totals.recommended, dot: "bg-warn" },
    { label: "Passed", n: totals.good, dot: "bg-good" },
  ];

  return (
    <div className="mt-6 grid gap-6">
      <section className="grid gap-3 rounded-[14px] bg-card px-6 py-5 shadow-card ring-1 ring-border" aria-label="Checks across all sites">
        <div className="flex h-2.5 gap-1" aria-hidden="true">
          {summary
            .filter((x) => x.n > 0)
            .map((x) => (
              <span key={x.label} className={cn("rounded-full", x.dot)} style={{ flex: x.n }} />
            ))}
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-muted-foreground">
          {summary.map((x) => (
            <span key={x.label} className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", x.dot)} />
              <strong className="font-display text-base font-semibold text-foreground tabular-nums">{x.n}</strong>
              {x.label}
            </span>
          ))}
          <span className="sm:ml-auto">
            {checked.length} of {sites.length} {sites.length === 1 ? "site" : "sites"} checked
          </span>
        </div>
      </section>

      <Card className="gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>Issues across sites</CardTitle>
          <CardDescription>{issues.length === 0 ? "No issues on any site." : "Most widespread first."}</CardDescription>
        </CardHeader>
        {issues.length > 0 && (
          <CardContent className="px-0">
            <ul className="divide-y border-t">
              {issues.map((g) => (
                <li
                  key={g.key}
                  className={cn(
                    "relative grid gap-1.5 px-5 py-3.5 transition-colors hover:bg-muted/60",
                    "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full",
                    g.status === "critical" ? "before:bg-bad" : "before:bg-warn",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge t={g.status === "critical" ? "bad" : "warn"}>
                      {g.status === "critical" ? "Critical" : "Recommended"}
                    </ToneBadge>
                    <span className="font-medium">{g.label}</span>
                    {g.badge && (
                      <span className="rounded-md px-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase ring-1 ring-border">
                        {g.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span className="mr-1">
                      {g.sites.length} {g.sites.length === 1 ? "site" : "sites"}
                    </span>
                    {g.sites.map((s) => (
                      <Link
                        key={s.id}
                        href={`/sites/${s.id}/health`}
                        className="rounded-md bg-muted px-2 py-0.5 text-foreground ring-1 ring-border transition-colors hover:bg-accent hover:text-primary"
                      >
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

      <Card className="gap-0 py-0">
        <CardHeader className="py-4">
          <CardTitle>By site</CardTitle>
          {checked.length < sites.length && (
            <CardDescription>
              {sites.length - checked.length} {sites.length - checked.length === 1 ? "site hasn't" : "sites haven't"} been
              checked yet.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Critical</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead>Passed</TableHead>
                <TableHead className="w-40">Checks</TableHead>
                <TableHead>Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySite.map((site) => {
                const h = site.report!.health!;
                const at = new Date(h.checked_at);
                return (
                  <TableRow key={site.id}>
                    <TableCell className="pl-5">
                      <Link href={`/sites/${site.id}/health`} className="font-medium hover:text-primary">
                        {site.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <HealthBadge health={h} />
                    </TableCell>
                    <TableCell className={cn("tabular-nums", h.counts.critical > 0 && "font-semibold text-bad")}>{h.counts.critical}</TableCell>
                    <TableCell className={cn("tabular-nums", h.counts.recommended > 0 && "text-warn")}>{h.counts.recommended}</TableCell>
                    <TableCell className="tabular-nums">{h.counts.good}</TableCell>
                    <TableCell>
                      <div className="flex h-1.5 w-32 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                        <span className="bg-bad" style={{ flex: h.counts.critical }} />
                        <span className="bg-warn" style={{ flex: h.counts.recommended }} />
                        <span className="bg-good" style={{ flex: h.counts.good }} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
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
