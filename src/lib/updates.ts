import { and, asc, desc, eq, inArray, lt, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { timeAgo } from "@/components/site-status";
import type { ClientJob } from "@/components/update-status";
import { db } from "@/db";
import { loadExclusions } from "@/lib/exclusions";
import { rollbackTarget } from "@/lib/rollback";
import { reports, sites, updateJobs, type UpdateJob } from "@/db/schema";
import { editedPlugins, parseReport, pendingUpdates, type Report } from "@/lib/report";
import { callSite } from "@/lib/site-client";
import { slugOf } from "@/lib/vulnerabilities";
import {
  ACTIVE_JOB_STATUSES,
  PENDING_JOB_STATUSES,
  itemJobStates,
  itemKey,
  type PluginAction,
  type UpdateItem,
  type UpdateResult,
  type UpdateType,
} from "@/lib/update-types";

// A queued job the site never picked up, or a running one that went silent.
const QUEUED_TIMEOUT_MS = 10 * 60 * 1000;
const RUNNING_TIMEOUT_MS = 30 * 60 * 1000;

/** Everything the latest report says can be updated, as job items (minus excluded ones). */
export function pendingItems(report: Report, excluded: ReadonlySet<string> = new Set()): UpdateItem[] {
  const u = pendingUpdates(report, excluded);
  return [
    ...(u.core ? [{ type: "core" as const, id: "core", name: "WordPress", from: report.wp_version, to: u.core }] : []),
    ...u.plugins.map((p) => ({ type: "plugin" as const, id: p.file, name: p.name || p.file, from: p.version, to: p.update! })),
    ...u.themes.map((t) => ({ type: "theme" as const, id: t.stylesheet, name: t.name || t.stylesheet, from: t.version, to: t.update! })),
    // One item for every pending language pack; there are no versions to show.
    ...(u.translations > 0 ? [{ type: "translations" as const, id: "translations", name: "Translations", from: "", to: "" }] : []),
  ];
}

/** Mark jobs the site stopped reporting on as failed, so new ones can start. */
export async function expireStaleJobs(siteIds: string[]) {
  if (siteIds.length === 0) return;
  const now = Date.now();
  await db
    .update(updateJobs)
    .set({
      status: "failed",
      error: "The site stopped responding during the update. Check the site, then try again.",
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(updateJobs.siteId, siteIds),
        or(
          and(eq(updateJobs.status, "queued"), lt(updateJobs.updatedAt, new Date(now - QUEUED_TIMEOUT_MS))),
          and(eq(updateJobs.status, "running"), lt(updateJobs.updatedAt, new Date(now - RUNNING_TIMEOUT_MS))),
        ),
      ),
    );
}

/** Unfinished jobs (waiting, queued or running) on these sites. */
function loadPendingJobs(siteIds: string[]) {
  return db
    .select()
    .from(updateJobs)
    .where(and(inArray(updateJobs.siteId, siteIds), inArray(updateJobs.status, [...PENDING_JOB_STATUSES])));
}

/**
 * Recent jobs per site (newest first) plus every unfinished one. Expires stale
 * jobs first, and starts waiting ones on sites where nothing is active (after
 * an expiry, or if starting the next job was missed).
 */
export async function loadJobs(siteIds: string[], perSite = 5): Promise<Map<string, UpdateJob[]>> {
  const bySite = new Map<string, UpdateJob[]>(siteIds.map((id) => [id, []]));
  if (siteIds.length === 0) return bySite;
  await expireStaleJobs(siteIds);
  let pending = await loadPendingJobs(siteIds);
  const stalled = siteIds.filter(
    (id) => pending.some((j) => j.siteId === id && j.status === "waiting") && !pending.some((j) => j.siteId === id && j.status !== "waiting"),
  );
  if (stalled.length > 0) {
    await Promise.all(stalled.map(advanceQueue));
    pending = await loadPendingJobs(siteIds);
  }
  const recent = await db
    .select()
    .from(updateJobs)
    .where(inArray(updateJobs.siteId, siteIds))
    .orderBy(desc(updateJobs.createdAt))
    .limit(perSite * siteIds.length);

  const seen = new Set<string>();
  for (const job of [...pending, ...recent].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    const list = bySite.get(job.siteId)!;
    if (isPending(job) || list.length < perSite) list.push(job);
  }
  return bySite;
}

/** Serializable job for client components; dates formatted here so SSR and hydration agree. */
export function toClientJob(job: UpdateJob, now: number): ClientJob {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    items: job.items,
    results: job.results,
    error: job.error,
    note: job.note,
    when: timeAgo(job.createdAt, now),
  };
}

