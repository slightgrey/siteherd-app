import { readFileSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { getCACertificates } from "node:tls";
import { HEADER_SIGNATURE, HEADER_SITE, HEADER_TIMESTAMP, sign } from "@/lib/hmac";

// Requests from the dashboard to a site's plugin (/wp-json/siteherd/v1/...),
// signed exactly like the plugin's reports. Uses node:https rather than fetch
// so an extra CA can be trusted in development: set SITE_CA_FILE to e.g.
// Laragon's C:/laragon/etc/ssl/laragon.crt for https://*.test sites. Laragon
// regenerates that cert when sites are added, so the file is re-read whenever
// its mtime changes instead of once per process.

let extraCa: { mtimeMs: number; pem: Buffer } | undefined;
function siteCa() {
  const file = process.env.SITE_CA_FILE;
  if (!file) return null;
  const { mtimeMs } = statSync(file);
  if (extraCa?.mtimeMs !== mtimeMs) extraCa = { mtimeMs, pem: readFileSync(file) };
  return extraCa.pem;
}

export type SiteResponse = { status: number; body: unknown };

const USER_AGENT = `WP-Siteherd-Dashboard/1.0${process.env.APP_URL ? ` (+${process.env.APP_URL})` : ""}`;

export function callSite(
  site: { id: string; url: string; secret: string },
  method: "GET" | "POST",
  path: string,
  payload?: unknown,
  timeoutMs = 15_000,
): Promise<SiteResponse> {
  const raw = payload === undefined ? "" : JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const url = new URL(`${site.url.replace(/\/+$/, "")}/wp-json/siteherd/v1${path}`);
  const client = url.protocol === "https:" ? https : http;
  const ca = siteCa();

  return new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method,
        timeout: timeoutMs,
        // Added to Node's defaults (bundled + NODE_EXTRA_CA_CERTS), not instead of them.
        ...(ca && url.protocol === "https:" ? { ca: [...getCACertificates("default"), ca] } : {}),
        headers: {
          // node:https sends no User-Agent by default, and many host firewalls
          // (LiteSpeed/Imunify, ModSecurity rules) answer 403 to requests without one.
          "user-agent": USER_AGENT,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(raw),
          [HEADER_SITE]: site.id,
          [HEADER_TIMESTAMP]: timestamp,
          [HEADER_SIGNATURE]: sign(site.secret, timestamp, raw),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let body: unknown = text;
          try {
            body = JSON.parse(text);
          } catch {}
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timed out after ${timeoutMs / 1000} s`)));
    req.on("error", reject);
    req.end(raw);
  });
}
