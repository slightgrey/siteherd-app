import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { db, pg } from "@/db";
import { feedState } from "@/db/schema";

// Reports arrive every 10 minutes per site and were kept forever (~280 MB per
// site per year). Old ones are deleted, except those something still reads:
//   - each site's latest report (every page),
//   - each site's earliest report ("First report received" in the activity log),
//   - the first report carrying each health.checked_at ("Daily checks ran").
// See src/lib/activity.ts. Keeps roughly one report per site per day.

const KEEP_ALL_DAYS = 7;
const BATCH = 5000;
const RUN_EVERY_MS = 24 * 60 * 60 * 1000;
const JOB = "report_retention";
// Arbitrary key for pg_try_advisory_lock, so only one prune runs at a time.
const LOCK_KEY = 72_610_403;

/**
 * Delete reports older than KEEP_ALL_DAYS that nothing reads any more, in
 * batches. Returns the number deleted, or null if another prune holds the lock.
 */
export async function pruneReports(): Promise<number | null> {
  // Advisory locks belong to a connection, so hold one for the whole run.
  const lock = await pg.reserve();
  try {
    const [{ locked }] = await lock`select pg_try_advisory_lock(${LOCK_KEY}) as locked`;
    if (!locked) return null;
    try {
      // Failed-login history is kept for 90 days (the Logins chart shows 30).
      await lock`delete from failed_login_hours where hour < now() - interval '90 days'`;
      let total = 0;
      for (;;) {
        const deleted = await lock`
          with keep as (
            (select distinct on (site_id) id from reports order by site_id, received_at desc)
            union
            (select distinct on (site_id) id from reports order by site_id, received_at asc)
            union
            (select distinct on (site_id, payload->'health'->>'checked_at') id
               from reports
              where payload->'health'->>'checked_at' is not null
              order by site_id, payload->'health'->>'checked_at', received_at asc)
          )
          delete from reports
           where id in (
             select id from reports
              where received_at < now() - make_interval(days => ${KEEP_ALL_DAYS})
                and id not in (select id from keep)
              limit ${BATCH}
           )
          returning id`;
        total += deleted.length;
        if (deleted.length < BATCH) return total;
      }
    } finally {
      await lock`select pg_advisory_unlock(${LOCK_KEY})`;
    }
  } finally {
    lock.release();
  }
}

/**
 * Starts pruneReports() after the response, at most once a day. The dashboard
 * has no scheduler, so page loads trigger it (`npm run reports:prune` works too).
 */
export async function ensureReportsPruned() {
  const now = new Date();
  // Claim today's run: only one request gets a row back.
  const claimed = await db
    .insert(feedState)
    .values({ name: JOB, attemptedAt: now })
    .onConflictDoUpdate({
      target: feedState.name,
      set: { attemptedAt: now },
      setWhere: sql`${feedState.attemptedAt} is null or ${feedState.attemptedAt} < ${new Date(now.getTime() - RUN_EVERY_MS).toISOString()}::timestamptz`,
    })
    .returning({ name: feedState.name });
  if (claimed.length === 0) return;
  after(async () => {
    try {
      const deleted = await pruneReports();
      if (deleted !== null) {
        await db.update(feedState).set({ syncedAt: new Date(), count: deleted, error: null }).where(eq(feedState.name, JOB));
      }
    } catch (error) {
      console.error("[retention] prune failed:", error);
      await db.update(feedState).set({ error: String((error as Error).message ?? error) }).where(eq(feedState.name, JOB));
    }
  });
}
