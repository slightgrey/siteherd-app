import { ChevronRight, HeartPulse, PlugZap, RefreshCw, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/page-header";
import { ToneBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { JobItems, JobStatusBadge, jobTitle } from "@/components/update-status";
import { Card, CardContent } from "@/components/ui/card";
import { loadActivity, type ActivityEntry } from "@/lib/activity";
import type { SiteData } from "@/lib/site";
import { toClientJob } from "@/lib/updates";
import { cn } from "@/lib/utils";
import { SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Activity log · WP Siteherd" };

const PER_PAGE = 20;

export default function SiteActivityPage({ params, searchParams }: PageProps<"/sites/[id]/activity">) {
  return (
    <>
      <SectionTitle title="Activity log" description="What happened on this site: updates, daily checks and connection events." />
      <WithSite params={params}>{(data) => <Activity data={data} searchParams={searchParams} />}</WithSite>
    </>
  );
}

const exact = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

async function Activity({
  data,
  searchParams,
}: {
  data: SiteData;
  searchParams: PageProps<"/sites/[id]/activity">["searchParams"];
}) {
  const all = await loadActivity(data.site);
  if (all.length === 0) return <EmptyState title="Nothing yet">Activity appears once the site starts reporting.</EmptyState>;

  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const requested = Number((await searchParams).page);
  const page = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), pages) : 1;
  const entries = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const href = (p: number) => `/sites/${data.site.id}/activity${p > 1 ? `?page=${p}` : ""}`;

  return (
    <Card>
      <CardContent className="grid gap-6">
        <ol className="relative">
          {entries.map((entry, i) => (
            <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Timeline rail */}
              {i < entries.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px bg-border" aria-hidden />}
              <EntryIcon entry={entry} />
              <div className="min-w-0 flex-1 pt-1">
                <EntryBody entry={entry} now={data.now} />
                <p className="mt-1 text-xs text-muted-foreground" title={exact.format(entry.at)}>
                  {timeAgo(entry.at, data.now)} · {exact.format(entry.at)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {pages > 1 && (
          <nav aria-label="Activity pages" className="flex items-center justify-between border-t pt-4 text-sm">
            {page > 1 ? (
              <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                ← Newer
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, all.length)} of {all.length}
            </span>
            {page < pages ? (
              <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Older →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </CardContent>
    </Card>
  );
}

function EntryIcon({ entry }: { entry: ActivityEntry }) {
  const tone =
    entry.kind === "update"
      ? entry.job.status === "failed" || entry.job.results.some((r) => r.status === "failed" || r.status === "rolled_back")
        ? "bg-warn-soft text-warn"
        : "bg-good-soft text-good"
      : entry.kind === "checks"
        ? (entry.health?.critical ?? 0) > 0 || (entry.files?.problems ?? 0) > 0
          ? "bg-bad-soft text-bad"
          : "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
        : entry.kind === "admin" && entry.added
          ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
          : "bg-muted text-muted-foreground";
  const Icon =
    entry.kind === "update"
      ? RefreshCw
      : entry.kind === "checks"
        ? HeartPulse
        : entry.kind === "admin"
          ? entry.added
            ? UserPlus
            : UserMinus
          : PlugZap;
  return (
    <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}>
      <Icon className="size-4" />
    </span>
  );
}

function EntryBody({ entry, now }: { entry: ActivityEntry; now: number }) {
  if (entry.kind === "update") {
    const job = toClientJob(entry.job, now);
    const n = job.items.length;
    return (
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {jobTitle(job)}
          </span>
          <JobStatusBadge job={job} />
        </div>
        {job.error && <p className="text-sm text-bad">{job.error}</p>}
        {job.note && <p className="text-xs text-muted-foreground">{job.note}</p>}
        {n > 3 ? (
          // Big runs start collapsed so the timeline stays scannable.
          <details className="group rounded-md border">
            <summary className="flex cursor-pointer list-none items-center gap-1 px-3 py-2 text-sm text-muted-foreground">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
              Show {n} items
            </summary>
            <div className="border-t px-3 py-2">
              <JobItems job={job} />
            </div>
          </details>
        ) : (
          <div className="rounded-md border px-3 py-2">
            <JobItems job={job} />
          </div>
        )}
      </div>
    );
  }

  if (entry.kind === "checks") {
    const { health, files } = entry;
    return (
      <div className="grid gap-1.5">
        <span className="font-medium">Daily checks ran</span>
        <div className="flex flex-wrap gap-1.5">
          {health &&
            (health.critical > 0 ? (
              <ToneBadge t="bad">{health.critical} critical</ToneBadge>
            ) : health.recommended > 0 ? (
              <ToneBadge t="warn">Site Health: {health.recommended} to improve</ToneBadge>
            ) : (
              <ToneBadge t="good">Site Health good</ToneBadge>
            ))}
          {files &&
            (files.problems > 0 ? (
              <ToneBadge t="bad">
                {files.problems} file {files.problems === 1 ? "problem" : "problems"}
              </ToneBadge>
            ) : files.error ? (
              <ToneBadge t="warn">Files couldn&apos;t be verified</ToneBadge>
            ) : (
              <ToneBadge t="good">Files OK</ToneBadge>
            ))}
        </div>
      </div>
    );
  }

  if (entry.kind === "admin") {
    return (
      <span>
        <span className="font-medium">{entry.added ? "New administrator" : "Administrator removed"}:</span> {entry.name || entry.login}{" "}
        <span className="text-muted-foreground">({entry.login})</span>
      </span>
    );
  }

  return <span className="font-medium">{entry.title}</span>;
}
