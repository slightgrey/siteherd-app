"use client";

import { Plus, Settings2, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { setSiteLabelAction } from "@/app/(app)/actions";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LABEL_COLORS, type LabelColor } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

type Label = { id: string; name: string; color: LabelColor };

export function LabelChip({ label, className }: { label: Pick<Label, "name" | "color">; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", LABEL_COLORS[label.color].chip, className)}>
      {label.name}
    </span>
  );
}

/**
 * A site's labels as chips, plus a menu to put labels on it or take them off.
 * Changes show at once and are saved in the background.
 */
export function LabelPicker({ siteId, labels, assigned }: { siteId: string; labels: Label[]; assigned: string[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ids, setIds] = useOptimistic(assigned);
  const mine = labels.filter((l) => ids.includes(l.id));

  const toggle = (labelId: string, on: boolean) =>
    startTransition(async () => {
      setIds((current) => (on ? [...current, labelId] : current.filter((id) => id !== labelId)));
      await setSiteLabelAction(siteId, labelId, on);
      router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-1">
      {mine.map((l) => (
        <LabelChip key={l.id} label={l} />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "h-5 px-1.5 text-muted-foreground")}
          aria-label="Edit labels"
          title="Edit labels"
        >
          {mine.length === 0 ? (
            <>
              <Tag /> Label
            </>
          ) : (
            <Plus />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Labels</DropdownMenuLabel>
            {labels.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet.</p>}
            {labels.map((l) => (
              <DropdownMenuCheckboxItem key={l.id} checked={ids.includes(l.id)} onCheckedChange={(on) => toggle(l.id, on)}>
                <span className={cn("size-2 shrink-0 rounded-full", LABEL_COLORS[l.color].dot)} />
                <span className="truncate">{l.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/labels")}>
            <Settings2 />
            {labels.length === 0 ? "Create labels" : "Manage labels"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
