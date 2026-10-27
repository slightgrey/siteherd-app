import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, sites } from "@/db/schema";
import { authenticateSiteRequest, parseJsonObject } from "@/lib/site-auth";

export async function POST(request: Request) {
  const auth = await authenticateSiteRequest(request, "report");
  if (auth instanceof Response) return auth;
  const { site, rawBody, signature } = auth;

  const payload = parseJsonObject(rawBody);
  if (payload instanceof Response) return payload;

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(reports)
      .values({ siteId: site.id, signature, payload })
      .onConflictDoNothing()
      .returning({ id: reports.id, receivedAt: reports.receivedAt });
    if (row) {
      await tx.update(sites).set({ lastReportAt: row.receivedAt }).where(eq(sites.id, site.id));
    }
    return row;
  });
  if (!inserted) {
    console.warn(`[report] rejected site=${site.id} reason=replayed_signature`);
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json({ ok: true, reportId: inserted.id }, { status: 201 });
}
