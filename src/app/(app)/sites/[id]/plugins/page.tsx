import { JobQueue } from "@/components/job-queue";
import { editedPlugins, type Report } from "@/lib/report";
import { rollbackTarget } from "@/lib/rollback";
import type { SiteData } from "@/lib/site";
import { itemJobStates, itemKey } from "@/lib/update-types";
import { SELF_SLUG, isPending, itemHistory, loadJobs, toClientJob } from "@/lib/updates";
import { slugOf } from "@/lib/vulnerabilities";
import { AddPluginSheet } from "../add-plugin-sheet";
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
  // Older plugins ignore the install/delete/activate/deactivate actions (schema 6 = plugin 0.7.0).
  const canManage = report.schema >= 6;
  const integrity = new Map(report.integrity?.plugins.map((p) => [p.file, p.status]) ?? []);

  const vulns = new Map(data.vulns.map((v) => [itemKey(v), v.vulns]));
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
        vulns: vulns.get(key) ?? [],
        isSelf: slugOf(p.file) === SELF_SLUG,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle title="Plugins" />
        {canManage && <AddPluginSheet siteId={site.id} installed={report.plugins.map((p) => slugOf(p.file))} />}
      </div>
      {unfinished.length > 0 && (
        <div className="mb-6">
          <JobQueue siteId={site.id} jobs={unfinished.map((j) => toClientJob(j, now))} />
        </div>
      )}
      {!canManage && (
        <p className="mb-4 rounded-[10px] bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
          Update WP Siteherd on this site to 0.7.0 or later to install, activate, deactivate and delete plugins from here.
        </p>
      )}
      <ItemList siteId={site.id} type="plugin" rows={rows} jobStates={itemJobStates(unfinished)} canManage={canManage} />
    </>
  );
}
