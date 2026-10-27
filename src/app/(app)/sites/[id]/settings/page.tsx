import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteSiteButton } from "../delete-site-button";
import { ConnectionCard, connectionKeyFor, SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Site settings · WP Siteherd" };

export default function SiteSettingsPage({ params }: PageProps<"/sites/[id]/settings">) {
  return (
    <>
      <SectionTitle title="Settings" />
      <WithSite params={params}>
        {({ site, lastReport }) => (
          <div className="grid gap-6">
            <ConnectionCard connectionKey={connectionKeyFor(site)} siteUrl={site.url} />

            {lastReport && (
              <Card>
                <CardHeader>
                  <CardTitle>Latest report</CardTitle>
                  <CardDescription>Received {lastReport.receivedAt.toISOString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Show raw JSON</summary>
                    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">
                      {JSON.stringify(lastReport.payload, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            )}

            <Card className="ring-destructive/30">
              <CardHeader>
                <CardTitle>Delete site</CardTitle>
                <CardDescription>
                  Removes the site and all its reports. The plugin on {site.url} will stop connecting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DeleteSiteButton id={site.id} name={site.name} />
              </CardContent>
            </Card>
          </div>
        )}
      </WithSite>
    </>
  );
}
