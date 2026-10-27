"use client";

import { CheckCircle2, ChevronDown, History, RotateCcw, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HistoryEntry } from "@/lib/updates";
import { rollbackItem } from "../../actions";

function headline(e: HistoryEntry) {
  if (e.kind === "rollback") {
    if (e.status === "updated") return `Rolled back to ${e.to}`;
    if (e.status === "rolled_back") return `Rollback to ${e.to} undone`;
    return `Rollback to ${e.to} failed`;
  }
  if (e.status === "updated") return `Updated to ${e.to}`;
  if (e.status === "rolled_back") return `Update to ${e.to} undone`;
  return `Update to ${e.to ?? "new version"} failed`;
}

function EntryIcon({ e }: { e: HistoryEntry }) {
  if (e.status === "failed") return <XCircle className="size-3.5 shrink-0 text-red-600 dark:text-red-400" />;
  if (e.status === "rolled_back" || e.kind === "rollback") return <RotateCcw className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />;
  return <CheckCircle2 className="size-3.5 shrink-0 text-green-600 dark:text-green-400" />;
}


type Rollback = { version: string; source: "saved" | "wordpress.org" };

/**
 * Rolling a plugin/theme back to `rollback.version`, with a confirmation.
 * If another job runs on the site, the rollback joins the site's queue.
 */
export function useRollback({
  siteId,
  item,
  currentVersion,
  entries,
  rollback,
}: {
  siteId: string;
  item: { type: "plugin" | "theme"; id: string; name: string };
  currentVersion: string;
  entries: HistoryEntry[];
  rollback: Rollback | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [latest] = entries;
  // Right after a rollback, the saved copy is the version we just left: going "back" to it is an undo.
  const isUndo = !!rollback && latest?.kind === "rollback" && latest.status === "updated" && latest.from === rollback.version;

  const run = () => {
    if (!rollback) return;
    const from =
      rollback.source === "saved"
        ? "It uses the copy saved when it was last updated."
        : `Version ${rollback.version} is downloaded from wordpress.org.`;
    const question = isUndo
      ? `Undo the rollback of ${item.name} and go back to ${rollback.version}?`
      : `Roll back ${item.name} from ${currentVersion} to ${rollback.version}?`;
    if (!confirm(`${question}\n\n${from} The current version is backed up first and put back if the site stops loading.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await rollbackItem(siteId, { type: item.type, id: item.id }, rollback.version);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  const label = rollback ? (isUndo ? `Undo rollback (${rollback.version})` : `Roll back to ${rollback.version}`) : null;
  return { run, pending, error, label };
}

/** Dropdown of an item's past updates and rollbacks. `trigger` is its button, or a plain text link. */
export function HistoryMenu({ siteId, entries, trigger = "button" }: { siteId: string; entries: HistoryEntry[]; trigger?: "button" | "link" }) {
  const router = useRouter();
  const [latest] = entries;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          trigger === "link"
            ? "cursor-pointer text-sm text-primary underline-offset-4 hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
            : buttonVariants({ variant: "outline", size: "xs" })
        }
        disabled={!latest}
        title={latest ? `${headline(latest)} · ${latest.when}` : "No updates from the dashboard yet"}
      >
        {trigger === "button" && <History />}
        History{trigger === "button" && ` (${entries.length})`}
        {trigger === "button" && <ChevronDown />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Update history</DropdownMenuLabel>
          {entries.slice(0, 8).map((e, i) => (
            <div key={i} className="flex gap-2 px-2 py-1.5 text-xs">
              <EntryIcon e={e} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{headline(e)}</span>
                  <span className="shrink-0 text-muted-foreground">{e.when}</span>
                </div>
                {e.from && e.to && (
                  <div className="font-mono text-muted-foreground">
                    {e.from} → {e.to}
                  </div>
                )}
                {e.message && <div className="mt-0.5 text-muted-foreground">{e.message}</div>}
              </div>
            </div>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/sites/${siteId}/activity`)}>View all in the Activity log</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
