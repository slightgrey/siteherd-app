import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { HEADER_SIGNATURE, HEADER_SITE, HEADER_TIMESTAMP, verify } from "@/lib/hmac";
import { isUuid } from "@/lib/ids";

export const MAX_BODY_BYTES = 1024 * 1024;

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

// Every auth failure gets the same response so callers can't probe which
// Site IDs exist or which check failed. The reason is logged server-side.
function unauthorized(label: string, siteId: string | null, reason: string) {
  console.warn(`[${label}] rejected site=${siteId ?? "-"} reason=${reason}`);
  return jsonError(401, "unauthorized");
}

/**
 * Authenticate a request the plugin signed with its site secret (see hmac.ts).
 * Returns the site and the exact raw body, or a Response to send back.
 */
export async function authenticateSiteRequest(
  request: Request,
  label: string,
): Promise<{ site: { id: string; secret: string }; rawBody: string; signature: string } | Response> {
  const siteId = request.headers.get(HEADER_SITE);
  const timestamp = request.headers.get(HEADER_TIMESTAMP);
  const signature = request.headers.get(HEADER_SIGNATURE);
  if (!siteId || !timestamp || !signature) return unauthorized(label, siteId, "missing_headers");
  if (!isUuid(siteId)) return unauthorized(label, siteId, "bad_site_id");

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return jsonError(413, "payload too large");
  }
  // Verify against the exact bytes received, before any JSON parsing.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return jsonError(413, "payload too large");

  const site = await db.query.sites.findFirst({
    columns: { id: true, secret: true },
    where: eq(sites.id, siteId),
  });
  if (!site) return unauthorized(label, siteId, "unknown_site");

  const result = verify(site.secret, timestamp, rawBody, signature);
  if (!result.ok) return unauthorized(label, siteId, result.reason);

  return { site, rawBody, signature };
}

/** Parse a JSON object body, or a 400 Response. */
export function parseJsonObject(rawBody: string): Record<string, unknown> | Response {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError(400, "body must be valid JSON");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return jsonError(400, "body must be a JSON object");
  }
  return payload as Record<string, unknown>;
}
