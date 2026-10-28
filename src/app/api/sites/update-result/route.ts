import { and, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { updateJobs } from "@/db/schema";
import { authenticateSiteRequest, jsonError, parseJsonObject } from "@/lib/site-auth";
import { ACTIVE_JOB_STATUSES } from "@/lib/update-types";
import { advanceQueue } from "@/lib/updates";

// Pushed by Siteherd_Updater after each item and when the job finishes.
const PushSchema = z.object({
  job_id: z.uuid(),
  status: z.enum(["running", "completed", "failed"]),
  results: z
    .array(
      z.object({
        type: z.enum(["plugin", "theme", "core", "translations"]),
        id: z.string().max(200),
        name: z.string().max(300).catch(""),
        from: z.string().max(50).nullable().catch(null),
        to: z.string().max(50).nullable().catch(null),
        status: z.enum(["updated", "failed", "rolled_back", "skipped", "installed", "deleted", "activated", "deactivated"]),
        message: z.string().max(2000).nullable().catch(null),
      }),
    )
    .max(50),
  error: z.string().max(2000).nullable().catch(null),
  note: z.string().max(2000).nullable().catch(null),
});

export async function POST(request: Request) {
  const auth = await authenticateSiteRequest(request, "update-result");
  if (auth instanceof Response) return auth;

  const body = parseJsonObject(auth.rawBody);
  if (body instanceof Response) return body;
  const parsed = PushSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "invalid update result");
  const push = parsed.data;

  const final = push.status !== "running";
  // Only this site's job, and never reopen a finished one (e.g. a replayed push).
  const [job] = await db
    .update(updateJobs)
    .set({
      status: push.status,
      results: push.results,
      error: push.error,
      note: push.note,
      updatedAt: new Date(),
      finishedAt: final ? new Date() : null,
    })
    .where(
      and(
        eq(updateJobs.id, push.job_id),
        eq(updateJobs.siteId, auth.site.id),
        inArray(updateJobs.status, [...ACTIVE_JOB_STATUSES]),
      ),
    )
    .returning({ id: updateJobs.id });

  if (!job) return jsonError(404, "no active job with that id");
  // Start the next queued job once the plugin has its answer (its job lock is already released).
  if (final) after(() => advanceQueue(auth.site.id));
  return Response.json({ ok: true });
}
