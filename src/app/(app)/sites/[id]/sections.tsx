import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyField } from "@/components/copy-field";
import { EmptyState } from "@/components/page-header";
import { FailedLoginsBadge, HealthBadge, IntegrityBadge, ToneBadge, UpdatesBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { encodeConnectionKey } from "@/lib/connection-key";
import { attentionReasons } from "@/lib/fleet";
import { integrityProblems, pendingUpdates, type Health, type Integrity, type PluginIntegrity, type Report } from "@/lib/report";
import { loadSite, type SiteData } from "@/lib/site";

type Params = Promise<{ id: string }>;

type WithReport = SiteData & { report: Report };

/**
 * Loads the site for a /sites/[id] page behind its own Suspense boundary and
 * hands it to `children`. With `needsReport`, a site that hasn't reported yet
 * gets a "no report yet" state instead and `children` always has a report.
 */
export function WithSite(props: { params: Params; needsReport: true; children: (data: WithReport) => React.ReactNode }): React.ReactNode;
export function WithSite(props: { params: Params; needsReport?: false; children: (data: SiteData) => React.ReactNode }): React.ReactNode;
export function WithSite({
  params,
  needsReport = false,
  children,
}: {
  params: Params;
  needsReport?: boolean;
  children: (data: WithReport) => React.ReactNode;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Resolve params={params} needsReport={needsReport}>
        {children}
      </Resolve>
    </Suspense>
  );
}

async function Resolve({
  params,
  needsReport,
  children,
}: {
  params: Params;
  needsReport: boolean;
  children: (data: WithReport) => React.ReactNode;
}) {
  const { id } = await params;
  const data = await loadSite(id);
  if (!data) notFound();
  if (needsReport && !data.report) {
    return (
      <EmptyState title="No report yet">
        This appears after the plugin sends its first report.{" "}
        <Link href={`/sites/${data.site.id}/settings`} className="underline underline-offset-4">
          Connect the plugin
        </Link>
      </EmptyState>
    );
  }
  // Without needsReport the overload types `children` as taking SiteData, so a null report is expected there.
  return children(data as WithReport);
}

export function SectionTitle({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function checkedAgo(iso: string, now: number) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : `Checked ${timeAgo(date, now)}`;
}

function Stat({ label, value, href, children }: { label: string; value: React.ReactNode; href?: string; children?: React.ReactNode }) {
  const card = (
    <Card size="sm" className="h-full bg-transparent">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-xl">{value}</CardTitle>
      </CardHeader>
      {children && <CardContent className="text-sm text-muted-foreground">{children}</CardContent>}
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl transition-colors hover:bg-muted/50">
      {card}
    </Link>
  ) : (
    card
  );
}

export function OverviewStats({ data }: { data: WithReport }) {
  const { report, now, site } = data;
  const base = `/sites/${site.id}`;
  const updates = pendingUpdates(report, data.excluded);
  const problems = integrityProblems(report.integrity);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Stat label="WordPress" value={report.wp_version || "—"} href={`${base}/core`}>
        {updates.core ? <ToneBadge t="warn">{updates.core} available</ToneBadge> : report.core_update ? "Update excluded" : "Latest version"}
      </Stat>
      <Stat label="PHP" value={report.php_version || "—"} href={`${base}/core`}>
        Database {report.db_version || "unknown"}
      </Stat>
      <Stat label="Pending updates" value={updates.total} href={`${base}/plugins`}>
        <UpdatesBadge total={updates.total} />
      </Stat>
      <Stat label="Site Health" value={report.health ? `${report.health.counts.good} passed` : "—"} href={`${base}/health`}>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge health={report.health} />
          {report.health && checkedAgo(report.health.checked_at, now)}
        </div>
      </Stat>
      <Stat label="Failed logins (24 h)" value={report.failed_logins_24h} href={`${base}/logins`}>
        {report.failed_logins_24h === 0 ? "None" : <FailedLoginsBadge count={report.failed_logins_24h} />}
      </Stat>
      <Stat label="File integrity" value={problems ? (problems.total === 0 ? "OK" : problems.total) : "—"} href={`${base}/security`}>
        <div className="flex flex-wrap items-center gap-2">
          <IntegrityBadge integrity={report.integrity} />
          {report.integrity && checkedAgo(report.integrity.checked_at, now)}
        </div>
      </Stat>
    </div>
  );
}

export function AttentionCard({ data }: { data: SiteData }) {
  const reasons = attentionReasons(data);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>{reasons.length === 0 ? "Nothing to do. This site is reporting, updated and healthy." : null}</CardDescription>
      </CardHeader>
      {reasons.length > 0 && (
        <CardContent className="flex flex-wrap gap-1">
          {reasons.map((r) => (
            <ToneBadge key={r.text} t={r.severity}>
              {r.text}
            </ToneBadge>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export function HealthIssues({ health, now }: { health: Health | null; now: number }) {
  if (!health) {
    return <EmptyState title="Not checked yet">Site Health runs once a day. Results arrive with the first daily check.</EmptyState>;
  }
  const { good, recommended, critical } = health.counts;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {critical} critical · {recommended} recommended · {good} passed
        </CardTitle>
        <CardDescription>{checkedAgo(health.checked_at, now)}</CardDescription>
      </CardHeader>
      <CardContent>
        {health.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">All checks passed.</p>
        ) : (
          <ul className="divide-y">
            {health.issues.map((issue) => (
              <li key={issue.test + issue.label} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ToneBadge t={issue.status === "critical" ? "bad" : "warn"}>
                    {issue.status === "critical" ? "Critical" : "Recommended"}
                  </ToneBadge>
                  <span className="font-medium">{issue.label}</span>
                  {issue.badge && <span className="text-xs text-muted-foreground">{issue.badge}</span>}
                </div>
                {issue.description && <p className="mt-1 text-sm text-muted-foreground">{issue.description}</p>}
              </li>
            ))}
          </ul>
        )}
        {health.skipped > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">{health.skipped} checks need a browser and were skipped.</p>
        )}
      </CardContent>
    </Card>
  );
}

function FileList({ kind, where, files, total }: { kind: string; where?: string; files: string[]; total: number }) {
  if (total === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer">
        {total} {kind} {total === 1 ? "file" : "files"}
        {where && ` ${where}`}
      </summary>
      <ul className="mt-1 space-y-0.5 pl-4 font-mono text-xs text-muted-foreground">
        {files.map((f) => (
          <li key={f}>{f}</li>
        ))}
        {total > files.length && <li>…and {total - files.length} more</li>}
      </ul>
    </details>
  );
}

export function CoreIntegrity({ integrity, now }: { integrity: Integrity | null; now: number }) {
  if (!integrity) return <p className="text-sm text-muted-foreground">Not checked yet. File checks run once a day.</p>;
  const { core } = integrity;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {core.status === "ok" && <ToneBadge t="good">Matches wordpress.org</ToneBadge>}
        {core.status === "issues" && <ToneBadge t="bad">Changed</ToneBadge>}
        {core.status === "error" && <ToneBadge t="warn">Couldn&apos;t verify</ToneBadge>}
        <span className="text-sm text-muted-foreground">{checkedAgo(integrity.checked_at, now)}</span>
      </div>
      {core.status === "error" && <p className="mt-1 text-sm text-muted-foreground">{core.error}</p>}
      <div className="mt-2 grid gap-1">
        <FileList kind="modified" files={core.modified} total={core.modified_count} />
        <FileList kind="missing" files={core.missing} total={core.missing_count} />
        <FileList kind="unexpected" where="in wp-admin, wp-includes or the site root" files={core.unexpected} total={core.unexpected_count} />
      </div>
    </div>
  );
}

export function PluginIntegrityList({ integrity, report }: { integrity: Integrity | null; report: Report }) {
  if (!integrity) return <p className="text-sm text-muted-foreground">Not checked yet. File checks run once a day.</p>;
  const by = (s: PluginIntegrity["status"]) => integrity.plugins.filter((p) => p.status === s);
  const changed = by("issues");
  const name = (p: PluginIntegrity) => report.plugins.find((x) => x.file === p.file)?.name ?? p.file;
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {by("ok").length} match · {changed.length} changed · {by("not_checkable").length} can&apos;t be checked (not from
        wordpress.org, e.g. premium or custom plugins)
        {by("error").length > 0 && ` · ${by("error").length} couldn't be verified`}
      </p>
      {changed.map((p) => (
        <div key={p.file} className="mt-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {name(p)} <ToneBadge t="bad">Changed</ToneBadge>
          </div>
          <FileList kind="modified" files={p.modified} total={p.modified_count} />
          <FileList kind="missing" files={p.missing} total={p.missing_count} />
        </div>
      ))}
    </div>
  );
}

export function EnvironmentTable({ report }: { report: Report }) {
  const rows: [string, React.ReactNode][] = [
    ["WordPress", <>{report.wp_version || "—"} {report.core_update && <ToneBadge t="warn">{report.core_update} available</ToneBadge>}</>],
    ["PHP", report.php_version || "—"],
    ["Database", report.db_version || "—"],
    ["Language", report.locale || "—"],
    ["Multisite", report.is_multisite ? "Yes" : "No"],
    ["Site address", report.site_url || "—"],
    ["WP Siteherd plugin", report.plugin_version || "—"],
  ];
  return (
    <div className="overflow-x-auto rounded-[14px] bg-card shadow-card ring-1 ring-border">
      <Table>
        <TableBody>
          {rows.map(([label, value]) => (
            <TableRow key={label}>
              <TableCell className="w-48 pl-4 text-muted-foreground">{label}</TableCell>
              <TableCell className="pr-4 font-mono text-xs">{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function connectionKeyFor(site: SiteData["site"]) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL is not set");
  return encodeConnectionKey({ url: appUrl, id: site.id, secret: site.secret });
}

export function ConnectionCard({ connectionKey, siteUrl }: { connectionKey: string; siteUrl: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection key</CardTitle>
        <CardDescription>Treat this like a password. Anyone with it can send reports as this site.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <CopyField value={connectionKey} label="Connection key" />
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Install and activate the WP Siteherd plugin on {siteUrl}.</li>
          <li>In WordPress, go to Settings → WP Siteherd.</li>
          <li>Paste the key above and click Connect. The site shows as Reporting after its first report.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
