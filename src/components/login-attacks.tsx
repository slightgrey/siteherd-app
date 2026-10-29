import { FailedLoginsBadge, ToneBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SiteEvent } from "@/db/schema";
import { ATTACK_MIN, type DayTotal } from "@/lib/login-attacks";
import type { LoginProtection } from "@/lib/login-protection";
import { failedLoginSources, type FailedLoginSource, type Report } from "@/lib/report";
import { cn } from "@/lib/utils";
import { DismissEventButton, LockoutControls, LoginTrendChart, SOURCE_COLOR, XmlrpcButton } from "./login-attacks-client";

const SOURCE_HINTS: Partial<Record<FailedLoginSource, string>> = {
  login: "Most come through wp-login.php or another login form. A lockout plugin, a rate limit or challenge on /wp-login.php (server or Cloudflare) and two-factor login for admins help.",
  xmlrpc:
    "Most come through xmlrpc.php, which bots use to guess passwords without loading the login page. Unless Jetpack or the WordPress mobile app needs it, block XML-RPC logins below.",
  rest: "Most come through a REST API login endpoint added by a plugin.",
};

/** Failed logins in the last 24 hours, by source, with a 30-day chart when history exists. */
export function FailedLoginsCard({ report, days }: { report: Report; days: DayTotal[] }) {
  const n = report.failed_logins_24h;
  const sources = failedLoginSources(report);
  const top = sources?.[0];
  const hint = top && n >= ATTACK_MIN ? SOURCE_HINTS[top.source] : undefined;
  const hasHistory = days.some((d) => d.total > 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Failed logins</CardTitle>
        <CardDescription>Counts only, no usernames or IP addresses. Bots guessing passwords cause most of them.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-semibold tabular-nums">{n.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">in the last 24 hours</span>
            {n > 0 && <FailedLoginsBadge count={n} />}
          </div>
          {n > 0 && !sources && (
            <p className="text-sm text-muted-foreground">Update WP Siteherd on this site to 0.8.0 or later to see where they come from.</p>
          )}
          {sources && sources.length > 0 && (
            <ul className="grid gap-2">
              {sources.map((s) => (
                <li key={s.source} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
                  <span>{s.label}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", SOURCE_COLOR[s.source])} style={{ width: `${(s.count / n) * 100}%` }} />
                  </div>
                  <span className="tabular-nums text-muted-foreground">{s.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
          {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Last 30 days</p>
          {hasHistory ? (
            <LoginTrendChart days={days} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {report.schema >= 8 ? "No failed logins recorded yet." : "History starts once the site runs WP Siteherd 0.9.0 or later."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** What protects the site's logins, the XML-RPC switch and a suggestion when nothing does. */
export function ProtectionCard({ siteId, report, protection }: { siteId: string; report: Report; protection: LoginProtection }) {
  const lockout = report.lockout;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Login protection</CardTitle>
        <CardDescription>WP Siteherd&apos;s login lockout, security plugins found on the site, and XML-RPC logins.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Login lockout</span>
            {lockout &&
              (lockout.active ? (
                <ToneBadge t="good">On</ToneBadge>
              ) : lockout.enabled && lockout.conflict ? (
                <ToneBadge t="muted">Paused for {lockout.conflict}</ToneBadge>
              ) : (
                <ToneBadge t="muted">Off</ToneBadge>
              ))}
          </div>
          {!lockout ? (
            <p className="text-sm text-muted-foreground">Update WP Siteherd on this site to 0.10.0 or later to lock out IP addresses that keep guessing passwords.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {lockout.active
                  ? `Last 24 hours: ${lockout.lockouts_24h} ${lockout.lockouts_24h === 1 ? "address" : "addresses"} locked out, ${lockout.blocked_24h} login ${lockout.blocked_24h === 1 ? "attempt" : "attempts"} refused.`
                  : "Refuses logins from an IP address after too many wrong passwords. The 4th lockout of an address within a day lasts 24 hours. One-click login from here always works."}
              </p>
              {lockout.conflict && !lockout.active ? (
                <p className="text-sm text-muted-foreground">{lockout.conflict} already locks out IP addresses, so WP Siteherd&apos;s lockout stays off next to it.</p>
              ) : (
                <LockoutControls key={`${lockout.enabled}-${lockout.max_retries}-${lockout.lockout_minutes}`} siteId={siteId} lockout={lockout} />
              )}
            </>
          )}
        </div>
        <div className="grid gap-2 border-t pt-4">
          {protection.plugins.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Protected by</span>
              {protection.plugins.map((p) => (
                <ToneBadge key={p.slug} t="good">
                  {p.name}
                </ToneBadge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No other security plugin found.</p>
          )}
        </div>
        <div className="grid gap-2 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">XML-RPC logins</span>
            {report.hardening ? (
              protection.xmlrpcOff ? (
                <ToneBadge t="good">Blocked</ToneBadge>
              ) : (
                <ToneBadge t="muted">Allowed</ToneBadge>
              )
            ) : null}
          </div>
          {report.schema >= 8 ? (
            <>
              {protection.jetpack && !protection.xmlrpcOff && (
                <p className="text-sm text-amber-800 dark:text-amber-300">Jetpack is active and needs XML-RPC. Blocking it breaks Jetpack&apos;s connection.</p>
              )}
              <p className="text-sm text-muted-foreground">
                Blocking stops password guessing through xmlrpc.php. The WordPress mobile app and Jetpack need it.
              </p>
              <XmlrpcButton siteId={siteId} off={protection.xmlrpcOff} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Update WP Siteherd on this site to 0.9.0 or later to block XML-RPC logins from here.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** The site's administrators, with any that appeared since an earlier report flagged. */
export function AdministratorsCard({ siteId, report, newAdmins, now }: { siteId: string; report: Report; newAdmins: SiteEvent[]; now: number }) {
  const admins = report.sso?.admins ?? [];
  const isNew = new Map(newAdmins.map((e) => [e.data.id, e]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Administrators</CardTitle>
        <CardDescription>
          A new administrator you didn&apos;t create can mean a password guess worked. New ones stay flagged until you confirm them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!report.sso ? (
          <p className="text-sm text-muted-foreground">Update WP Siteherd on this site to see its administrators.</p>
        ) : (
          <ul className="divide-y">
            {admins.map((a) => {
              const event = isNew.get(a.id);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">{a.name || a.login}</span> <span className="text-muted-foreground">{a.login}</span>
                  </span>
                  {event && (
                    <span className="flex items-center gap-2">
                      <ToneBadge t="bad">New, noticed {timeAgo(event.at, now)}</ToneBadge>
                      <DismissEventButton siteId={siteId} eventId={event.id} />
                    </span>
                  )}
                </li>
              );
            })}
            {/* Flagged admins no longer on the site (removed again, or demoted). */}
            {newAdmins
              .filter((e) => !admins.some((a) => a.id === e.data.id))
              .map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-muted-foreground">
                  <span>
                    {e.data.name || e.data.login} {e.data.login} (no longer an administrator)
                  </span>
                  <DismissEventButton siteId={siteId} eventId={e.id} />
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Seven days of failed logins as tiny bars (one series, so no legend). */
export function LoginSparkline({ days }: { days: DayTotal[] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  return (
    <div className="flex h-6 w-24 items-end gap-0.5" title={days.map((d) => `${d.day}: ${d.total}`).join("\n")}>
      {days.map((d) => (
        <div
          key={d.day}
          className="flex-1 rounded-t-[2px] bg-[#2a78d6] dark:bg-[#3987e5]"
          style={{ height: `${Math.max(d.total > 0 ? 8 : 0, (d.total / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
