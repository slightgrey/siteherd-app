import { CircleCheck, Code2, FileWarning, HeartPulse, KeyRound, RefreshCw, Server, ShieldAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyField } from "@/components/copy-field";
import { EmptyState } from "@/components/page-header";
import { FailedLoginsBadge, HealthBadge, IntegrityBadge, ToneBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { encodeConnectionKey } from "@/lib/connection-key";
import { attentionReasons } from "@/lib/fleet";
import { integrityProblems, pendingUpdates, type Health, type Integrity, type PluginIntegrity, type Report } from "@/lib/report";
import { loadSite, type SiteData } from "@/lib/site";
import { cn } from "@/lib/utils";

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
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function checkedAgo(iso: string, now: number) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : `Checked ${timeAgo(date, now)}`;
}

type Tone = "good" | "warn" | "bad" | "neutral";

const toneWell: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-muted text-muted-foreground",
};

const tileClass =
  "group flex min-w-0 flex-col gap-3 rounded-[14px] bg-card p-5 text-card-foreground shadow-card ring-1 ring-border transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0";

/** One overview tile: eyebrow label, the value large, then a detail line. The whole tile links to its page. */
function Stat({
  label,
  value,
  href,
  icon: Icon,
  tone,
  mono = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  href: string;
  icon: LucideIcon;
  tone: Tone;
  /** Versions read better in the mono face; counts use the display face. */
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className={tileClass}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px]", toneWell[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <div
        className={cn(
          "tabular-nums",
          mono ? "font-mono text-[26px] leading-9 font-medium tracking-tight" : "font-display text-4xl font-semibold tracking-tight",
        )}
      >
        {value}
      </div>
      {children && <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{children}</div>}
    </Link>
  );
}