export type HistoryEntry = {
  kind: UpdateJob["kind"];
  status: UpdateResult["status"];
  from: string | null;
  to: string | null;
  message: string | null;
  when: string;
};

/**
 * Past update outcomes per item (key = itemKey), newest first, from finished
 * jobs. Skipped items are left out; they changed nothing.
 */
export function itemHistory(jobs: UpdateJob[], now: number): Map<string, HistoryEntry[]> {
  const history = new Map<string, HistoryEntry[]>();
  const finished = jobs
    .filter((j) => j.status === "completed" || j.status === "failed")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  for (const job of finished) {
    const when = timeAgo(job.finishedAt ?? job.updatedAt, now);
    for (const r of job.results) {
      if (r.status === "skipped") continue;
      const list = history.get(itemKey(r)) ?? [];
      list.push({ kind: job.kind, status: r.status, from: r.from, to: r.to, message: r.message, when });
      history.set(itemKey(r), list);
    }
  }
  return history;
}

export function isActive(job: UpdateJob | undefined | null): job is UpdateJob {
  return !!job && (ACTIVE_JOB_STATUSES as readonly string[]).includes(job.status);
}

// How long after a job finishes to wait for the site's fresh report.
const REPORT_WAIT_MS = 2 * 60 * 1000;

/**
 * True when a job finished recently but the site's report since then hasn't
 * arrived yet. The plugin sends that report right after its final progress
 * push, so until it lands, pages still list the old versions as pending and
 * should keep refreshing. Gives up after REPORT_WAIT_MS (e.g. a job that never
 * reached the site).
 */
export function awaitingReport(jobs: UpdateJob[], lastReportAt: Date | null, now: number) {
  return jobs.some(
    (j) => j.finishedAt && now - j.finishedAt.getTime() < REPORT_WAIT_MS && (!lastReportAt || lastReportAt < j.finishedAt),
  );
}

/** Not finished: active, or waiting in the queue. */
export function isPending(job: { status: string }) {
  return (PENDING_JOB_STATUSES as readonly string[]).includes(job.status);
}

/** `queued`: the job waits behind another one on the site and starts when that finishes. */
export type StartResult = { ok: true; jobId: string; queued: boolean } | { ok: false; error: string };

/** Item keys already in an unfinished job on the site, so they aren't queued twice. */
async function itemsInQueue(siteId: string) {
  return new Set(Object.keys(itemJobStates(await loadPendingJobs([siteId]))));
}

/**
 * Start an update job on one site the user owns. Only items the latest report
 * lists as pending are accepted; versions come from that report. Plugins with
 * edited files are left out unless the request confirms overwriting them.
 */
export async function startUpdate(
  userId: string,
  siteId: string,
  requested: { type: UpdateType; id: string; overwriteEdits?: boolean }[],
): Promise<StartResult> {
  const site = await db.query.sites.findFirst({
    where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
    with: { reports: { orderBy: [desc(reports.receivedAt)], limit: 1 } },
  });
  if (!site) return { ok: false, error: "Site not found." };
  const report = parseReport(site.reports[0]?.payload);
  if (!report) return { ok: false, error: "This site hasn't reported yet." };

  const excluded = (await loadExclusions([site.id])).get(site.id)!;
  const pending = new Map(pendingItems(report, excluded).map((i) => [itemKey(i), i]));
  const inQueue = await itemsInQueue(site.id);
  const keys = [...new Set(requested.map(itemKey))].filter((k) => !inQueue.has(k));
  if (keys.length === 0) return { ok: false, error: "Already updating or waiting in the queue." };
  const edited = editedPlugins(report);
  const confirmed = new Set(requested.filter((r) => r.overwriteEdits).map(itemKey));
  const unconfirmed = keys.flatMap((k) => {
    const item = pending.get(k);
    return item?.type === "plugin" && edited.has(item.id) && !confirmed.has(k) ? [item] : [];
  });
  const items = keys.flatMap((k) => (pending.has(k) && !unconfirmed.includes(pending.get(k)!) ? [pending.get(k)!] : []));
  if (items.length === 0) {
    return {
      ok: false,
      error:
        unconfirmed.length > 0
          ? `${unconfirmed[0].name} has edited files that the update would overwrite. Update it on its own and confirm.`
          : keys.some((k) => excluded.has(k))
            ? "That item is excluded from updates on this site. Include it again to update it."
            : "Nothing to update. The selected updates are no longer pending.",
    };
  }

  return enqueue(site, { siteId: site.id, userId, kind: "update", items });
}

