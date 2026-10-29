import { ArrowRight, CircleCheck, FileWarning, Globe, HeartPulse, KeyRound, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SiteIcon } from "@/components/item-icons";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ToneBadge } from "@/components/report-badges";
import { StatusBadge, timeAgo } from "@/components/site-status";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { attentionReasons, loadFleet, siteLoginAttention, type AttentionReason, type FleetSite } from "@/lib/fleet";
import { integrityProblems, pendingUpdates } from "@/lib/report";
import { cn } from "@/lib/utils";
import { worstRating } from "@/lib/vulnerabilities";

export const metadata = { title: "Dashboard · SiteHerd" };

// Placeholder tiles while the data loads (one row of six on wide screens).
const SKELETON_TILES = [0, 1, 2, 3, 4, 5];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Fleet overview"
        description="Everything across your WordPress sites at a glance."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/updates/plugins" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <RefreshCw />
              Bulk update
            </Link>
            <Link href="/sites/new" className={buttonVariants({ size: "lg" })}>
              <Plus />
              Add site
            </Link>
          </div>
        }
      />
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

type Tone = "good" | "warn" | "bad" | "neutral";

const toneStyles: Record<Tone, { well: string; dot: string }> = {
  good: { well: "bg-good-soft text-good", dot: "bg-good" },
  warn: { well: "bg-warn-soft text-warn", dot: "bg-warn" },
  bad: { well: "bg-bad-soft text-bad", dot: "bg-bad" },
  neutral: { well: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
};

const cardClass = "rounded-[14px] bg-card text-card-foreground shadow-card ring-1 ring-border";
const sectionTitle = "font-display text-lg font-semibold tracking-tight";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Stat({
  label,
  value,
  href,
  hint,
  icon: Icon,
  tone,
  children,
}: {
  label: string;
  value: number;
  href: string;
  hint: React.ReactNode;
  icon: LucideIcon;
  tone: Tone;
  children?: React.ReactNode;
}) {
  const styles = toneStyles[tone];
  return (
    <Link
      href={href}
      className={cn(
        cardClass,
        "group flex min-w-0 flex-col gap-3 p-5 transition-all",
        "hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:hover:translate-y-0",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-[10px]", styles.well)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="font-display text-4xl font-semibold tracking-tight tabular-nums">{value}</div>
      {children}
      <div className="mt-auto flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className={cn("size-1.5 shrink-0 rounded-full", styles.dot)} />
        <span className="truncate">{hint}</span>
      </div>
    </Link>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">{children}</div>;
}

function OverviewSkeleton() {
  return (
    <div className="mt-8 grid gap-6">
      <Skeleton className="h-28 rounded-[14px]" />
      <StatGrid>
        {SKELETON_TILES.map((n) => (
          <div key={n} className="flex flex-col gap-3 rounded-[14px] p-5 ring-1 ring-border">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-8 rounded-[10px]" />
            </div>
            <Skeleton className="h-10 w-14" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </StatGrid>
      <Skeleton className="h-64 rounded-[14px]" />
    </div>
  );
}

type Attention = { site: FleetSite; reasons: AttentionReason[]; severity: "bad" | "warn" };

async function Overview() {
  const { now, sites } = await loadFleet();

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
  const sitesUnderAttack = sites.filter((s) => siteLoginAttention({ ...s, now })).length;
  const vulnerable = sites.reduce((n, s) => n + s.vulns.length, 0);
  const sitesWithVulns = sites.filter((s) => s.vulns.length > 0).length;

  // Worst first: sites with anything "bad" before update-only ones, then by number of reasons.
  const attention: Attention[] = sites
    .map((site) => {
      const reasons = attentionReasons(site);
      return { site, reasons, severity: reasons.some((r) => r.severity === "bad") ? ("bad" as const) : ("warn" as const) };
    })
    .filter((x) => x.reasons.length > 0)
    .sort((a, b) => (a.severity === b.severity ? b.reasons.length - a.reasons.length : a.severity === "bad" ? -1 : 1));

  const needAction = attention.filter((a) => a.severity === "bad").length;

  return (
    <div className="mt-8 grid gap-6">
      <FleetStatus
        total={sites.length}
        needAction={needAction}
        waiting={attention.length - needAction}
        healthy={sites.length - attention.length}
        reporting={reporting}
      />

      <StatGrid>
        <Stat
          label="Sites"
          value={sites.length}
          href="/sites"
          icon={Globe}
          tone={reporting === sites.length ? "good" : "warn"}
          hint={`${reporting} of ${sites.length} reporting`}
        >
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-good" style={{ width: `${(reporting / sites.length) * 100}%` }} />
          </div>
        </Stat>
        <Stat
          label="Pending updates"
          value={updates}
          href="/updates/plugins"
          icon={RefreshCw}
          tone={updates > 0 ? "warn" : "good"}
          hint={sitesWithUpdates ? `On ${plural(sitesWithUpdates, "site")}` : "All up to date"}
        />
        <Stat
          label="Vulnerable"
          value={vulnerable}
          href="/security"
          icon={ShieldAlert}
          tone={vulnerable > 0 ? "bad" : "good"}
          hint={vulnerable ? `Plugins & themes on ${plural(sitesWithVulns, "site")}` : "No known vulnerabilities"}
        />
        <Stat
          label="Critical health"
          value={critical}
          href="/health"
          icon={HeartPulse}
          tone={critical > 0 ? "bad" : "good"}
          hint={critical ? "Needs fixing" : "None"}
        />
        <Stat
          label="Changed files"
          value={changedFiles}
          href="/security"
          icon={FileWarning}
          tone={changedFiles > 0 ? "bad" : "good"}
          hint={changedFiles ? "Check for tampering" : "Files match wordpress.org"}
        />
        <Stat
          label="Failed logins"
          value={failedLogins}
          href="/security/logins"
          icon={KeyRound}
          tone={sitesUnderAttack > 0 ? "warn" : "neutral"}
          hint={sitesUnderAttack ? `${plural(sitesUnderAttack, "site")} need attention` : "Last 24 h, all sites"}
        />
      </StatGrid>

      <div className="flex flex-wrap items-start gap-6">
        <AttentionList attention={attention} total={sites.length} />
        <div className="grid min-w-0 flex-[1_1_320px] gap-6">
          <VulnSeverity sites={sites} />
          <LastReports sites={sites} now={now} />
        </div>
      </div>
    </div>
  );
}

/** One bar split by how many sites need action, have updates waiting, or are healthy. */
function FleetStatus({
  total,
  needAction,
  waiting,
  healthy,
  reporting,
}: {
  total: number;
  needAction: number;
  waiting: number;
  healthy: number;
  reporting: number;
}) {
  const segments = [
    { n: needAction, label: "Need action", bar: "bg-bad" },
    { n: waiting, label: "Updates pending", bar: "bg-warn" },
    { n: healthy, label: "Healthy", bar: "bg-good" },
  ];
  return (
    <section className={cn(cardClass, "grid gap-4 px-6 py-5")} aria-label="Fleet status">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={sectionTitle}>Fleet status</h2>
        <span className="font-mono text-xs text-muted-foreground">Sites report every 5–15 min · stale after 30 min</span>
      </div>
      <div className="flex h-2.5 gap-1" role="img" aria-label={segments.map((s) => `${s.n} ${s.label.toLowerCase()}`).join(", ")}>
        {segments
          .filter((s) => s.n > 0)
          .map((s) => (
            <div key={s.label} className={cn("rounded-full", s.bar)} style={{ flex: s.n / total }} />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-2">
            <span className={cn("size-1.5 rounded-full", s.bar)} />
            <strong className="font-semibold text-foreground tabular-nums">{s.n}</strong>
            {s.label}
          </span>
        ))}
        <span className="flex items-center gap-2 sm:ml-auto">
          <span className={cn("size-1.5 rounded-full", reporting === total ? "bg-good" : "bg-warn")} />
          {reporting} of {total} reporting
        </span>
      </div>
    </section>
  );
}

function AttentionList({ attention, total }: { attention: Attention[]; total: number }) {
  return (
    <section className={cn(cardClass, "min-w-0 flex-[2_1_560px] overflow-hidden")} aria-label="Needs attention">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="grid gap-0.5">
          <h2 className={cn(sectionTitle, "flex items-center gap-2")}>
            Needs attention
            {attention.length > 0 && (
              <ToneBadge t={attention.some((a) => a.severity === "bad") ? "bad" : "warn"}>{attention.length}</ToneBadge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            {attention.length === 0
              ? "Every site is reporting, updated and healthy."
              : `${attention.length} of ${plural(total, "site")}, worst first`}
          </p>
        </div>
        <Link href="/sites" className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          View all sites
          <ArrowRight className="size-4" />
        </Link>
      </div>
      {attention.length === 0 ? (
        <div className="flex flex-col items-center gap-3 border-t py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-good-soft text-good">
            <CircleCheck className="size-6" />
          </span>
          <p className="font-medium">Nothing to do</p>
        </div>
      ) : (
        <ul>
          {attention.map(({ site, reasons, severity }) => (
            <li key={site.id} className="border-t">
              <Link
                href={`/sites/${site.id}`}
                className={cn(
                  "relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-5 py-3.5 transition-colors hover:bg-muted md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)]",
                  "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full",
                  severity === "bad" ? "before:bg-bad" : "before:bg-warn",
                )}
              >
                <SiteIcon icon={site.report?.site_icon ?? null} url={site.url} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{site.name}</span>
                    <StatusBadge state={site.state} />
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{site.url}</div>
                </div>
                <div className="col-span-2 flex flex-wrap gap-1.5 md:col-span-1 md:justify-end">
                  {reasons.map((reason) => (
                    <ToneBadge key={reason.text} t={reason.severity}>
                      {reason.text}
                    </ToneBadge>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const RATINGS = [
  { key: "critical", label: "Critical", t: "bad" as const, bar: "bg-bad" },
  { key: "high", label: "High", t: "bad" as const, bar: "bg-bad/70" },
  { key: "medium", label: "Medium", t: "warn" as const, bar: "bg-warn" },
  { key: "low", label: "Low", t: "muted" as const, bar: "bg-muted-foreground/50" },
];

/** Vulnerable items across the fleet, counted by their worst rating. */
function VulnSeverity({ sites }: { sites: FleetSite[] }) {
  const items = sites.flatMap((s) => s.vulns);
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = worstRating(item)?.toLowerCase() ?? "unrated";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  // Critical shows only when there is one; the other rows always show for a stable shape.
  const rows = RATINGS.map((r) => ({ ...r, n: counts.get(r.key) ?? 0 })).filter((r) => r.n > 0 || r.key !== "critical");
  const max = Math.max(1, ...rows.map((r) => r.n));
  const fixable = items.filter((i) => i.vulns.some((v) => v.fixedIn)).length;

  return (
    <section className={cn(cardClass, "grid gap-4 px-5 py-4")} aria-label="Vulnerabilities by severity">
      <div className="flex items-center justify-between gap-3">
        <h2 className={sectionTitle}>Vulnerabilities</h2>
        <Link href="/security" className="text-[13px] font-medium text-primary hover:text-foreground">
          Open report →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No known vulnerabilities in installed plugins, themes or core.</p>
      ) : (
        <>
          <div className="grid gap-3">
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-[72px_minmax(0,1fr)_24px] items-center gap-3">
                <ToneBadge t={r.t}>{r.label}</ToneBadge>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", r.bar)} style={{ width: `${(r.n / max) * 100}%` }} />
                </div>
                <span className="text-right font-semibold tabular-nums">{r.n}</span>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground">
            Matched against Wordfence Intelligence. {fixable} of {items.length} have a fixed version available.
          </p>
        </>
      )}
    </section>
  );
}

/** When each site last reported, oldest first, so a silent site stands out. */
function LastReports({ sites, now }: { sites: FleetSite[]; now: number }) {
  const sorted = [...sites].sort((a, b) => (a.lastReportAt?.getTime() ?? 0) - (b.lastReportAt?.getTime() ?? 0));
  return (
    <section className={cn(cardClass, "overflow-hidden")} aria-label="Last reports">
      <div className="px-5 py-4">
        <h2 className={sectionTitle}>Last reports</h2>
      </div>
      <ul>
        {sorted.slice(0, 6).map((site) => (
          <li key={site.id} className="flex items-center justify-between gap-3 border-t px-5 py-3">
            <Link href={`/sites/${site.id}`} className="min-w-0 truncate font-medium hover:text-primary">
              {site.name}
            </Link>
            <span className={cn("shrink-0 font-mono text-xs", site.state === "stale" ? "text-bad" : "text-muted-foreground")}>
              {site.lastReportAt ? timeAgo(site.lastReportAt, now) : "Never"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
