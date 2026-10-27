"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { generateSecret } from "@/lib/hmac";
import { isUuid } from "@/lib/ids";
import { LABEL_COLOR_KEYS, type LabelColor } from "@/lib/label-colors";
import { createLabel, deleteLabel, setSiteLabel, updateLabel, type LabelResult } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { callSite } from "@/lib/site-client";
import { setExclusion } from "@/lib/exclusions";
import { cancelWaitingJob, startRollback, startUpdate, type StartResult } from "@/lib/updates";
import { z } from "zod";

export type SiteFormState = { error?: string; name?: string; url?: string } | undefined;

export async function createSite(_prev: SiteFormState, formData: FormData): Promise<SiteFormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const rawUrl = String(formData.get("url") ?? "").trim();

  if (!name || name.length > 100) return { error: "Enter a name (up to 100 characters).", name, url: rawUrl };

  let url: string;
  try {
    const parsed = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    url = parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return { error: "Enter the site's address, e.g. https://client.com", name, url: rawUrl };
  }

  const [site] = await db
    .insert(sites)
    .values({ userId: user.id, name, url, secret: generateSecret() })
    .returning({ id: sites.id });
  redirect(`/sites/${site.id}`);
}

export async function deleteSite(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (isUuid(id)) {
    await db.delete(sites).where(and(eq(sites.id, id), eq(sites.userId, user.id)));
  }
  redirect("/sites");
}

const UpdateItemsSchema = z
  .array(
    z.object({
      type: z.enum(["plugin", "theme", "core", "translations"]),
      id: z.string().min(1).max(200),
      // The user confirmed overwriting a plugin whose files were edited on the site.
      overwriteEdits: z.boolean().optional(),
    }),
  )
  .min(1)
  .max(50);

/** Update selected items on one site. */
export async function updateSiteItems(siteId: string, items: unknown): Promise<StartResult> {
  const user = await requireUser();
  const parsed = UpdateItemsSchema.safeParse(items);
  if (!isUuid(siteId) || !parsed.success) return { ok: false, error: "Invalid request." };
  return startUpdate(user.id, siteId, parsed.data);
}

/** Roll a plugin or theme back to an earlier version on one site. */
export async function rollbackItem(siteId: string, item: unknown, version: unknown): Promise<StartResult> {
  const user = await requireUser();
  const parsedItem = z.object({ type: z.enum(["plugin", "theme"]), id: z.string().min(1).max(200) }).safeParse(item);
  const parsedVersion = z.string().regex(/^[0-9A-Za-z][0-9A-Za-z.\-+_]{0,39}$/).safeParse(version);
  if (!isUuid(siteId) || !parsedItem.success || !parsedVersion.success) return { ok: false, error: "Invalid request." };
  return startRollback(user.id, siteId, parsedItem.data, parsedVersion.data);
}

/**
 * "Resync": ask the site to send a fresh report now (with updates checked
 * again on wordpress.org). The report arrives through /api/sites/report before
 * the site answers, so a refresh afterwards shows it.
 */
export async function resyncSite(siteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!isUuid(siteId)) return { ok: false, error: "Invalid request." };
  const site = await db.query.sites.findFirst({ where: and(eq(sites.id, siteId), eq(sites.userId, user.id)) });
  if (!site) return { ok: false, error: "Site not found." };
  try {
    // Checking wordpress.org for updates can take a while on slow hosts.
    const res = await callSite(site, "POST", "/sync", {}, 60_000);
    if (res.status === 404) return { ok: false, error: "Update the WP Siteherd plugin on this site to 0.6.0 or later to resync." };
    if (res.status === 401) return { ok: false, error: "The site rejected the request. Is the plugin connected with this site's key?" };
    if (res.status !== 200) return { ok: false, error: `The site answered with HTTP ${res.status}.` };
    const body = res.body as { ok?: boolean; error?: string | null };
    return body.ok ? { ok: true } : { ok: false, error: `The site couldn't send its report: ${body.error ?? "unknown error"}` };
  } catch (e) {
    return { ok: false, error: `Couldn't reach the site: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Remove a job that is still waiting in a site's queue. */
export async function cancelQueuedJob(siteId: string, jobId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isUuid(siteId) || !isUuid(jobId)) return { ok: false };
  return { ok: await cancelWaitingJob(user.id, siteId, jobId) };
}

/** Exclude an item from (or include it in) dashboard updates on one site. */
export async function setUpdateExcluded(siteId: string, item: unknown, excluded: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  // Translations can't be excluded; they're updated all at once.
  const parsed = z.object({ type: z.enum(["plugin", "theme", "core"]), id: z.string().min(1).max(200) }).safeParse(item);
  if (!isUuid(siteId) || !parsed.success) return { ok: false };
  return { ok: await setExclusion(user.id, siteId, parsed.data, excluded === true) };
}

const LabelInputSchema = z.object({
  name: z.string().trim().min(1, "Give the label a name.").max(40, "Keep label names to 40 characters."),
  color: z.enum(LABEL_COLOR_KEYS as [LabelColor, ...LabelColor[]]),
});

function labelInput(input: unknown): { ok: true; name: string; color: LabelColor } | { ok: false; error: string } {
  const parsed = LabelInputSchema.safeParse(input);
  return parsed.success ? { ok: true, ...parsed.data } : { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid label." };
}

/** Create a label (e.g. a client or agency name) for grouping sites. */
export async function addLabel(input: unknown): Promise<LabelResult> {
  const user = await requireUser();
  const label = labelInput(input);
  if (!label.ok) return label;
  return createLabel(user.id, label.name, label.color);
}

export async function editLabel(labelId: string, input: unknown): Promise<LabelResult> {
  const user = await requireUser();
  const label = labelInput(input);
  if (!isUuid(labelId)) return { ok: false, error: "Invalid request." };
  if (!label.ok) return label;
  return updateLabel(user.id, labelId, label.name, label.color);
}

/** Delete a label; it's removed from its sites, which stay. */
export async function removeLabel(labelId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isUuid(labelId)) return { ok: false };
  await deleteLabel(user.id, labelId);
  return { ok: true };
}

/** Put a label on a site, or take it off. */
export async function setSiteLabelAction(siteId: string, labelId: string, on: boolean): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!isUuid(siteId) || !isUuid(labelId)) return { ok: false };
  return { ok: await setSiteLabel(user.id, siteId, labelId, on === true) };
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
