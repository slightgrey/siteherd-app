import { createHmac, randomBytes } from "node:crypto";

// One-click login token, verified by Siteherd_Signer::verify_sso_token() in the plugin:
//   token = base64url(JSON {site, user, iat, nonce}) + "." + hex(HMAC-SHA256(secret, "sso." + base64url part))
// The plugin accepts it within 120 s of `iat` and only once per nonce.

export function createSsoToken(
  secret: string,
  siteId: string,
  userId: number,
  iat: number = Math.floor(Date.now() / 1000),
  nonce: string = randomBytes(16).toString("hex"),
): string {
  const payload = Buffer.from(JSON.stringify({ site: siteId, user: userId, iat, nonce })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`sso.${payload}`).digest("hex");
  return `${payload}.${signature}`;
}

/** The plugin's login URL for a token. */
export function ssoLoginUrl(siteUrl: string, token: string): string {
  const url = new URL("wp-login.php", siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`);
  url.searchParams.set("action", "siteherd_sso");
  url.searchParams.set("token", token);
  return url.toString();
}
