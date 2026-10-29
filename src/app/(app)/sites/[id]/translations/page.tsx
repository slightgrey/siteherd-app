import { CheckCircle2 } from "lucide-react";
import { JobQueue } from "@/components/job-queue";
import { EmptyState } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { translationOwner, type Report } from "@/lib/report";
import type { SiteData } from "@/lib/site";
import { itemJobStates, itemKey } from "@/lib/update-types";
import { isPending, itemHistory, loadJobs, toClientJob } from "@/lib/updates";
import { HistoryMenu } from "../item-history";
import { SectionTitle, WithSite } from "../sections";
import { UpdateButton } from "../update-button";

export const metadata = { title: "Translations · WP Siteherd" };

export default function SiteTranslationsPage({ params }: PageProps<"/sites/[id]/translations">) {
  return (
    <>
      <SectionTitle title="Translations" description="Language pack updates for WordPress, plugins and themes." />
      <WithSite params={params} needsReport>
        {(data) => <Translations data={data} />}
      </WithSite>
    </>
  );
}

const TRANSLATIONS = { type: "translations" as const, id: "translations" };
const typeLabel = { core: "Core", plugin: "Plugin", theme: "Theme" } as const;

async function Translations({ data }: { data: SiteData & { report: Report } }) {
  const { report, now, site } = data;
  // Translation updates are reported from WP Siteherd 0.6.0 (report schema 5).
  if (report.schema < 5) {
    return (
      <EmptyState title="Not reported yet">
        Update the WP Siteherd plugin on this site to 0.6.0 or later to see and install translation updates.
      </EmptyState>
    );
  }

  const jobs = (await loadJobs([site.id], 50)).get(site.id) ?? [];
  const unfinished = jobs.filter(isPending);
  const key = itemKey(TRANSLATIONS);
  const state = itemJobStates(unfinished)[key] ?? null;
  const history = itemHistory(jobs, now).get(key) ?? [];
  const packs = [...report.translations].sort(
    (a, b) => a.type.localeCompare(b.type) || translationOwner(report, a).localeCompare(translationOwner(report, b)),
  );

  return (
    <div className="grid gap-6">
      {unfinished.length > 0 && <JobQueue siteId={site.id} jobs={unfinished.map((j) => toClientJob(j, now))} />}
      <Card>
        <CardHeader>
          <CardTitle>{packs.length === 0 ? "Translations are up to date" : `${packs.length} translation ${packs.length === 1 ? "update" : "updates"}`}</CardTitle>
          <CardDescription>
            Site language: <span className="font-mono">{report.locale || "unknown"}</span>. WordPress updates all language packs at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {packs.length === 0 && (
                <span className="flex items-center gap-1.5 text-sm text-good">
                  <CheckCircle2 className="size-4" />
                  Nothing to update.
                </span>
              )}
              <HistoryMenu siteId={site.id} entries={history} />
            </div>
            {packs.length > 0 && (
              <UpdateButton siteId={site.id} item={{ ...TRANSLATIONS, name: "Translations", from: "", to: "" }} state={state}>
                Update translations ({packs.length})
              </UpdateButton>
            )}
          </div>
          {packs.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">For</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="pr-4">Released</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packs.map((t) => (
                    <TableRow key={`${t.type}:${t.slug}:${t.language}`}>
                      <TableCell className="pl-4 font-medium">{translationOwner(report, t)}</TableCell>
                      <TableCell className="text-muted-foreground">{typeLabel[t.type]}</TableCell>
                      <TableCell className="font-mono text-xs">{t.language}</TableCell>
                      <TableCell className="font-mono text-xs">{t.version || "—"}</TableCell>
                      {/* WordPress sends e.g. "2026-09-30 08:12:45"; the date is enough. */}
                      <TableCell className="pr-4 font-mono text-xs text-muted-foreground">{t.updated.slice(0, 10) || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
