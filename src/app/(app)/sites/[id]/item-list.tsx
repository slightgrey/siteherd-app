"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ExternalLink,
  FilePen,
  MoreVertical,
  Power,
  PowerOff,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { pluginAction, setUpdateExcluded } from "@/app/(app)/actions";
import { ItemIcon } from "@/components/item-icons";
import { ToneBadge } from "@/components/report-badges";
import { ItemJobBadge } from "@/components/update-status";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { itemKey, type ItemJobState, type PluginAction, type UpdateItem } from "@/lib/update-types";
import type { Vuln } from "@/lib/vulnerabilities";
import type { HistoryEntry } from "@/lib/updates";
import { HistoryMenu, useRollback } from "./item-history";
import { useStartUpdates } from "./use-start-updates";

type ItemType = "plugin" | "theme";

export type ItemRow = {
  /** Plugin file or theme stylesheet. */
  id: string;
  name: string;
  version: string;
  active: boolean;
  /** Version available, if any. */
  update: string | null;
  excluded: boolean;
  /** Number of files that differ from wordpress.org, when a plugin was edited on the site. */
  edited: number | null;
  /** wordpress.org plugin slug, when the file check confirmed the plugin is listed there. Null for themes. */
  slug: string | null;
  history: HistoryEntry[];
  rollback: { version: string; source: "saved" | "wordpress.org" } | null;
  /** Known vulnerabilities in the installed version, most severe first. */
  vulns: Vuln[];
  /** WP Siteherd itself: it can't be deactivated or deleted remotely. */
  isSelf?: boolean;
};

const filters: { id: string; label: string; test: (r: ItemRow) => boolean; hideWhenEmpty?: boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "updates", label: "Update available", test: (r) => !!r.update && !r.excluded },
  { id: "active", label: "Active", test: (r) => r.active },
  { id: "inactive", label: "Inactive", test: (r) => !r.active },
  { id: "excluded", label: "Excluded updates", test: (r) => r.excluded },
  { id: "edited", label: "Edited", test: (r) => r.edited !== null, hideWhenEmpty: true },
  { id: "vulnerable", label: "Vulnerable", test: (r) => r.vulns.length > 0, hideWhenEmpty: true },
];

/**
 * A site's plugins or themes: filter tabs with counts, select + bulk actions,
 * and one row per item with its icon, version, badges and a menu of actions.
 */
