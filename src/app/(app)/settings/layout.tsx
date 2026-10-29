import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <>
      <PageHeader title="Settings" description="Account-wide settings for your dashboard and the sites connected to it." />
      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
