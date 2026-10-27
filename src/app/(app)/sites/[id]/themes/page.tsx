import { JobQueue } from "@/components/job-queue";
import type { Report } from "@/lib/report";
import { rollbackTarget } from "@/lib/rollback";
import type { SiteData } from "@/lib/site";
import { itemJobStates, itemKey } from "@/lib/update-types";
import { isPending, itemHistory, loadJobs, toClientJob } from "@/lib/updates";
import { ItemList, type ItemRow } from "../item-list";
import { SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Themes · WP Siteherd" };

export default function SiteThemesPage({ params }: PageProps<"/sites/[id]/themes">) {
  return (
    <WithSite params={params} needsReport>
      {(data) => <Themes data={data} />}
    </WithSite>
  );
}

async function Themes({ data }: { data: SiteData & { report: Report } }) {
  const { report, site, now } = data;
  const jobs = (await loadJobs([site.id], 50)).get(site.id) ?? [];
  const unfinished = jobs.filter(isPending);
  const history = itemHistory(jobs, now);

  const rows: ItemRow[] = report.themes
    .map((t) => {
      const key = itemKey({ type: "theme", id: t.stylesheet });
      const entries = history.get(key) ?? [];
      return {
        id: t.stylesheet,
        name: t.name || t.stylesheet,
        version: t.version,
        active: t.active,
        update: t.update,
        excluded: data.excluded.has(key),
        // Theme files aren't checked against wordpress.org, so there's no edited state or known slug.
        edited: null,
        slug: null,
        history: entries,
        rollback: rollbackTarget(report, { type: "theme", id: t.stylesheet }, t.version, entries),
      };
    })
    // The active theme first, then by name.
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  return (
    <>
      <SectionTitle title="Themes" />
      {unfinished.length > 0 && (
        <div className="mb-6">
          <JobQueue siteId={site.id} jobs={unfinished.map((j) => toClientJob(j, now))} />
        </div>
      )}
      <ItemList siteId={site.id} type="theme" rows={rows} jobStates={itemJobStates(unfinished)} />
    </>
  );
}
