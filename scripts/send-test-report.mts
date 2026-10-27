// Sends a signed sample report, the way the wp-siteherd plugin does.
// Usage: npm run report:test -- <connection key from the site page>
import { decodeConnectionKey } from "../src/lib/connection-key";
import { HEADER_SIGNATURE, HEADER_SITE, HEADER_TIMESTAMP, sign } from "../src/lib/hmac";

const key = decodeConnectionKey(process.argv[2] ?? "");
if (!key) {
  console.error("Usage: npm run report:test -- <connection key>");
  process.exit(1);
}

const body = JSON.stringify({
  wp_version: "6.8.3",
  php_version: "8.3.14",
  plugins: [{ slug: "akismet", version: "5.3", update: "5.4" }],
  themes: [{ slug: "twentytwentyfive", version: "1.2", update: null }],
  failed_logins_24h: 3,
});
const timestamp = String(Math.floor(Date.now() / 1000));

const res = await fetch(`${key.url}/api/sites/report`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    [HEADER_SITE]: key.id,
    [HEADER_TIMESTAMP]: timestamp,
    [HEADER_SIGNATURE]: sign(key.secret, timestamp, body),
  },
  body,
});
console.log(res.status, await res.text());
