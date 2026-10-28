import { eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { db, pg } from "@/db";
import { feedState, vulnerabilities } from "@/db/schema";
import type { Report } from "@/lib/report";
import { matchReport, rowKey, softwareKeys, type SoftwareType, type VersionRange, type VulnRow, type VulnerableItem } from "@/lib/vulnerabilities";

// Wordfence Intelligence v3 (free API key from wordfence.com → Account →
// Integrations). The production feed includes CVSS and CVE; the scanner feed
// is smaller but has neither, so it's only a fallback.
const FEED_URL = "https://www.wordfence.com/api/intelligence/v3/vulnerabilities";
const FEED = "wordfence";
const REFRESH_MS = 24 * 60 * 60 * 1000;
// After a failed download (e.g. 429 rate limit), wait this long before retrying.
const RETRY_MS = 60 * 60 * 1000;
// Arbitrary key for pg_try_advisory_lock, so only one sync runs at a time.
const LOCK_KEY = 72_610_401;

export function feedConfigured() {
  return !!process.env.WORDFENCE_API_KEY;
}

type FeedRecord = {
  id: string;
  title: string;
  software?: {
    type: string;
    slug: string;
    affected_versions?: Record<string, VersionRange>;
    patched_versions?: string[];
  }[];
  informational?: boolean;
  references?: string[];
  published?: string | null;
  cvss?: { score?: number | string | null; rating?: string | null } | null;
  cve?: string | null;
};

type NewRow = typeof vulnerabilities.$inferInsert;

function toRows(feed: Record<string, FeedRecord>): NewRow[] {
  const rows = new Map<string, NewRow>();
  for (const record of Object.values(feed)) {
    // "Informational" records describe issues that aren't vulnerabilities in a version.
    if (!record?.id || record.informational || !Array.isArray(record.software)) continue;
    const score = record.cvss?.score != null ? Number(record.cvss.score) : null;
    const published = record.published ? new Date(record.published.replace(" ", "T") + "Z") : null;
    for (const sw of record.software) {
      if (sw.type !== "plugin" && sw.type !== "theme" && sw.type !== "core") continue;
      if (!sw.slug) continue;
      const slug = sw.slug.toLowerCase();
      const row: NewRow = {
        id: record.id,
        softwareType: sw.type,
        slug,
        title: record.title ?? "Unnamed vulnerability",
        affected: Object.values(sw.affected_versions ?? {}),
        patchedVersions: sw.patched_versions ?? [],
        cvssScore: score !== null && Number.isFinite(score) ? score : null,
        cvssRating: record.cvss?.rating ?? null,
        cve: record.cve ?? null,
        link: record.references?.find((r) => r.includes("wordfence.com/threat-intel")) ?? record.references?.[0] ?? null,
        publishedAt: published && !Number.isNaN(published.getTime()) ? published : null,
      };
      rows.set(`${row.id}|${row.softwareType}|${slug}`, row);
    }
  }
  return [...rows.values()];
}

async function download(kind: "production" | "scanner"): Promise<Record<string, FeedRecord>> {
  const res = await fetch(`${FEED_URL}/${kind}`, {
    headers: { authorization: `Bearer ${process.env.WORDFENCE_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Wordfence ${kind} feed: HTTP ${res.status}`);
  return (await res.json()) as Record<string, FeedRecord>;
}

/**
 * Downloads the feed and replaces the vulnerabilities table. `file` loads a
 * previously downloaded feed instead (scripts/sync-vulns.mts --file).
 * Returns the number of rows stored, or null if another sync holds the lock.
 */
export async function syncFeed(options: { feed?: Record<string, FeedRecord> } = {}): Promise<number | null> {
  // Advisory locks belong to a connection, so hold one connection for the whole sync.
  const lock = await pg.reserve();
  try {
    const [{ locked }] = await lock`select pg_try_advisory_lock(${LOCK_KEY}) as locked`;
    if (!locked) return null;
    try {
      await db
        .insert(feedState)
        .values({ name: FEED, attemptedAt: new Date() })
        .onConflictDoUpdate({ target: feedState.name, set: { attemptedAt: new Date() } });

      let feed = options.feed;
      if (!feed) {
        try {
          feed = await download("production");
        } catch (error) {
          console.warn(`[vulns] ${(error as Error).message}; trying the scanner feed`);
          feed = await download("scanner");
        }
      }
      const rows = toRows(feed);
      if (rows.length === 0) throw new Error("Wordfence feed was empty");

      await db.transaction(async (tx) => {
        await tx.delete(vulnerabilities);
        for (let i = 0; i < rows.length; i += 1000) await tx.insert(vulnerabilities).values(rows.slice(i, i + 1000));
        await tx
          .update(feedState)
          .set({ syncedAt: new Date(), count: rows.length, error: null })
          .where(eq(feedState.name, FEED));
      });
      return rows.length;
    } catch (error) {
      console.error("[vulns] sync failed:", error);
      await db.update(feedState).set({ error: String((error as Error).message ?? error) }).where(eq(feedState.name, FEED));
      throw error;
    } finally {
      await lock`select pg_advisory_unlock(${LOCK_KEY})`;
    }
  } finally {
    lock.release();
  }
}

export async function loadFeedState() {
  return (await db.query.feedState.findFirst({ where: eq(feedState.name, FEED) })) ?? null;
}

/**
 * Starts a background sync after the response when the feed is older than a
 * day (and the last attempt wasn't within the retry window). The dashboard has
 * no scheduler, so page loads keep it fresh; `npm run vulns:sync` works too.
 */
export async function ensureFreshFeed() {
  if (!feedConfigured()) return;
  const state = await loadFeedState();
  const now = Date.now();
  const stale = !state?.syncedAt || now - state.syncedAt.getTime() > REFRESH_MS;
  const retryOk = !state?.attemptedAt || now - state.attemptedAt.getTime() > RETRY_MS;
  if (stale && retryOk) after(() => syncFeed().catch(() => {}));
}

/** Vulnerable items per site, from each site's latest report. */
export async function loadVulns(sites: { id: string; report: Report | null }[]): Promise<Map<string, VulnerableItem[]>> {
  const result = new Map<string, VulnerableItem[]>(sites.map((s) => [s.id, []]));
  const keys = new Map<string, { type: SoftwareType; slug: string }>();
  for (const s of sites) if (s.report) for (const k of softwareKeys(s.report)) keys.set(rowKey(k.type, k.slug), k);
  if (keys.size === 0 || !feedConfigured()) return result;

  const slugs = [...new Set([...keys.values()].map((k) => k.slug.toLowerCase()))];
  const found = await db
    .select()
    .from(vulnerabilities)
    .where(inArray(vulnerabilities.slug, slugs));

  const rows = new Map<string, VulnRow[]>();
  for (const row of found) {
    const key = rowKey(row.softwareType, row.slug);
    if (!keys.has(key)) continue;
    rows.set(key, [...(rows.get(key) ?? []), row]);
  }
  for (const s of sites) if (s.report) result.set(s.id, matchReport(s.report, rows));
  return result;
}
