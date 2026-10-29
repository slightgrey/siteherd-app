"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AGENCY_NAME_MAX, brandSubtitle, fleetTitle, normalizeAgencyName, pluginLabel } from "@/lib/white-label";
import { saveWhiteLabel } from "../../actions";

export function WhiteLabelForm({ agencyName }: { agencyName: string }) {
  const router = useRouter();
  const [name, setName] = useState(agencyName);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const preview = normalizeAgencyName(name);
  const changed = preview !== normalizeAgencyName(agencyName);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveWhiteLabel(name);
      setSaved(true);
      router.refresh();
    });
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>White label</CardTitle>
        <CardDescription>Show your agency&apos;s name in the dashboard and in the plugin on your clients&apos; sites.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="agency-name">Agency name</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="agency-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. My Agency"
                maxLength={AGENCY_NAME_MAX}
                className="w-72"
              />
              <Button type="submit" disabled={pending || !changed}>
                Save
              </Button>
              {saved && !changed && (
                <span className="flex items-center gap-1 text-sm text-good">
                  <Check className="size-4" />
                  Saved
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Leave it empty to use the defaults.</p>
          </div>

          <dl className="grid gap-x-6 gap-y-2 rounded-lg bg-muted/60 p-4 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Under the logo</dt>
            <dd className="font-medium">{brandSubtitle(preview)}</dd>
            <dt className="text-muted-foreground">Dashboard title</dt>
            <dd className="font-medium">{fleetTitle(preview)}</dd>
            <dt className="text-muted-foreground">Plugin on your sites</dt>
            <dd className="font-medium">{pluginLabel(preview)}</dd>
          </dl>

          <p className="text-xs text-muted-foreground">
            Connected sites pick up the new name with their next report (within about 10 minutes), or straight away when you
            click Resync on a site. Sites need WP Siteherd 0.11.0 or later. The Plugins list on each site keeps showing WP Siteherd.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
