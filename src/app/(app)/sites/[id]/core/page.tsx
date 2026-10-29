import { CheckCircle2, CircleArrowUp, FileCheck2, FileWarning, MinusCircle } from "lucide-react";
import { ExcludeToggle } from "@/components/exclude-toggle";
import { JobQueue } from "@/components/job-queue";
import { ToneBadge } from "@/components/report-badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Report } from "@/lib/report";
import type { SiteData } from "@/lib/site";
import { cn } from "@/lib/utils";
import { itemJobStates, itemKey } from "@/lib/update-types";
import { isPending, itemHistory, loadJobs, toClientJob } from "@/lib/updates";
import { HistoryMenu } from "../item-history";
import { CoreIntegrity, EnvironmentTable, SectionTitle, WithSite } from "../sections";
import { UpdateButton } from "../update-button";

export const metadata = { title: "Core · WP Siteherd" };

export default function SiteCorePage({ params }: PageProps<"/sites/[id]/core">) {
  return (
    <>
      <SectionTitle title="Core" description="WordPress version and updates, server environment and core file check." />
      <WithSite params={params} needsReport>
        {(data) => <Core data={data} />}
      </WithSite>
    </>
  );
}

const CORE = { type: "core" as const, id: "core" };

async function Core({ data }: { data: SiteData & { report: Report } }) {
  const { report, now, site, excluded } = data;
  const jobs = (await loadJobs([site.id], 50)).get(site.id) ?? [];
  const unfinished = jobs.filter(isPending);
  const key = itemKey(CORE);
  const state = itemJobStates(unfinished)[key] ?? null;
  const history = itemHistory(jobs, now).get(key) ?? [];
  const coreExcluded = excluded.has(key);
  const offer = report.core_update;
  const tone = coreExcluded ? "muted" : offer ? "warn" : "good";
  const StatusIcon = coreExcluded ? MinusCircle : offer ? CircleArrowUp : CheckCircle2;
  const files = report.integrity?.core.status ?? null;

  return (
    <div className="grid gap-6">
      {unfinished.length > 0 && <JobQueue siteId={site.id} jobs={unfinished.map((j) => toClientJob(j, now))} />}
      <Card className="relative">
        <span
          aria-hidden="true"
          className={cn("absolute inset-y-0 left-0 w-1", tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : "bg-muted-foreground/40")}
        />
        <CardHeader className="flex flex-row items-start gap-4">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-[10px]",
              tone === "good" ? "bg-good-soft text-good" : tone === "warn" ? "bg-warn-soft text-warn" : "bg-muted text-muted-foreground",
            )}
          >
            <StatusIcon className="size-5" />
          </span>
          <div className="grid min-w-0 gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            WordPress <span className="font-mono font-medium">{report.wp_version}</span>
            {offer && !coreExcluded && <ToneBadge t="warn">{offer} available</ToneBadge>}
            {coreExcluded && <ToneBadge t="muted">Updates excluded</ToneBadge>}
          </CardTitle>
          <CardDescription>
            {coreExcluded
              ? `Excluded: WordPress core won't be updated from the dashboard${offer ? ` (${offer} is available)` : ""} and its updates don't count as pending.`
              : offer
                ? "Plugins and themes in the same run are updated first. Core updates can't be rolled back automatically."
                : "This is the latest version."}
          </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <HistoryMenu siteId={site.id} entries={history} />
            <ExcludeToggle siteId={site.id} item={{ ...CORE, name: "WordPress core" }} excluded={coreExcluded} disabled={!!state} />
          </div>
          {offer && !coreExcluded && (
            <UpdateButton siteId={site.id} item={{ ...CORE, name: "WordPress", from: report.wp_version, to: offer }} state={state}>
              Update to {offer}
            </UpdateButton>
          )}
        </CardContent>
      </Card>
      <EnvironmentTable report={report} />
      <Card className="relative">
        {files === "issues" && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-bad" />}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {files === "issues" ? <FileWarning className="size-4 text-bad" /> : <FileCheck2 className="size-4 text-muted-foreground" />}
            Core files
          </CardTitle>
          <CardDescription>wp-admin, wp-includes and root files compared with the official wordpress.org checksums.</CardDescription>
        </CardHeader>
        <CardContent>
          <CoreIntegrity integrity={report.integrity} now={now} />
        </CardContent>
      </Card>
    </div>
  );
}
