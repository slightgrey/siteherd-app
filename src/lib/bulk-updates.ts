import { loadFleet } from "@/lib/fleet";
import { editedPlugins, siteIconUrl } from "@/lib/report";
import { itemJobStates, itemKey, type ItemJobState, type UpdateType } from "@/lib/update-types";
import { awaitingReport, isPending, loadJobs, pendingItems } from "@/lib/updates";

/** One site where an item has an update. */
export type BulkSite = {
  siteId: string;
  siteName: string;
  siteUrl: string;
  siteIcon: string | null;
  from: string;
  to: string;
  /** Translations: what's pending, e.g. "3 language packs". */
  detail: string | null;
  /** Number of files edited on the site (plugins), so updating needs confirmation. */
  edited: number | null;
  /** Excluded from dashboard updates on this site; shown but never updated. */
  excluded: boolean;
  /** Running or queued on the site right now. */
  job: ItemJobState | null;
};

/** One plugin/theme (or WordPress, or translations) with every site it can be updated on. */
export type BulkItem = {
  key: string;
  type: UpdateType;
  id: string;
  name: string;
  /** wordpress.org plugin slug (for the icon and changelog), when a site's file check confirmed it. */
  slug: string | null;
  sites: BulkSite[];
};

/**
 * Pending updates of one kind across all the user's sites, grouped by item.
 * Excluded items are included (flagged) so the page can say where they're skipped.
 * Calls loadFleet(), so render behind <Suspense>.
 */
export async function loadBulkItems(type: UpdateType): Promise<{ items: BulkItem[]; active: boolean }> {
  const { sites, now } = await loadFleet();
  const jobs = await loadJobs(sites.map((s) => s.id), 1);
  const groups = new Map<string, BulkItem>();
  let active = false;

  for (const site of sites) {
    const report = site.report;
    if (!report) continue;
    const siteJobs = jobs.get(site.id) ?? [];
    const unfinished = siteJobs.filter(isPending);
    // Keep refreshing until the report sent after a finished job arrives, so done updates drop off the list.
    if (unfinished.length > 0 || awaitingReport(siteJobs, site.lastReportAt, now)) active = true;
    const states = itemJobStates(unfinished);
    const edited = editedPlugins(report);
    const integrity = new Map(report.integrity?.plugins.map((p) => [p.file, p.status]) ?? []);

    for (const item of pendingItems(report)) {
      if (item.type !== type) continue;
      const key = itemKey(item);
      const group = groups.get(key) ?? { key, type, id: item.id, name: item.name, slug: null, sites: [] };
      const status = integrity.get(item.id);
      if (!group.slug && type === "plugin" && (status === "ok" || status === "issues") && item.id.includes("/")) {
        group.slug = item.id.split("/")[0];
      }
      const changed = type === "plugin" ? edited.get(item.id) : undefined;
      const packs = report.translations.length;
      group.sites.push({
        siteId: site.id,
        siteName: site.name,
        siteUrl: site.url,
        siteIcon: siteIconUrl(report),
        from: item.from,
        to: item.to,
        detail: type === "translations" ? `${packs} language ${packs === 1 ? "pack" : "packs"}` : null,
        edited: changed ? changed.modified_count + changed.missing_count : null,
        excluded: site.excluded.has(key),
        job: states[key] ?? null,
      });
      groups.set(key, group);
    }
  }

  const updatable = (i: BulkItem) => i.sites.filter((s) => !s.excluded).length;
  const items = [...groups.values()]
    // Items excluded on every site they're on have nothing to do here.
    .filter((i) => updatable(i) > 0)
    .map((i) => ({ ...i, sites: i.sites.sort((a, b) => a.siteName.localeCompare(b.siteName)) }))
    .sort((a, b) => updatable(b) - updatable(a) || a.name.localeCompare(b.name));
  return { items, active };
}
