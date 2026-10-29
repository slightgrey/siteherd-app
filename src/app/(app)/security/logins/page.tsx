import Link from "next/link";
import { Suspense } from "react";
import { BlockAllXmlrpcButton, LockoutAllButton, XmlrpcButton } from "@/components/login-attacks-client";
import { LoginSparkline } from "@/components/login-attacks";
import { EmptyState, PageHeader } from "@/components/page-header";
import { ToneBadge } from "@/components/report-badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadFleet, siteLoginAttention } from "@/lib/fleet";
import { fillDays } from "@/lib/login-attacks";
import { loginProtection } from "@/lib/login-protection";
import { failedLoginSources } from "@/lib/report";

export const metadata = { title: "Login attacks · WP Siteherd" };

export default function LoginAttacksPage() {
  return (
    <>
      <PageHeader
        title="Login attacks"
        description="Failed logins, where they come from and what protects each site. Counts only, no usernames or IP addresses."
      />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading…</p>}>
        <LoginAttacks />
      </Suspense>
    </>
  );
}

async function LoginAttacks() {
  const { sites, now } = await loadFleet();
  const reported = sites.filter((s) => s.report);
  if (reported.length === 0) {
    return <EmptyState title="No reports yet">Login data appears once your sites start reporting.</EmptyState>;
  }

  const rows = reported
    .map((site) => {
      const report = site.report!;
      return {
        site,
        report,
        protection: loginProtection(report),
        sources: failedLoginSources(report),
        attention: siteLoginAttention({ ...site, now }),
        days: fillDays(site.loginDays, 7, now),
      };
    })
    .sort((a, b) => b.site.newAdmins.length - a.site.newAdmins.length || b.report.failed_logins_24h - a.report.failed_logins_24h);

  const newAdmins = rows.flatMap((r) => r.site.newAdmins.map((e) => ({ site: r.site, event: e })));
  // Sites where blocking XML-RPC from here works and wouldn't break Jetpack.
  const canBlock = rows.filter((r) => r.report.schema >= 8 && !r.protection.xmlrpcOff && !r.protection.jetpack);
  // Sites where the lockout can be turned on: plugin 0.10.0+, off, and no other lockout plugin.
  const canLock = rows.filter((r) => r.report.lockout && !r.report.lockout.enabled && !r.report.lockout.conflict);

  return (
    <div className="mt-6 grid gap-6">
      {newAdmins.length > 0 && (
        <Card className="border-bad/40">
          <CardHeader>
            <CardTitle>New administrators</CardTitle>
            <CardDescription>Accounts that became administrators since an earlier report. If you didn&apos;t add them, the site may be compromised.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {newAdmins.map(({ site, event }) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">{event.data.name || event.data.login}</span>{" "}
                    <span className="text-muted-foreground">({event.data.login}) on</span>{" "}
                    <Link href={`/sites/${site.id}/logins`} className="font-medium hover:underline">
                      {site.name}
                    </Link>
                  </span>
                  <Link href={`/sites/${site.id}/logins`} className="text-sm text-muted-foreground hover:underline">
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1.5">
            <CardTitle>Failed logins by site</CardTitle>
            <CardDescription>Last 24 hours, and the last 7 days per day.</CardDescription>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {canLock.length > 0 && <LockoutAllButton sites={canLock.map((r) => ({ id: r.site.id, name: r.site.name }))} />}
            {canBlock.length > 0 && <BlockAllXmlrpcButton sites={canBlock.map((r) => ({ id: r.site.id, name: r.site.name }))} />}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>24 hours</TableHead>
                <TableHead>7 days</TableHead>
                <TableHead>Mostly through</TableHead>
                <TableHead>Protection</TableHead>
                <TableHead>XML-RPC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ site, report, protection, sources, attention, days }) => {
                const n = report.failed_logins_24h;
                return (
                  <TableRow key={site.id}>
                    <TableCell>
                      <Link href={`/sites/${site.id}/logins`} className="font-medium hover:underline">
                        {site.name}
                      </Link>
                      {attention && <p className="text-xs text-muted-foreground">{attention.text}</p>}
                    </TableCell>
                    <TableCell>
                      {n > 0 ? <ToneBadge t={attention ? attention.severity : "muted"}>{n.toLocaleString()}</ToneBadge> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      {days.some((d) => d.total > 0) ? <LoginSparkline days={days} /> : <span className="text-sm text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sources?.length ? sources.map((s) => `${s.label} ${Math.round((s.count / n) * 100)}%`).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[...(protection.lockout ? ["WP Siteherd lockout"] : []), ...protection.plugins.map((p) => p.name)].join(", ") || "None"}
                    </TableCell>
                    <TableCell>
                      {report.schema < 8 ? (
                        <span className="text-xs text-muted-foreground">Needs plugin 0.9.0</span>
                      ) : protection.jetpack && !protection.xmlrpcOff ? (
                        <span className="text-xs text-muted-foreground">Used by Jetpack</span>
                      ) : (
                        <XmlrpcButton siteId={site.id} off={protection.xmlrpcOff} size="xs" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