/** The last 24 hours of failed logins as bars, oldest on the left. */
function LoginSpark({ hours }: { hours: Report["failed_logins_hourly"] }) {
  const sorted = [...hours].sort((a, b) => a.hour - b.hour).slice(-24);
  if (sorted.length < 2) return null;
  const totals = sorted.map((h) => h.login + h.xmlrpc + h.rest + h.other);
  const max = Math.max(1, ...totals);
  return (
    <div className="flex h-7 items-end gap-[2px]" role="img" aria-label={`Failed logins per hour, peak ${max}`}>
      {totals.map((n, i) => (
        <span
          key={sorted[i].hour}
          className={cn("min-h-[2px] flex-1 rounded-[2px]", n === 0 ? "bg-muted" : i === totals.length - 1 ? "bg-bad" : "bg-bad/45")}
          style={{ height: `${Math.max(8, (n / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function OverviewStats({ data }: { data: WithReport }) {
  const { report, now, site } = data;
  const base = `/sites/${site.id}`;
  const updates = pendingUpdates(report, data.excluded);
  const problems = integrityProblems(report.integrity);
  const health = report.health?.counts;
  const failed = report.failed_logins_24h;
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="WordPress" value={report.wp_version || "—"} href={`${base}/core`} icon={Code2} tone={updates.core ? "warn" : "good"} mono>
          {updates.core ? (
            <ToneBadge t="warn">{updates.core} available</ToneBadge>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-good" />
              {report.core_update ? "Update excluded" : "Latest version"}
            </>
          )}
        </Stat>
        <Stat label="PHP" value={report.php_version || "—"} href={`${base}/core`} icon={Server} tone="neutral" mono>
          <span className="font-mono text-xs">Database {report.db_version || "unknown"}</span>
        </Stat>
        <Stat label="Pending updates" value={updates.total} href={`${base}/plugins`} icon={RefreshCw} tone={updates.total ? "warn" : "good"}>
          {updates.total === 0 ? (
            <>
              <span className="size-1.5 rounded-full bg-good" />
              Up to date
            </>
          ) : (
            <span className="truncate">
              {[
                updates.plugins.length && `${updates.plugins.length} plugin${updates.plugins.length === 1 ? "" : "s"}`,
                updates.themes.length && `${updates.themes.length} theme${updates.themes.length === 1 ? "" : "s"}`,
                updates.core && "core",
                updates.translations && "translations",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </Stat>
        <Stat
          label="Site Health"
          value={health ? health.good : "—"}
          href={`${base}/health`}
          icon={HeartPulse}
          tone={!health ? "neutral" : health.critical ? "bad" : health.recommended ? "warn" : "good"}
        >
          {health && (
            <div className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              <span className="bg-good" style={{ flex: health.good }} />
              <span className="bg-warn" style={{ flex: health.recommended }} />
              <span className="bg-bad" style={{ flex: health.critical }} />
            </div>
          )}
          <HealthBadge health={report.health} />
          {report.health && <span>{health!.good} passed · {checkedAgo(report.health.checked_at, now)}</span>}
        </Stat>
        <Stat label="Failed logins · 24 h" value={failed} href={`${base}/logins`} icon={KeyRound} tone={failed >= 20 ? "bad" : failed > 0 ? "warn" : "neutral"}>
          <div className="w-full">
            <LoginSpark hours={report.failed_logins_hourly} />
          </div>
          {failed === 0 ? "None in the last 24 hours" : <FailedLoginsBadge count={failed} />}
        </Stat>
        <Stat
          label="File integrity"
          value={problems ? (problems.total === 0 ? "OK" : problems.total) : "—"}
          href={`${base}/security`}
          icon={FileWarning}
          tone={!problems ? "neutral" : problems.total ? "bad" : "good"}
        >
          <IntegrityBadge integrity={report.integrity} />
          {report.integrity && checkedAgo(report.integrity.checked_at, now)}
        </Stat>
      </div>
      <Installed data={data} />
    </div>
  );
}

/** What's installed: plugin and theme counts, the active theme, and site facts. */
function Installed({ data }: { data: WithReport }) {
  const { report, site } = data;
  const base = `/sites/${site.id}`;
  const activePlugins = report.plugins.filter((p) => p.active).length;
  const theme = report.themes.find((t) => t.active);
  const facts: { label: string; value: React.ReactNode; href?: string }[] = [
    { label: "Plugins", value: `${activePlugins} active · ${report.plugins.length - activePlugins} inactive`, href: `${base}/plugins` },
    { label: "Theme", value: theme ? `${theme.name} ${theme.version}` : "—", href: `${base}/themes` },
    { label: "Language", value: report.locale || "—", href: `${base}/translations` },
    { label: "Multisite", value: report.is_multisite ? "Yes" : "No" },
    { label: "WP Siteherd", value: report.plugin_version ? `v${report.plugin_version}` : "—", href: `${base}/settings` },
  ];
  return (
    <section className="overflow-hidden rounded-[14px] bg-card shadow-card ring-1 ring-border" aria-label="Installed">
      <h2 className="px-5 pt-4 pb-3 font-display text-lg font-semibold tracking-tight">Installed</h2>
      <dl className="grid grid-cols-1 border-t sm:grid-cols-2 xl:grid-cols-5">
        {facts.map((f) => (
          <div key={f.label} className="grid gap-1 border-b px-5 py-3.5 sm:border-r xl:border-b-0 xl:last:border-r-0">
            <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{f.label}</dt>
            <dd className="truncate font-mono text-[13px]">
              {f.href ? (
                <Link href={f.href} className="hover:text-primary">
                  {f.value}
                </Link>
              ) : (
                f.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AttentionCard({ data }: { data: SiteData }) {
  const reasons = attentionReasons(data);
  const bad = reasons.some((r) => r.severity === "bad");
  const tone: Tone = reasons.length === 0 ? "good" : bad ? "bad" : "warn";
  const Icon = reasons.length === 0 ? CircleCheck : bad ? ShieldAlert : RefreshCw;
  return (
    <section
      aria-label="Needs attention"
      className={cn(
        "relative flex flex-wrap items-center gap-4 overflow-hidden rounded-[14px] bg-card px-5 py-4 shadow-card ring-1 ring-border",
        "before:absolute before:inset-y-0 before:left-0 before:w-1",
        tone === "bad" ? "before:bg-bad" : tone === "warn" ? "before:bg-warn" : "before:bg-good",
      )}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[10px]", toneWell[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <h2 className="font-display text-lg leading-6 font-semibold tracking-tight">
          {reasons.length === 0 ? "All clear" : `${reasons.length} ${reasons.length === 1 ? "thing needs" : "things need"} attention`}
        </h2>
        {reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">This site is reporting, updated and healthy.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {reasons.map((r) => (
              <ToneBadge key={r.text} t={r.severity}>
                {r.text}
              </ToneBadge>
            ))}
          </div>
        )}
      </div>
    </section>
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
      <div className="mt-3 grid gap-1 rounded-[10px] bg-muted/60 px-3 py-2 empty:hidden">
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
    ["WP Siteherd plugin", report.plugin_version || "—"],
    ["Site address", report.site_url || "—"],
  ];
  return (
    <section className="overflow-hidden rounded-[14px] bg-card shadow-card ring-1 ring-border" aria-label="Environment">
      <h2 className="px-5 pt-4 pb-3 font-display text-lg font-semibold tracking-tight">Environment</h2>
      <dl className="grid grid-cols-1 border-t sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={cn(
              "grid min-w-0 gap-1 border-b px-5 py-3.5 sm:border-r",
              // The site address is long: give it the full last row.
              i === rows.length - 1 && "sm:col-span-2 lg:col-span-3 sm:border-r-0 border-b-0",
            )}
          >
            <dt className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</dt>
            <dd className="flex min-w-0 flex-wrap items-center gap-2 truncate font-mono text-[13px]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
