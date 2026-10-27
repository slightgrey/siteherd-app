import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { loadBulkItems } from "@/lib/bulk-updates";
import type { UpdateType } from "@/lib/update-types";
import { BulkUpdateList } from "./bulk-update-list";

const titles: Record<UpdateType, { title: string; description: string }> = {
  plugin: { title: "Plugins", description: "Plugin updates across all your sites. Open a plugin to pick sites, or tick it to update it everywhere." },
  theme: { title: "Themes", description: "Theme updates across all your sites. Open a theme to pick sites, or tick it to update it everywhere." },
  core: {
    title: "Core",
    description: "WordPress updates across all your sites. Plugins and themes in the same run go first; core can't be rolled back automatically.",
  },
  translations: { title: "Translations", description: "Language pack updates across all your sites. Each site installs all of its packs at once." },
};

/** The body of /updates/{plugins,themes,core,translations}. */
export function BulkUpdatePage({ type }: { type: UpdateType }) {
  return (
    <>
      <PageHeader title={`Bulk update · ${titles[type].title}`} description={titles[type].description} />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading…</p>}>
        <Items type={type} />
      </Suspense>
    </>
  );
}

async function Items({ type }: { type: UpdateType }) {
  const { items, active } = await loadBulkItems(type);
  return <BulkUpdateList type={type} items={items} active={active} />;
}