/**
 * Roll a plugin or theme back to an earlier version on one site the user owns.
 * Only versions the site actually had are accepted: the copy the plugin saved,
 * or a version from this site's update history.
 */
export async function startRollback(
  userId: string,
  siteId: string,
  item: { type: "plugin" | "theme"; id: string },
  version: string,
): Promise<StartResult> {
  const site = await db.query.sites.findFirst({
    where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
    with: { reports: { orderBy: [desc(reports.receivedAt)], limit: 1 } },
  });
  if (!site) return { ok: false, error: "Site not found." };
  const report = parseReport(site.reports[0]?.payload);
  if (!report) return { ok: false, error: "This site hasn't reported yet." };
  // Older plugins ignore the rollback action and would run a normal update instead.
  if (report.schema < 4) return { ok: false, error: "Update the WP Siteherd plugin on this site to 0.5.0 or later to use rollback." };

  const installed =
    item.type === "plugin"
      ? report.plugins.find((p) => p.file === item.id)
      : report.themes.find((t) => t.stylesheet === item.id);
  if (!installed) return { ok: false, error: "That isn't installed on this site." };
  if ((await itemsInQueue(site.id)).has(itemKey(item))) {
    return { ok: false, error: "This is already updating or waiting in the queue." };
  }

  const jobs = (await loadJobs([site.id], 200)).get(site.id) ?? [];
  const history = itemHistory(jobs, Date.now()).get(itemKey(item));
  const target = rollbackTarget(report, item, installed.version, history);
  const knownVersions = new Set([
    ...(target ? [target.version] : []),
    ...(history ?? []).flatMap((h) => [h.from, h.to]).filter((v): v is string => !!v),
  ]);
  if (!knownVersions.has(version) || version === installed.version) {
    return { ok: false, error: `Version ${version} isn't available to roll back to.` };
  }

  // A rollback item's `to` is the version to go back to.
  const items: UpdateItem[] = [{ type: item.type, id: item.id, name: installed.name || item.id, from: installed.version, to: version }];
  return enqueue(site, { siteId: site.id, userId, kind: "rollback", items });
}

/** Folder of the WP Siteherd plugin itself, which can't be deactivated or deleted remotely. */
export const SELF_SLUG = "wp-siteherd";

/** Whether a finished job replaced WP Siteherd's own files. */
export function updatedSelf(results: Pick<UpdateResult, "type" | "id" | "status">[]) {
  return results.some((r) => r.type === "plugin" && slugOf(r.id) === SELF_SLUG && (r.status === "updated" || r.status === "rolled_back"));
}

// Long enough for the job's own final report to have been sent first, and past
// the plugin's once-a-minute limit on forced update checks (a Resync right
// before the update would otherwise make this one skip the check).
const SELF_UPDATE_RESYNC_DELAY_MS = 75_000;

/**
 * After WP Siteherd updates itself, the request that ran the update still has
 * the old plugin code loaded. Plugins before 0.7.2 then record "update
 * available" again and report the old version. A resync runs in a new request
 * on the new code and corrects both. Called via after(); errors are only logged.
 */
export async function resyncAfterSelfUpdate(siteId: string) {
  await new Promise((resolve) => setTimeout(resolve, SELF_UPDATE_RESYNC_DELAY_MS));
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site) return;
  try {
    const res = await callSite(site, "POST", "/sync", {}, 60_000);
    if (res.status !== 200) console.warn(`[self-update] resync of ${site.url} answered HTTP ${res.status}`);
  } catch (e) {
    console.warn(`[self-update] resync of ${site.url} failed:`, e instanceof Error ? e.message : e);
  }
}

/**
 * Install (from wordpress.org), delete, activate or deactivate plugins on one
 * site the user owns. Checked against the latest report: installs need a slug
 * that isn't installed yet, the others need an installed plugin in the right state.
 */
