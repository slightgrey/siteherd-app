import { JobQueue } from "@/components/job-queue";
import { editedPlugins, type Report } from "@/lib/report";
import { rollbackTarget } from "@/lib/rollback";
import type { SiteData } from "@/lib/site";
import { itemJobStates, itemKey } from "@/lib/update-types";
import { isPending, itemHistory, loadJobs, toClientJob } from "@/lib/updates";
import { ItemList, type ItemRow } from "../item-list";
import { SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Plugins · WP Siteherd" };

export default function SitePluginsPage({ params }: PageProps<"/sites/[id]/plugins">) {
  return (
    <WithSite params={params} needsReport>
      {(data) => <Plugins data={data} />}
    </WithSite>
  );
}

async function Plugins({ data }: { data: SiteData & { report: Report } }) {
  const { report, site, now } = data;
  const jobs = (await loadJobs([site.id], 50)).get(site.id) ?? [];
  const unfinished = jobs.filter(isPending);
  const history = itemHistory(jobs, now);
  const edited = editedPlugins(report);
  const integrity = new Map(report.integrity?.plugins.map((p) => [p.file, p.status]) ?? []);

  const rows: ItemRow[] = report.plugins
    .map((p) => {
      const key = itemKey({ type: "plugin", id: p.file });
      const entries = history.get(key) ?? [];
      const status = integrity.get(p.file);
      const changed = edited.get(p.file);
      return {
        id: p.file,
        name: p.name || p.file,
        version: p.version,
        active: p.active,
        update: p.update,
        excluded: data.excluded.has(key),
        edited: changed ? changed.modified_count + changed.missing_count : null,
        // The file check found checksums on wordpress.org, so the folder name is its slug there.
        slug: (status === "ok" || status === "issues") && p.file.includes("/") ? p.file.split("/")[0] : null,
        history: entries,
        rollback: rollbackTarget(report, { type: "plugin", id: p.file }, p.version, entries),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <SectionTitle title="Plugins" />
      {unfinished.length > 0 && (
        <div className="mb-6">
          <JobQueue siteId={site.id} jobs={unfinished.map((j) => toClientJob(j, now))} />
        </div>
      )}
      <ItemList siteId={site.id} type="plugin" rows={rows} jobStates={itemJobStates(unfinished)} />
    </>
  );
}
