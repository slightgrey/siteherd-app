import { ScrollToHash } from "@/components/scroll-to-hash";
import { VulnerabilitiesCard } from "@/components/vulnerabilities-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CoreIntegrity, PluginIntegrityList, SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Security · WP Siteherd" };

export default function SiteSecurityPage({ params }: PageProps<"/sites/[id]/security">) {
  return (
    <>
      <SectionTitle
        title="Security"
        description="Known vulnerabilities in what is installed, files compared with official wordpress.org checksums once a day. Failed logins are under Logins."
      />
      <WithSite params={params} needsReport>
        {({ report, now, vulns, site }) => (
          <div className="grid gap-6">
            <ScrollToHash />
            <div id="vulnerabilities" className="scroll-mt-6">
              <VulnerabilitiesCard groups={vulns.map((item) => ({ item }))} now={now} updatesHref={`/sites/${site.id}/plugins`} />
            </div>
            {/* Anchors used by links from the Sites list (scroll-mt keeps the title clear of the top). */}
            <Card id="core-files" className="scroll-mt-6">
              <CardHeader>
                <CardTitle>WordPress core</CardTitle>
              </CardHeader>
              <CardContent>
                <CoreIntegrity integrity={report.integrity} now={now} />
              </CardContent>
            </Card>
            <Card id="plugin-files" className="scroll-mt-6">
              <CardHeader>
                <CardTitle>Plugins</CardTitle>
                <CardDescription>Only plugins from the wordpress.org directory have official checksums.</CardDescription>
              </CardHeader>
              <CardContent>
                <PluginIntegrityList integrity={report.integrity} report={report} />
              </CardContent>
            </Card>
          </div>
        )}
      </WithSite>
    </>
  );
}