export function ItemList({
  siteId,
  type,
  rows,
  jobStates,
  canManage = false,
}: {
  siteId: string;
  type: ItemType;
  rows: ItemRow[];
  jobStates: Record<string, ItemJobState>;
  /** Plugins only, when the site's plugin supports it (0.7.0+): activate, deactivate, delete. */
  canManage?: boolean;
}) {
  const router = useRouter();
  // Until a tab is picked, show "Update available" when there are updates, else All.
  // Derived on each render, so the list goes back to All once the updates are done.
  const [picked, setFilter] = useState<string | null>(null);
  const hasUpdates = rows.some((r) => !!r.update && !r.excluded);
  const filter = picked ?? (hasUpdates ? "updates" : "all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excluding, startExcluding] = useTransition();
  const [managing, startManaging] = useTransition();
  const [manageError, setManageError] = useState<string | null>(null);
  const keyOf = (r: ItemRow) => itemKey({ type, id: r.id });
  const edited = Object.fromEntries(rows.filter((r) => r.edited !== null).map((r) => [keyOf(r), r.edited!]));
  const updates = useStartUpdates(siteId, edited);

  const stateOf = (r: ItemRow): ItemJobState | "adding" | null =>
    updates.submitting.has(keyOf(r)) ? "adding" : (jobStates[keyOf(r)] ?? null);
  const canUpdate = (r: ItemRow) => !!r.update && !r.excluded && !stateOf(r);

  const active = filters.find((f) => f.id === filter) ?? filters[0];
  const visible = rows.filter(active.test);
  const chosen = visible.filter((r) => selected.has(keyOf(r)));
  const allChosen = visible.length > 0 && chosen.length === visible.length;

  const updateRows = (list: ItemRow[], mode: "one" | "selected") => {
    const items: UpdateItem[] = list.filter(canUpdate).map((r) => ({ type, id: r.id, name: r.name, from: r.version, to: r.update ?? "" }));
    const sent = updates.start(items, mode);
    setSelected((s) => new Set([...s].filter((k) => !sent.includes(k))));
  };
  const manageable = (kind: PluginAction) => (r: ItemRow) =>
    canManage &&
    !stateOf(r) &&
    (kind === "activate" ? !r.active : kind === "deactivate" ? r.active && !r.isSelf : !r.isSelf);
  const manage = (kind: PluginAction, list: ItemRow[]) => {
    const targets = list.filter(manageable(kind));
    if (targets.length === 0) return;
    if (kind === "delete") {
      const names = targets.map((r) => r.name).join(", ");
      const message =
        targets.length === 1
          ? `Delete ${names} from this site?\n\nIt is deactivated first, then WordPress deletes it and runs its uninstall routine, which may remove its settings and data. A copy of the plugin files is kept in wp-content/siteherd-backups for 30 days.`
          : `Delete these ${targets.length} plugins from this site?\n\n${names}\n\nEach is deactivated first, then WordPress deletes it and runs its uninstall routine, which may remove its settings and data. Copies of the plugin files are kept in wp-content/siteherd-backups for 30 days.`;
      if (!confirm(message)) return;
    }
    setManageError(null);
    startManaging(async () => {
      const result = await pluginAction(siteId, kind, targets.map((r) => ({ id: r.id, name: r.name })));
      if (!result.ok) setManageError(result.error);
      setSelected(new Set());
      router.refresh();
    });
  };
  const setExcluded = (list: ItemRow[], excluded: boolean) =>
    startExcluding(async () => {
      for (const r of list) await setUpdateExcluded(siteId, { type, id: r.id }, excluded);
      setSelected(new Set());
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      {updates.error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {updates.error}
        </div>
      )}
      {manageError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {manageError}
        </div>
      )}
      {updates.info && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <FilePen className="mt-0.5 size-4 shrink-0" />
          {updates.info}
        </div>
      )}

      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border p-1" role="tablist" aria-label={`Filter ${type}s`}>
        {filters.map((f) => {
          const n = rows.filter(f.test).length;
          if (f.hideWhenEmpty && n === 0) return null;
          const on = f.id === active.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setFilter(f.id);
                setSelected(new Set());
              }}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1 text-sm transition-colors",
                on ? "border-primary bg-primary/5 font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className={cn("rounded px-1.5 text-xs tabular-nums", on ? "bg-primary/10" : "bg-muted")}>{n}</span>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/40 px-4 py-2.5">
          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={allChosen}
              disabled={visible.length === 0}
              onChange={() => setSelected(allChosen ? new Set() : new Set(visible.map(keyOf)))}
            />
            {chosen.length > 0 ? `${chosen.length} selected` : "Select all"}
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" disabled={!chosen.some(canUpdate)} onClick={() => updateRows(chosen, "selected")}>
              <RefreshCw />
              Update{chosen.some(canUpdate) && ` (${chosen.filter(canUpdate).length})`}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={excluding || !chosen.some((r) => !r.excluded)}
              onClick={() => setExcluded(chosen.filter((r) => !r.excluded), true)}
            >
              <Ban />
              Exclude updates
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={excluding || !chosen.some((r) => r.excluded)}
              onClick={() => setExcluded(chosen.filter((r) => r.excluded), false)}
            >
              <Undo2 />
              Include updates
            </Button>
            {canManage && (
              <>
                <Button variant="ghost" size="sm" disabled={managing || !chosen.some(manageable("activate"))} onClick={() => manage("activate", chosen)}>
                  <Power />
                  Activate
                </Button>
                <Button variant="ghost" size="sm" disabled={managing || !chosen.some(manageable("deactivate"))} onClick={() => manage("deactivate", chosen)}>
                  <PowerOff />
                  Deactivate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:text-red-800 dark:text-red-400"
                  disabled={managing || !chosen.some(manageable("delete"))}
                  onClick={() => manage("delete", chosen)}
                >
                  <Trash2 />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No {type}s match this filter.</p>
        ) : (
          <ul className="divide-y">
            {visible.map((r) => (
              <Item
                key={r.id}
                siteId={siteId}
                type={type}
                row={r}
                state={stateOf(r)}
                selected={selected.has(keyOf(r))}
                onSelect={(on) =>
                  setSelected((s) => {
                    const next = new Set(s);
                    if (on) next.add(keyOf(r));
                    else next.delete(keyOf(r));
                    return next;
                  })
                }
                onUpdate={canUpdate(r) ? () => updateRows([r], "one") : null}
                onExclude={(excluded) => setExcluded([r], excluded)}
                onManage={canManage ? (kind) => manage(kind, [r]) : null}
                manageBusy={managing}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Item({
  siteId,
  type,
  row,
  state,
  selected,
  onSelect,
  onUpdate,
  onExclude,
  onManage,
  manageBusy,
}: {
  siteId: string;
  type: ItemType;
  row: ItemRow;
  state: ItemJobState | "adding" | null;
  selected: boolean;
  onSelect: (on: boolean) => void;
  /** Null when there's nothing to update or it's excluded/busy. */
  onUpdate: (() => void) | null;
  onExclude: (excluded: boolean) => void;
  /** Activate / deactivate / delete, when the site supports it. */
  onManage: ((kind: PluginAction) => void) | null;
  manageBusy: boolean;
}) {
  const back = useRollback({
    siteId,
    item: { type, id: row.id, name: row.name },
    currentVersion: row.version,
    entries: row.history,
    rollback: row.rollback,
  });
  const busy = !!state || back.pending;
  const wporgUrl = row.slug ? `https://wordpress.org/plugins/${row.slug}/` : null;

  const badges = (
    <>
      {row.vulns.length > 0 && <VulnBadge vulns={row.vulns} />}
      {row.edited !== null && (
        <span title={`${row.edited} ${row.edited === 1 ? "file differs" : "files differ"} from wordpress.org. Updating overwrites the edits.`}>
          <ToneBadge t="warn">Edited</ToneBadge>
        </span>
      )}
      {row.excluded && (
        <span title="Not updated from the dashboard">
          <ToneBadge t="muted">Excluded</ToneBadge>
        </span>
      )}
      {/* Only one theme is active, so mark that one; for plugins, mark the inactive ones. */}
      {type === "theme" ? row.active && <ToneBadge t="good">Active</ToneBadge> : !row.active && <ToneBadge t="muted">Inactive</ToneBadge>}
    </>
  );

  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", selected && "bg-muted/40")}>
      <input
        type="checkbox"
        aria-label={`Select ${row.name}`}
        className="size-4 shrink-0 accent-primary"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
      />
      <ItemIcon type={type} id={row.id} slug={row.slug} />

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium" title={row.id}>
          {row.name}
        </div>
        <div className="flex items-center gap-2 text-sm">
          {wporgUrl && (
            <>
              <a href={`${wporgUrl}#developers`} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                Changelog
              </a>
              <span className="text-muted-foreground/50">|</span>
            </>
          )}
          <HistoryMenu siteId={siteId} entries={row.history} trigger="link" />
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 md:hidden">{badges}</div>
        {back.error && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{back.error}</p>}
      </div>

      <div className="w-36 shrink-0 text-sm">
        <Version row={row} />
      </div>
      <div className="hidden w-52 shrink-0 flex-wrap justify-end gap-1.5 md:flex">{badges}</div>
      <div className="flex w-32 shrink-0 items-center justify-end gap-1">
        {busy && <ItemJobBadge state={state === "adding" ? null : state} />}
        {!busy && onUpdate && (
          <Button variant="outline" size="xs" onClick={onUpdate}>
            Update
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "icon-xs" })} aria-label={`Actions for ${row.name}`}>
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {row.update && (
              <DropdownMenuItem disabled={!onUpdate} onClick={() => onUpdate?.()}>
                <RefreshCw />
                Update to {row.update}
              </DropdownMenuItem>
            )}
            {row.rollback && (
              <DropdownMenuItem disabled={busy} onClick={back.run}>
                <RotateCcw />
                {back.label}
              </DropdownMenuItem>
            )}
            {(row.update || row.rollback) && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => onExclude(!row.excluded)}>
              {row.excluded ? <Undo2 /> : <Ban />}
              {row.excluded ? "Include in updates" : "Exclude from updates"}
            </DropdownMenuItem>
            {onManage && (
              <>
                <DropdownMenuSeparator />
                {row.active ? (
                  <DropdownMenuItem disabled={busy || manageBusy || row.isSelf} onClick={() => onManage("deactivate")}>
                    <PowerOff />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled={busy || manageBusy} onClick={() => onManage("activate")}>
                    <Power />
                    Activate
                  </DropdownMenuItem>
                )}
                {!row.isSelf && (
                  <DropdownMenuItem variant="destructive" disabled={busy || manageBusy} onClick={() => onManage("delete")}>
                    <Trash2 />
                    Delete…
                  </DropdownMenuItem>
                )}
              </>
            )}
            {wporgUrl && <DropdownMenuSeparator />}
            {wporgUrl && (
              <DropdownMenuItem onClick={() => window.open(wporgUrl, "_blank", "noopener")}>
                <ExternalLink />
                View on wordpress.org
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function Version({ row }: { row: ItemRow }) {
  if (row.update && !row.excluded) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">{row.version}</span>
        <span className="text-muted-foreground">→</span>
        <ToneBadge t="warn">{row.update}</ToneBadge>
      </div>
    );
  }
  return (
    <div>
      <span className="flex items-center gap-1 font-mono text-xs text-green-700 dark:text-green-400">
        {row.version}
        {!row.update && <CheckCircle2 className="size-3.5" />}
      </span>
      {row.update && <span className="text-xs text-muted-foreground">{row.update} available</span>}
    </div>
  );
}

/** Red badge with the worst rating; the tooltip lists each vulnerability and its fix. */
function VulnBadge({ vulns }: { vulns: Vuln[] }) {
  const worst = vulns[0];
  const label = worst.rating ? `${worst.rating} risk` : "Vulnerable";
  const lines = vulns.map((v) => `• ${v.title}${v.fixedIn ? ` (fixed in ${v.fixedIn})` : " (no fix yet)"}`);
  return (
    <span title={lines.join("\n")}>
      <ToneBadge t="bad">
        <ShieldAlert />
        {vulns.length > 1 ? `${label} · ${vulns.length}` : label}
      </ToneBadge>
    </span>
  );
}
