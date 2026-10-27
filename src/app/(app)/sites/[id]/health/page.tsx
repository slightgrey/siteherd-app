import { HealthIssues, SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Site Health · WP Siteherd" };

export default function SiteHealthPage({ params }: PageProps<"/sites/[id]/health">) {
  return (
    <>
      <SectionTitle title="Site Health" description="WordPress's own Site Health checks, run once a day." />
      <WithSite params={params} needsReport>
        {({ report, now }) => <HealthIssues health={report.health} now={now} />}
      </WithSite>
    </>
  );
}