export async function startPluginAction(
  userId: string,
  siteId: string,
  kind: PluginAction,
  requested: { id: string; name?: string; activate?: boolean }[],
): Promise<StartResult> {
  const site = await db.query.sites.findFirst({
    where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
    with: { reports: { orderBy: [desc(reports.receivedAt)], limit: 1 } },
  });
  if (!site) return { ok: false, error: "Site not found." };
  const report = parseReport(site.reports[0]?.payload);
  if (!report) return { ok: false, error: "This site hasn't reported yet." };
  // Older plugins don't know these actions and would treat the job as a normal update.
  if (report.schema < 6) {
    return { ok: false, error: "Update the WP Siteherd plugin on this site to 0.7.0 or later to install, delete, activate or deactivate plugins." };
  }

  const inQueue = await itemsInQueue(site.id);
  const installed = new Map(report.plugins.map((p) => [p.file, p]));
  const installedSlugs = new Set(report.plugins.map((p) => slugOf(p.file)));
  const items: UpdateItem[] = [];
  for (const r of requested) {
    if (kind === "install") {
      const slug = r.id.trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: `"${r.id}" isn't a wordpress.org plugin slug.` };
      if (installedSlugs.has(slug)) return { ok: false, error: `${r.name || slug} is already installed on this site.` };
      if (inQueue.has(itemKey({ type: "plugin", id: slug }))) continue;
      items.push({ type: "plugin", id: slug, name: r.name || slug, from: "", to: "", activate: !!r.activate });
      continue;
    }
    const plugin = installed.get(r.id);
    if (!plugin) return { ok: false, error: "That plugin isn't installed on this site (any more)." };
    const name = plugin.name || plugin.file;
    if (slugOf(plugin.file) === SELF_SLUG && kind !== "activate") {
      return { ok: false, error: "WP Siteherd can't deactivate or delete itself. Do that in wp-admin." };
    }
    if (kind === "activate" && plugin.active) continue;
    if (kind === "deactivate" && !plugin.active) continue;
    if (inQueue.has(itemKey({ type: "plugin", id: plugin.file }))) continue;
    items.push({ type: "plugin", id: plugin.file, name, from: plugin.version, to: plugin.version });
  }
  if (items.length === 0) {
    return { ok: false, error: kind === "activate" || kind === "deactivate" ? `Nothing to ${kind}.` : "Already in the queue." };
  }
  return enqueue(site, { siteId: site.id, userId, kind, items });
}

/** Remove a job that is still waiting in the queue (not sent to the site yet). */
export async function cancelWaitingJob(userId: string, siteId: string, jobId: string): Promise<boolean> {
  const site = await db.query.sites.findFirst({ where: and(eq(sites.id, siteId), eq(sites.userId, userId)) });
  if (!site) return false;
  const deleted = await db
    .delete(updateJobs)
    .where(and(eq(updateJobs.id, jobId), eq(updateJobs.siteId, site.id), eq(updateJobs.status, "waiting")))
    .returning({ id: updateJobs.id });
  return deleted.length > 0;
}

type SiteTarget = { id: string; url: string; secret: string };
type NewJob = { siteId: string; userId: string; kind: UpdateJob["kind"]; items: UpdateItem[] };

/**
 * Send the job to the site now if nothing else is running or waiting there,
 * otherwise add it to the site's queue. advanceQueue() starts it later.
 */
async function enqueue(site: SiteTarget, values: NewJob): Promise<StartResult> {
  await expireStaleJobs([site.id]);
  const [ahead] = await db
    .select({ id: updateJobs.id })
    .from(updateJobs)
    .where(and(eq(updateJobs.siteId, site.id), eq(updateJobs.status, "waiting")))
    .limit(1);
  if (!ahead) {
    const [job] = await db
      .insert(updateJobs)
      .values({ ...values, status: "queued" })
      .onConflictDoNothing() // the one-active-job-per-site index: something is running
      .returning();
    if (job) {
      const sent = await dispatch(site, job);
      if (sent.ok) return { ok: true, jobId: job.id, queued: false };
      return sent.busy ? { ok: true, jobId: job.id, queued: true } : { ok: false, error: sent.error };
    }
  }
  const [job] = await db
    .insert(updateJobs)
    .values({ ...values, status: "waiting" })
    .returning({ id: updateJobs.id });
  // The active job may have finished in the meantime.
  await advanceQueue(site.id);
  return { ok: true, jobId: job.id, queued: true };
}

