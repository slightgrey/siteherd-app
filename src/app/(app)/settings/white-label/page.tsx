import { connection } from "next/server";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { loadUserSettings } from "@/lib/user-settings";
import { WhiteLabelForm } from "./white-label-form";

export const metadata = { title: "White label · SiteHerd" };

export default function WhiteLabelPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
      <WhiteLabel />
    </Suspense>
  );
}

async function WhiteLabel() {
  const user = await requireUser();
  await connection();
  const settings = await loadUserSettings(user.id);
  return <WhiteLabelForm agencyName={settings.agencyName ?? ""} />;
}
