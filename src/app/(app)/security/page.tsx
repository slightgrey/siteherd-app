import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { IntegrityBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VulnerabilitiesCard, groupFleetVulns } from "@/components/vulnerabilities-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { loadFleet } from "@/lib/fleet";
import { integrityProblems } from "@/lib/report";

export const metadata = { title: "Security & Vulnerability · WP Siteherd" };

export default function SecurityPage() {
  return (
    <>
      <PageHeader title="Security & Vulnerability" description="Known vulnerabilities and file integrity across all your sites. Failed logins are under Login attacks." />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading…</p>}>
        <SecurityOverview />
      </Suspense>
    </>
  );
}

async function SecurityOverview() {
  const { sites, now } = await loadFleet();
  const reported = sites.filter((s) => s.report);
  if (reported.length === 0) {
    return <EmptyState title="No reports yet">Security data appears once your sites start reporting.</EmptyState>;
  }

  // Problems first, then sites that couldn't be verified, then the rest.
  const rank = (s: (typeof reported)[number]) => {
    const p = integrityProblems(s.report!.integrity);
    if (!p) return 2;
    return p.total > 0 ? 0 : p.coreError ? 1 : 3;
  };
  const byIntegrity = [...reported].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  return (
    <div className="mt-6 grid gap-6">
      <VulnerabilitiesCard groups={groupFleetVulns(reported)} now={now} updatesHref="/updates/plugins" />
      <Card>
        <CardHeader>
          <CardTitle>File integrity</CardTitle>
          <CardDescription>
            WordPress core and wordpress.org plugins compared with official checksums once a day. Changed files can mean
            tampering or malware.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Core</TableHead>
                <TableHead>Plugins</TableHead>
                <TableHead>Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byIntegrity.map((site) => {
                const integrity = site.report!.integrity;
                const p = integrityProblems(integrity);
                const checked = integrity ? new Date(integrity.checked_at) : null;
                return (
                  <TableRow key={site.id}>
                    <TableCell>
                      <Link href={`/sites/${site.id}`} className="font-medium hover:underline">
                        {site.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <IntegrityBadge integrity={integrity} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {!p ? "—" : p.coreError ? "Couldn't verify" : p.coreFiles ? `${p.coreFiles} ${p.coreFiles === 1 ? "file" : "files"}` : "OK"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {!p ? "—" : p.plugins.length ? p.plugins.map((x) => site.report!.plugins.find((pl) => pl.file === x.file)?.name ?? x.file).join(", ") : "OK"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {checked && !Number.isNaN(checked.getTime()) ? timeAgo(checked, now) : "Not yet"}
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
