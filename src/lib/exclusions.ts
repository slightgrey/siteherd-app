import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sites, updateExclusions } from "@/db/schema";
import { itemKey, type UpdateType } from "@/lib/update-types";

/** Excluded item keys (see itemKey) per site. */
export async function loadExclusions(siteIds: string[]): Promise<Map<string, Set<string>>> {
  const bySite = new Map<string, Set<string>>(siteIds.map((id) => [id, new Set()]));
  if (siteIds.length === 0) return bySite;
  const rows = await db
    .select({ siteId: updateExclusions.siteId, type: updateExclusions.type, itemId: updateExclusions.itemId })
    .from(updateExclusions)
    .where(inArray(updateExclusions.siteId, siteIds));
  for (const r of rows) bySite.get(r.siteId)!.add(itemKey({ type: r.type, id: r.itemId }));
  return bySite;
}

/** Exclude or include an item on a site the user owns. Returns false if the site isn't theirs. */
export async function setExclusion(
  userId: string,
  siteId: string,
  // Translations are updated all at once and can't be excluded.
  item: { type: Exclude<UpdateType, "translations">; id: string },
  excluded: boolean,
): Promise<boolean> {
  const site = await db.query.sites.findFirst({
    columns: { id: true },
    where: and(eq(sites.id, siteId), eq(sites.userId, userId)),
  });
  if (!site) return false;
  const itemId = item.type === "core" ? "core" : item.id;
  if (excluded) {
    await db.insert(updateExclusions).values({ siteId, type: item.type, itemId }).onConflictDoNothing();
  } else {
    await db
      .delete(updateExclusions)
      .where(and(eq(updateExclusions.siteId, siteId), eq(updateExclusions.type, item.type), eq(updateExclusions.itemId, itemId)));
  }
  return true;
}
