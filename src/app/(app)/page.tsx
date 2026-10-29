import { ArrowRight, CircleCheck, FileWarning, Globe, HeartPulse, KeyRound, Plus, RefreshCw, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SiteIcon } from "@/components/item-icons";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ToneBadge } from "@/components/report-badges";
import { StatusBadge } from "@/components/site-status";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { attentionReasons, loadFleet, siteLoginAttention } from "@/lib/fleet";
import { integrityProblems, pendingUpdates } from "@/lib/report";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard · WP Siteherd" };

// Placeholder cards while the data loads (two rows of three on wide screens).
const SKELETON_CARDS = [0, 1, 2, 3, 4, 5];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything across your WordPress sites at a glance."
        action={
          <Link href="/sites/new" className={buttonVariants()}>
            <Plus />
            Add site
          </Link>
        }
      />
      <Suspense fallback={<OverviewSkeleton />}>
        <Overview />
      </Suspense>
    </>
  );
}

type Tone = "good" | "warn" | "bad" | "neutral";

const toneStyles: Record<Tone, { chip: string; dot: string }> = {
  good: {
    chip: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    dot: "bg-green-500",
  },
  warn: {
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  bad: {
    chip: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    dot: "bg-red-500",
  },
  neutral: { chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
};

function Stat({
  label,
  value,
  href,
  hint,
  icon: Icon,
  tone,
  className,
  children,
}: {
  label: string;
  value: number;
  href: string;
  hint: React.ReactNode;
  icon: LucideIcon;
  tone: Tone;
  className?: string;
  children?: React.ReactNode;
}) {
  const styles = toneStyles[tone];
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-5 rounded-2xl bg-card p-6 text-card-foreground ring-1 ring-foreground/10 transition-all",
        "hover:-translate-y-0.5 hover:shadow-lg hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", styles.chip)}>
          <Icon className="size-5" />
        </span>
      </div>
      <div className="text-4xl font-semibold tracking-tight tabular-nums md:text-5xl">{value}</div>
      {children}
      <div className="mt-auto flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", styles.dot)} />
          {hint}
        </span>
        <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
    </Link>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function OverviewSkeleton() {
  return (
    <div className="mt-6 grid gap-6">
      <StatGrid>
        {SKELETON_CARDS.map((n) => (
          <div key={n} className="flex flex-col gap-5 rounded-2xl p-6 ring-1 ring-foreground/10">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-10 rounded-xl" />
            </div>
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </StatGrid>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

async function Overview() {
  const { sites, now } = await loadFleet();

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

  const attention = sites
    .map((site) => ({ site, reasons: attentionReasons(site) }))
    .filter((x) => x.reasons.length > 0);

  return (
    <div className="mt-6 grid gap-6">
      <StatGrid>
        <Stat
          label="Sites"
          value={sites.length}
          href="/sites"
          icon={Globe}
          tone={reporting === sites.length ? "good" : "warn"}
          hint={`${reporting} of ${sites.length} reporting`}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-green-500" style={{ width: `${(reporting / sites.length) * 100}%` }} />
          </div>
        </Stat>
        <Stat
          label="Pending updates"
          value={updates}
          href="/updates/plugins"
          icon={RefreshCw}
          tone={updates > 0 ? "warn" : "good"}
          hint={sitesWithUpdates ? `On ${sitesWithUpdates} ${sitesWithUpdates === 1 ? "site" : "sites"}` : "All up to date"}
        />
        <Stat
          label="Vulnerable plugins & themes"
          value={vulnerable}
          href="/security"
          icon={ShieldAlert}
          tone={vulnerable > 0 ? "bad" : "good"}
          hint={vulnerable ? `On ${sitesWithVulns} ${sitesWithVulns === 1 ? "site" : "sites"}` : "No known vulnerabilities"}
        />
        <Stat
          label="Critical health issues"
          value={critical}
          href="/health"
          icon={HeartPulse}
          tone={critical > 0 ? "bad" : "good"}
          hint={critical ? "Needs fixing" : "None"}
        />
        <Stat
          label="Sites with changed files"
          value={changedFiles}
          href="/security"
          icon={FileWarning}
          tone={changedFiles > 0 ? "bad" : "good"}
          hint={changedFiles ? "Check for tampering" : "Files match wordpress.org"}
        />
        <Stat
          label="Failed logins (24 h)"
          value={failedLogins}
          href="/security/logins"
          icon={KeyRound}
          tone={sitesUnderAttack > 0 ? "warn" : "neutral"}
          hint={sitesUnderAttack ? `${sitesUnderAttack} ${sitesUnderAttack === 1 ? "site needs" : "sites need"} attention` : "Across all sites"}
        />
      </StatGrid>

      <Card className="gap-0 rounded-2xl py-0">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              Needs attention
              {attention.length > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                    attention.some((a) => a.reasons.some((r) => r.severity === "bad"))
                      ? toneStyles.bad.chip
                      : toneStyles.warn.chip,
                  )}
                >
                  {attention.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {attention.length === 0
                ? "Every site is reporting, updated and healthy."
                : `${attention.length} of ${sites.length} ${sites.length === 1 ? "site" : "sites"}`}
            </CardDescription>
          </div>
          <Link
            href="/sites"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View all sites
            <ArrowRight className="size-4" />
          </Link>
        </CardHeader>
        <CardContent className="p-2">
          {attention.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300">
                <CircleCheck className="size-6" />
              </span>
              <p className="font-medium">Nothing to do</p>
            </div>
          ) : (
            <ul className="grid gap-1">
              {attention.map(({ site, reasons }) => (
                <li key={site.id}>
                  <Link
                    href={`/sites/${site.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SiteIcon icon={site.report?.site_icon ?? null} url={site.url} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{site.name}</span>
                          <StatusBadge state={site.state} />
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{site.url}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
        </CardContent>
      </Card>
    </div>
  );
}
