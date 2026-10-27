import { AttentionCard, ConnectionCard, connectionKeyFor, OverviewStats, SectionTitle, WithSite } from "./sections";

export const metadata = { title: "Site overview · WP Siteherd" };

export default function SiteOverviewPage({ params }: PageProps<"/sites/[id]">) {
  return (
    <WithSite params={params}>
      {(data) =>
        data.report ? (
          <div className="grid gap-6">
            <AttentionCard data={data} />
            <OverviewStats data={{ ...data, report: data.report }} />
          </div>
        ) : (
          <>
            <SectionTitle title="Connect this site" description="No report yet. Install the plugin and paste this key to start monitoring." />
            <ConnectionCard connectionKey={connectionKeyFor(data.site)} siteUrl={data.site.url} />
          </>
        )
      }
    </WithSite>
  );
}
