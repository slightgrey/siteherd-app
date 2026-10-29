import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Signing contract shared with the wp-siteherd plugin (Siteherd_Signer):
//   signature = hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))
// timestamp is Unix seconds; rawBody is the exact request body ("" for GET).

export const MAX_CLOCK_SKEW_SECONDS = 300;

export const HEADER_SITE = "x-siteherd-site";
export const HEADER_TIMESTAMP = "x-siteherd-timestamp";
export const HEADER_SIGNATURE = "x-siteherd-signature";

export function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

export function sign(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

/**
 * A JSON response signed like a request (same headers and contract), so the
 * plugin can trust what the dashboard answers, e.g. the branding after a report.
 */
export function signedJson(
  site: { id: string; secret: string },
  data: unknown,
  init: { status?: number } = {},
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Response {
  const body = JSON.stringify(data);
  const timestamp = String(nowSeconds);
  return new Response(body, {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      [HEADER_SITE]: site.id,
      [HEADER_TIMESTAMP]: timestamp,
      [HEADER_SIGNATURE]: sign(site.secret, timestamp, body),
    },
  });
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "bad_timestamp" | "stale_timestamp" | "bad_signature" };

export function verify(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!/^\d{1,12}$/.test(timestamp)) return { ok: false, reason: "bad_timestamp" };
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }
  if (!/^[0-9a-f]{64}$/.test(signature)) return { ok: false, reason: "bad_signature" };

  const expected = Buffer.from(sign(secret, timestamp, rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  return timingSafeEqual(expected, given) ? { ok: true } : { ok: false, reason: "bad_signature" };
}
