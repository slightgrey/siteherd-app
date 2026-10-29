import { AdministratorsCard, FailedLoginsCard, ProtectionCard } from "@/components/login-attacks";
import { fillDays } from "@/lib/login-attacks";
import { loginProtection } from "@/lib/login-protection";
import { SectionTitle, WithSite } from "../sections";

export const metadata = { title: "Logins · WP Siteherd" };

export default function SiteLoginsPage({ params }: PageProps<"/sites/[id]/logins">) {
  return (
    <>
      <SectionTitle title="Logins" description="Failed logins and where they come from, login protection, and the site's administrators." />
      <WithSite params={params} needsReport>
        {({ site, report, loginDays, newAdmins, now }) => (
          <div className="grid gap-6">
            <FailedLoginsCard report={report} days={fillDays(loginDays, 30, now)} />
            <div className="grid gap-6 lg:grid-cols-2">
              <ProtectionCard siteId={site.id} report={report} protection={loginProtection(report)} />
              <AdministratorsCard siteId={site.id} report={report} newAdmins={newAdmins} now={now} />
            </div>
          </div>
        )}
      </WithSite>
    </>
  );
}
