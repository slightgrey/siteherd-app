import { SiteForm } from "./site-form";

export const metadata = { title: "Add site · WP Siteherd" };

export default function NewSitePage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold">Add a site</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ll get a connection key to paste into the plugin on that WordPress site.
      </p>
      <SiteForm />
    </div>
  );
}
