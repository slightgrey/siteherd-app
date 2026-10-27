import { ScrollToHash } from "@/components/scroll-to-hash";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CoreIntegrity, FailedLoginsCard, PluginIntegrityList, SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Files & logins · WP Siteherd" };

export default function SiteSecurityPage({ params }: PageProps<"/sites/[id]/security">) {
  return (
    <>
      <SectionTitle
        title="Files & logins"
        description="Files compared with official wordpress.org checksums once a day. Changed files can mean tampering or malware."
      />
      <WithSite params={params} needsReport>
        {({ report, now }) => (
          <div className="grid gap-6">
            <ScrollToHash />
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
            <div id="logins" className="scroll-mt-6">
              <FailedLoginsCard report={report} />
            </div>
          </div>
        )}
      </WithSite>
    </>
  );
}
