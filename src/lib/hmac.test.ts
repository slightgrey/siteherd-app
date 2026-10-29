import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAX_CLOCK_SKEW_SECONDS, sign, signedJson, verify } from "./hmac";

const secret = "a".repeat(64);
const now = 1_760_000_000;
const ts = String(now);
const body = '{"wp_version":"6.8"}';

describe("sign", () => {
  it("signs `${timestamp}.${body}` as lowercase hex", () => {
    const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(sign(secret, ts, body)).toBe(expected);
    expect(sign(secret, ts, body)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the plugin's signature (shared vector in wp-siteherd/tests/SignerTest.php)", () => {
    expect(sign(secret, ts, body)).toBe("d1a57ceb8873614356924934e0c84e175adcfd1c9403cb023e545de28b4fc42f");
  });
});

describe("verify", () => {
  const good = sign(secret, ts, body);

  it("accepts a valid signature", () => {
    expect(verify(secret, ts, body, good, now)).toEqual({ ok: true });
  });

  it("rejects a tampered body", () => {
    expect(verify(secret, ts, body + " ", good, now)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects the wrong secret", () => {
    expect(verify("b".repeat(64), ts, body, good, now)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects uppercase or malformed signatures", () => {
    expect(verify(secret, ts, body, good.toUpperCase(), now).ok).toBe(false);
    expect(verify(secret, ts, body, "nothex", now).ok).toBe(false);
  });

  it("accepts skew up to the limit and rejects beyond it", () => {
    expect(verify(secret, ts, body, good, now + MAX_CLOCK_SKEW_SECONDS).ok).toBe(true);
    expect(verify(secret, ts, body, good, now - MAX_CLOCK_SKEW_SECONDS).ok).toBe(true);
    expect(verify(secret, ts, body, good, now + MAX_CLOCK_SKEW_SECONDS + 1)).toEqual({
      ok: false,
      reason: "stale_timestamp",
    });
  });

  it("rejects non-numeric timestamps", () => {
    expect(verify(secret, "12.5", body, good, now)).toEqual({ ok: false, reason: "bad_timestamp" });
    expect(verify(secret, "", body, good, now)).toEqual({ ok: false, reason: "bad_timestamp" });
  });
});

describe("signedJson", () => {
  it("signs the exact response body with the site secret", async () => {
    const res = signedJson({ id: "site-1", secret }, { ok: true, branding: { agency_name: "My Agency" } }, { status: 201 }, now);
    const raw = await res.text();
    expect(res.status).toBe(201);
    expect(res.headers.get("x-siteherd-site")).toBe("site-1");
    expect(res.headers.get("x-siteherd-timestamp")).toBe(ts);
    expect(verify(secret, ts, raw, res.headers.get("x-siteherd-signature")!, now)).toEqual({ ok: true });
    expect(JSON.parse(raw).branding.agency_name).toBe("My Agency");
  });
});
