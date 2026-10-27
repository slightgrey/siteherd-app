"use client";

import { Ban, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setUpdateExcluded } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import type { UpdateType } from "@/lib/update-types";

/** "Exclude from updates" / "Include in updates" for one plugin, theme or core on a site. */
export function ExcludeToggle({
  siteId,
  item,
  excluded,
  disabled = false,
}: {
  siteId: string;
  item: { type: UpdateType; id: string; name: string };
  excluded: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      await setUpdateExcluded(siteId, { type: item.type, id: item.id }, !excluded);
      router.refresh();
    });

  return excluded ? (
    <Button variant="outline" size="xs" disabled={disabled || pending} onClick={toggle} title={`Allow updates for ${item.name} again`}>
      <Undo2 />
      Include
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="xs"
      disabled={disabled || pending}
      onClick={toggle}
      title={`Never update ${item.name} from the dashboard`}
      className="text-muted-foreground"
    >
      <Ban />
      Exclude
    </Button>
  );
}
