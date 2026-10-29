import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { failedLoginHours, reports, siteEvents, type SiteEvent } from "@/db/schema";
import type { DayCounts } from "@/lib/login-attacks";
import type { Report } from "@/lib/report";
import { parseReport } from "@/lib/report";
import { adminChanges } from "@/lib/site-events";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The site's latest stored report, parsed. Call before inserting the new one. */
export async function previousReport(tx: Tx, siteId: string) {
  const [row] = await tx
    .select({ payload: reports.payload })
    .from(reports)
    .where(eq(reports.siteId, siteId))
    .orderBy(desc(reports.receivedAt))
    .limit(1);
  return row ? parseReport(row.payload) : null;
}

/**
 * Store what a new report adds to the login history: its hourly failed-login
 * buckets (upserted, keeping the larger counts) and admins added or removed
 * since the previous report.
 */
export async function recordLoginData(tx: Tx, siteId: string, prev: Report | null, next: Report, now = Date.now()) {
  // Only whole hours from the last 25 hours; anything else is a bad clock or bad data.
  const hours = next.failed_logins_hourly.filter(
    (h) => h.hour % 3600 === 0 && h.hour * 1000 > now - 25 * 3_600_000 && h.hour * 1000 <= now,
  );
  if (hours.length > 0) {
    await tx
      .insert(failedLoginHours)
      .values(hours.map((h) => ({ siteId, hour: new Date(h.hour * 1000), login: h.login, xmlrpc: h.xmlrpc, rest: h.rest, other: h.other })))
      .onConflictDoUpdate({
        target: [failedLoginHours.siteId, failedLoginHours.hour],
        set: {
          login: sql`greatest(${failedLoginHours.login}, excluded.login)`,
          xmlrpc: sql`greatest(${failedLoginHours.xmlrpc}, excluded.xmlrpc)`,
          rest: sql`greatest(${failedLoginHours.rest}, excluded.rest)`,
          other: sql`greatest(${failedLoginHours.other}, excluded.other)`,
        },
      });
  }

  const { added, removed } = adminChanges(prev?.sso, next.sso);
  const events = [
    ...added.map((a) => ({ siteId, kind: "admin_added" as const, data: a })),
    ...removed.map((a) => ({ siteId, kind: "admin_removed" as const, data: a })),
  ];
  if (events.length > 0) await tx.insert(siteEvents).values(events);
}

/** Failed logins per UTC day for the last `days` days, per site. */
export async function loadLoginDays(siteIds: string[], days: number) {
  const out = new Map<string, DayCounts[]>(siteIds.map((id) => [id, []]));
  if (siteIds.length === 0) return out;
  const rows = await db
    .select({
      siteId: failedLoginHours.siteId,
      day: sql<string>`to_char(${failedLoginHours.hour} at time zone 'UTC', 'YYYY-MM-DD')`,
      login: sql<number>`sum(${failedLoginHours.login})::int`,
      xmlrpc: sql<number>`sum(${failedLoginHours.xmlrpc})::int`,
      rest: sql<number>`sum(${failedLoginHours.rest})::int`,
      other: sql<number>`sum(${failedLoginHours.other})::int`,
    })
    .from(failedLoginHours)
    .where(
      and(
        inArray(failedLoginHours.siteId, siteIds),
        sql`${failedLoginHours.hour} >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' - make_interval(days => ${days - 1})`,
      ),
    )
    .groupBy(failedLoginHours.siteId, sql`2`);
  for (const { siteId, ...day } of rows) out.get(siteId)!.push(day);
  return out;
}

/** Administrators that appeared since the previous report and haven't been dismissed, per site. */
export async function loadNewAdmins(siteIds: string[]) {
  const out = new Map<string, SiteEvent[]>(siteIds.map((id) => [id, []]));
  if (siteIds.length === 0) return out;
  const rows = await db
    .select()
    .from(siteEvents)
    .where(and(inArray(siteEvents.siteId, siteIds), eq(siteEvents.kind, "admin_added"), isNull(siteEvents.dismissedAt)))
    .orderBy(desc(siteEvents.at));
  for (const row of rows) out.get(row.siteId)!.push(row);
  return out;
}

/** Dismiss a new-admin alert ("That was me"). The caller checks the site belongs to the user. */
export async function dismissEvent(siteId: string, eventId: string) {
  const rows = await db
    .update(siteEvents)
    .set({ dismissedAt: new Date() })
    .where(and(eq(siteEvents.id, eventId), eq(siteEvents.siteId, siteId), isNull(siteEvents.dismissedAt)))
    .returning({ id: siteEvents.id });
  return rows.length > 0;
}

/** Admin added/removed events for the activity log. */
export async function loadAdminEvents(siteId: string, limit: number) {
  return db.select().from(siteEvents).where(eq(siteEvents.siteId, siteId)).orderBy(desc(siteEvents.at)).limit(limit);
}
