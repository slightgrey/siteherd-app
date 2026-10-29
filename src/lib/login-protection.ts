import type { Report } from "./report";
import { slugOf } from "./vulnerabilities";

// Plugins that protect logins, by wordpress.org folder slug. Pure, so it can be
// tested and used on both the fleet and the site pages.

export type ProtectionKind = "lockout" | "firewall" | "2fa" | "captcha";

export const PROTECTION_PLUGINS: Record<string, { name: string; kinds: ProtectionKind[] }> = {
  wordfence: { name: "Wordfence", kinds: ["firewall", "lockout", "2fa"] },
  "better-wp-security": { name: "Solid Security", kinds: ["lockout", "2fa"] },
  "ithemes-security-pro": { name: "Solid Security Pro", kinds: ["lockout", "2fa"] },
  "limit-login-attempts-reloaded": { name: "Limit Login Attempts Reloaded", kinds: ["lockout"] },
  loginizer: { name: "Loginizer", kinds: ["lockout"] },
  "wp-cerber": { name: "WP Cerber", kinds: ["firewall", "lockout"] },
  "all-in-one-wp-security-and-firewall": { name: "All-In-One Security", kinds: ["firewall", "lockout"] },
  "wp-simple-firewall": { name: "Shield Security", kinds: ["firewall", "lockout"] },
  "defender-security": { name: "Defender", kinds: ["firewall", "lockout", "2fa"] },
  "two-factor": { name: "Two Factor", kinds: ["2fa"] },
  "wp-2fa": { name: "WP 2FA", kinds: ["2fa"] },
  "simple-cloudflare-turnstile": { name: "Simple Cloudflare Turnstile", kinds: ["captcha"] },
};

export type LoginProtection = {
  /** Active protection plugins. */
  plugins: { slug: string; name: string; kinds: ProtectionKind[] }[];
  /** XML-RPC logins blocked by WP Siteherd (schema 8+). */
  xmlrpcOff: boolean;
  /** WP Siteherd's own login lockout is on and active (schema 9+). */
  lockout: boolean;
  /** Jetpack is active, and it needs XML-RPC. */
  jetpack: boolean;
  /** Something stops password guessing: a protection plugin, the lockout or XML-RPC blocked. */
  any: boolean;
};

export function loginProtection(report: Report): LoginProtection {
  const active = report.plugins.filter((p) => p.active).map((p) => slugOf(p.file));
  const plugins = active.flatMap((slug) => (PROTECTION_PLUGINS[slug] ? [{ slug, ...PROTECTION_PLUGINS[slug] }] : []));
  const xmlrpcOff = report.hardening?.xmlrpc_off ?? false;
  const lockout = report.lockout?.active ?? false;
  return { plugins, xmlrpcOff, lockout, jetpack: active.includes("jetpack"), any: plugins.length > 0 || xmlrpcOff || lockout };
}