/**
 * Start the oldest waiting job on a site if nothing is active there. Called
 * when a job finishes (update-result push) and from loadJobs() as a fallback.
 * A job the site refuses is marked failed and the next one is tried.
 */
export async function advanceQueue(siteId: string): Promise<void> {
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId) });
  if (!site) return;
  for (;;) {
    const next = await db.query.updateJobs.findFirst({
      where: and(eq(updateJobs.siteId, siteId), eq(updateJobs.status, "waiting")),
      orderBy: [asc(updateJobs.createdAt)],
    });
    if (!next) return;
    let promoted: { id: string } | undefined;
    try {
      [promoted] = await db
        .update(updateJobs)
        .set({ status: "queued", updatedAt: new Date() })
        .where(
          and(
            eq(updateJobs.id, next.id),
            eq(updateJobs.status, "waiting"),
            notExists(
              db
                .select({ one: sql`1` })
                .from(activeJobs)
                .where(and(eq(activeJobs.siteId, siteId), inArray(activeJobs.status, [...ACTIVE_JOB_STATUSES]))),
            ),
          ),
        )
        .returning({ id: updateJobs.id });
    } catch (e) {
      // Another request promoted a job at the same moment (one-active-job index).
      if (isUniqueViolation(e)) return;
      throw e;
    }
    if (!promoted) {
      // Either a job is active (it will advance the queue when it finishes) or this one was cancelled.
      const stillWaiting = await db.query.updateJobs.findFirst({ where: and(eq(updateJobs.id, next.id), eq(updateJobs.status, "waiting")) });
      if (stillWaiting) return;
      continue;
    }
    const sent = await dispatch(site, next);
    // Busy: the site is still finishing something; loadJobs() retries later.
    if (sent.ok || sent.busy) return;
  }
}

const activeJobs = alias(updateJobs, "active_jobs");

function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x && typeof x === "object" && "code" in x ? (x as { code: unknown }).code : undefined);
  return code(e) === "23505" || (e instanceof Error && code(e.cause) === "23505");
}

const SITE_BLOCKED = "The site's firewall or security plugin blocked the dashboard (HTTP 403). Allow requests to /wp-json/siteherd/ from the dashboard's server.";

/** The request body the plugin's /update endpoint expects for this job. */
function sitePayload(job: Pick<UpdateJob, "id" | "kind" | "items">) {
  if (job.kind === "rollback") {
    return { job_id: job.id, action: "rollback", items: job.items.map(({ type, id, to }) => ({ type, id, version: to })) };
  }
  if (job.kind === "install") {
    return { job_id: job.id, action: "install", items: job.items.map(({ type, id, activate }) => ({ type, id, activate: !!activate })) };
  }
  if (job.kind === "update") return { job_id: job.id, items: job.items.map(({ type, id }) => ({ type, id })) };
  return { job_id: job.id, action: job.kind, items: job.items.map(({ type, id }) => ({ type, id })) };
}

/**
 * Send a job to the site's plugin; mark it failed if the site doesn't accept it.
 * If the site says it's busy, the job goes back to waiting instead.
 */
async function dispatch(
  site: SiteTarget,
  job: Pick<UpdateJob, "id" | "kind" | "items">,
): Promise<{ ok: true } | { ok: false; error: string; busy: boolean }> {
  const fail = async (error: string) => {
    await db
      .update(updateJobs)
      .set({ status: "failed", error, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(updateJobs.id, job.id));
    return { ok: false as const, error, busy: false };
  };

  try {
    const res = await callSite(site, "POST", "/update", sitePayload(job));
    if (res.status === 202) return { ok: true };
    if (res.status === 409) {
      await db.update(updateJobs).set({ status: "waiting", updatedAt: new Date() }).where(eq(updateJobs.id, job.id));
      return { ok: false, error: "The site is still finishing another update. This one will start after it.", busy: true };
    }
    if (res.status === 401) return fail("The site rejected the request. Is the plugin connected with this site's key?");
    if (res.status === 403) return fail(SITE_BLOCKED);
    if (res.status === 404) return fail("The site's WP Siteherd plugin is too old for remote updates. Update it to 0.4.0 or later.");
    if (res.status === 400) return fail("The site couldn't accept this request. Its WP Siteherd plugin may be too old.");
    return fail(`The site answered with HTTP ${res.status}.`);
  } catch (e) {
    return fail(`Couldn't reach the site: ${e instanceof Error ? e.message : String(e)}`);
  }
}
