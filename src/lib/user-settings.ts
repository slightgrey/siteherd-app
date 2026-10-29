import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { normalizeAgencyName, type UserSettings } from "./white-label";

/** The user's settings, with defaults when they never saved any. Cached per request (layout + page). */
export const loadUserSettings = cache(async (userId: string): Promise<UserSettings> => {
  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  return { agencyName: normalizeAgencyName(row?.agencyName) };
});

export async function saveAgencyName(userId: string, input: unknown): Promise<void> {
  const agencyName = normalizeAgencyName(input);
  const updatedAt = new Date();
  await db
    .insert(userSettings)
    .values({ userId, agencyName, updatedAt })
    .onConflictDoUpdate({ target: userSettings.userId, set: { agencyName, updatedAt } });
}
