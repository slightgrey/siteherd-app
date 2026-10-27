import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { loadLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { LabelsManager } from "./labels-manager";

export const metadata = { title: "Labels · WP Siteherd" };

export default function LabelsPage() {
  return (
    <>
      <PageHeader
        title="Labels"
        description="Group sites, for example by client or agency. Put labels on sites from the Sites list or a site's header, then filter by them."
      />
      <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">Loading labels…</p>}>
        <Labels />
      </Suspense>
    </>
  );
}

async function Labels() {
  const user = await requireUser();
  await connection();
  return <LabelsManager labels={await loadLabels(user.id)} />;
}
