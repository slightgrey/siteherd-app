import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { labels, siteLabels, sites } from "@/db/schema";
import { LABEL_COLORS, type LabelColor } from "@/lib/label-colors";

export type SiteLabel = { id: string; name: string; color: LabelColor };

const asColor = (c: string): LabelColor => (c in LABEL_COLORS ? (c as LabelColor) : "gray");

/** The user's labels by name, with how many sites each one is on. */
export async function loadLabels(userId: string): Promise<(SiteLabel & { sites: number })[]> {
  const rows = await db
    .select({ id: labels.id, name: labels.name, color: labels.color, sites: count(siteLabels.siteId) })
    .from(labels)
    .leftJoin(siteLabels, eq(siteLabels.labelId, labels.id))
    .where(eq(labels.userId, userId))
    .groupBy(labels.id)
    .orderBy(asc(labels.name));
  return rows.map((r) => ({ ...r, color: asColor(r.color) }));
}

/** Label ids per site. */
export async function loadSiteLabelIds(siteIds: string[]): Promise<Map<string, string[]>> {
  const bySite = new Map<string, string[]>(siteIds.map((id) => [id, []]));
  if (siteIds.length === 0) return bySite;
  const rows = await db.select().from(siteLabels).where(inArray(siteLabels.siteId, siteIds));
  for (const r of rows) bySite.get(r.siteId)!.push(r.labelId);
  return bySite;
}

export type LabelResult = { ok: true } | { ok: false; error: string };

const duplicate: LabelResult = { ok: false, error: "You already have a label with that name." };

/** Postgres unique violation (the per-user name index), possibly wrapped by Drizzle. */
function isUniqueViolation(e: unknown): boolean {
  const code = (x: unknown) => (x && typeof x === "object" && "code" in x ? (x as { code: unknown }).code : undefined);
  return code(e) === "23505" || (e instanceof Error && code(e.cause) === "23505");
}

export async function createLabel(userId: string, name: string, color: LabelColor): Promise<LabelResult> {
  try {
    await db.insert(labels).values({ userId, name, color });
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) return duplicate;
    throw e;
  }
}

export async function updateLabel(userId: string, labelId: string, name: string, color: LabelColor): Promise<LabelResult> {
  try {
    const updated = await db
      .update(labels)
      .set({ name, color })
      .where(and(eq(labels.id, labelId), eq(labels.userId, userId)))
      .returning({ id: labels.id });
    return updated.length > 0 ? { ok: true } : { ok: false, error: "Label not found." };
  } catch (e) {
    if (isUniqueViolation(e)) return duplicate;
    throw e;
  }
}

/** Deleting a label removes it from its sites (cascade); the sites stay. */
export async function deleteLabel(userId: string, labelId: string): Promise<void> {
  await db.delete(labels).where(and(eq(labels.id, labelId), eq(labels.userId, userId)));
}

/** Put a label on a site or take it off. Both must belong to the user. */
export async function setSiteLabel(userId: string, siteId: string, labelId: string, on: boolean): Promise<boolean> {
  const [site, label] = await Promise.all([
    db.query.sites.findFirst({ columns: { id: true }, where: and(eq(sites.id, siteId), eq(sites.userId, userId)) }),
    db.query.labels.findFirst({ columns: { id: true }, where: and(eq(labels.id, labelId), eq(labels.userId, userId)) }),
  ]);
  if (!site || !label) return false;
  if (on) await db.insert(siteLabels).values({ siteId, labelId }).onConflictDoNothing();
  else await db.delete(siteLabels).where(and(eq(siteLabels.siteId, siteId), eq(siteLabels.labelId, labelId)));
  return true;
}
