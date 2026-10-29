import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, sites, userSettings } from "@/db/schema";
import { signedJson } from "@/lib/hmac";
import { previousReport, recordLoginData } from "@/lib/login-data";
import { parseReport } from "@/lib/report";
import { authenticateSiteRequest, parseJsonObject } from "@/lib/site-auth";
import { normalizeAgencyName } from "@/lib/white-label";

export async function POST(request: Request) {
  const auth = await authenticateSiteRequest(request, "report");
  if (auth instanceof Response) return auth;
  const { site, rawBody, signature } = auth;

  const payload = parseJsonObject(rawBody);
  if (payload instanceof Response) return payload;

  const inserted = await db.transaction(async (tx) => {
    const prev = await previousReport(tx, site.id);
    const [row] = await tx
      .insert(reports)
      .values({ siteId: site.id, signature, payload })
      .onConflictDoNothing()
      .returning({ id: reports.id, receivedAt: reports.receivedAt });
    if (row) {
      await tx.update(sites).set({ lastReportAt: row.receivedAt }).where(eq(sites.id, site.id));
      const next = parseReport(payload);
      if (next) await recordLoginData(tx, site.id, prev, next);
    }
    return row;
  });
  if (!inserted) {
    console.warn(`[report] rejected site=${site.id} reason=replayed_signature`);
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Signed, so the plugin (0.11.0+) can trust the branding and show the agency name.
  const owner = await db
    .select({ agencyName: userSettings.agencyName })
    .from(sites)
    .leftJoin(userSettings, eq(userSettings.userId, sites.userId))
    .where(eq(sites.id, site.id));
  const branding = { agency_name: normalizeAgencyName(owner[0]?.agencyName) };
  return signedJson(site, { ok: true, reportId: inserted.id, branding }, { status: 201 });
}
