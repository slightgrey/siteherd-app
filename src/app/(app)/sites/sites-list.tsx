"use client";

import { ExternalLink, RefreshCw, Search, Tag, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { resyncSite, setSiteLabelAction } from "@/app/(app)/actions";
import { SiteIcon } from "@/components/item-icons";
import { LabelPicker } from "@/components/label-picker";
import { StatusBadge, type SiteState } from "@/components/site-status";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { LABEL_COLORS, type LabelColor } from "@/lib/label-colors";
import type { Sso } from "@/lib/report";
import { cn } from "@/lib/utils";
import { ResyncButton } from "./[id]/resync-button";
import { WpAdminButton } from "./[id]/wp-admin-button";

export type SiteListRow = {
  id: string;
  name: string;
  url: string;
  /** The WordPress Site Icon, when the site reports one. */
  icon: string | null;
  lastReport: string | null;
  state: SiteState;
  wp: string | null;
  php: string | null;
  coreUpdate: string | null;
  /** Pending updates (excluded items left out); null before the first report. */
  updates: number | null;
  labelIds: string[];
  sso: Sso | null;
  /** Badges rendered on the server; null before the first report. */
  cells: { updates: React.ReactNode; health: React.ReactNode; security: React.ReactNode; coreUpdate: React.ReactNode } | null;
};

export type SiteFilters = { q: string; label: string; status: string; wp: string; php: string; sort: string };

type Label = { id: string; name: string; color: LabelColor };

const NO_LABEL = "none";
const EMPTY: SiteFilters = { q: "", label: "", status: "", wp: "", php: "", sort: "" };

const tabs: { id: string; label: string; test: (r: SiteListRow) => boolean }[] = [
  { id: "", label: "All", test: () => true },
  { id: "updates", label: "Update available", test: (r) => (r.updates ?? 0) > 0 },
  { id: "ok", label: "Reporting", test: (r) => r.state === "ok" },
  { id: "stale", label: "Stale", test: (r) => r.state === "stale" },
  { id: "never", label: "Not connected", test: (r) => r.state === "never" },
];

// The default ("") puts the sites with the most pending updates first.
const sortOptions = [
  { value: "", label: "Most updates" },
  { value: "updates-asc", label: "Fewest updates" },
  { value: "name", label: "Name" },
];

/** "8.4.12" → "8.4": PHP filters by minor version. */
const phpMinor = (v: string) => v.split(".").slice(0, 2).join(".");

/** Newest version first. */
function byVersionDesc(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pb[i] || 0) - (pa[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

const selectClass =
  "h-8 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * The Sites list, styled like a site's Plugins list: status tabs with counts,
 * search and filters (label, WordPress, PHP), sorting by update count, select
 * + bulk Resync / Label, and one row per site.
 */
export function SitesList({ rows, labels, initial }: { rows: SiteListRow[]; labels: Label[]; initial: SiteFilters }) {
  const router = useRouter();
  const [filters, setFilters] = useState<SiteFilters>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ busy: boolean; text: string | null; ok: boolean }>({ busy: false, text: null, ok: true });

  // Keep the URL in step so the filtered list can be bookmarked or shared.
  const apply = (next: SiteFilters) => {
    setFilters(next);
    setSelected(new Set());
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v));
    window.history.replaceState(null, "", params.size ? `?${params}` : window.location.pathname);
  };
  const set = (key: keyof SiteFilters, value: string) => apply({ ...filters, [key]: value });

  const wpVersions = useMemo(() => [...new Set(rows.flatMap((r) => (r.wp ? [r.wp] : [])))].sort(byVersionDesc), [rows]);
  const phpVersions = useMemo(() => [...new Set(rows.flatMap((r) => (r.php ? [phpMinor(r.php)] : [])))].sort(byVersionDesc), [rows]);

  // Search and dropdown filters first; the tab counts are for what they leave.
  const q = filters.q.trim().toLowerCase();
  const matching = rows
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q))
    .filter((r) => !filters.label || (filters.label === NO_LABEL ? r.labelIds.length === 0 : r.labelIds.includes(filters.label)))
    .filter((r) => !filters.wp || (filters.wp === "outdated" ? !!r.coreUpdate : r.wp === filters.wp))
    .filter((r) => !filters.php || (r.php !== null && phpMinor(r.php) === filters.php));
  const tab = tabs.find((t) => t.id === filters.status) ?? tabs[0];
  const visible = matching.filter(tab.test).sort((a, b) => {
    // Sites without a report have no update count; keep them last either way.
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    if (filters.sort === "updates-asc") return (a.updates ?? Infinity) - (b.updates ?? Infinity) || a.name.localeCompare(b.name);
    return (b.updates ?? -1) - (a.updates ?? -1) || a.name.localeCompare(b.name);
  });
  const filtered = filters.q || filters.label || filters.wp || filters.php;

  const chosen = visible.filter((r) => selected.has(r.id));
  const allChosen = visible.length > 0 && chosen.length === visible.length;

  const resyncChosen = async () => {
    const list = chosen;
    let failed = 0;
    for (const [i, site] of list.entries()) {
      setBulk({ busy: true, text: `Resyncing ${i + 1} of ${list.length}…`, ok: true });
      const result = await resyncSite(site.id);
      if (!result.ok) failed++;
    }
    const synced = list.length - failed;
    setBulk({
      busy: false,
      ok: failed === 0,
      text: failed === 0 ? `Resynced ${synced} ${synced === 1 ? "site" : "sites"}.` : `${synced} resynced, ${failed} failed. Resync those on their own to see why.`,
    });
    router.refresh();
  };

  /** Put a label on every selected site, or take it off all of them. */
  const labelChosen = async (labelId: string, on: boolean) => {
    const list = chosen.filter((r) => r.labelIds.includes(labelId) !== on);
    setBulk({ busy: true, text: "Saving labels…", ok: true });
    for (const site of list) await setSiteLabelAction(site.id, labelId, on);
    setBulk({ busy: false, text: null, ok: true });
    router.refresh();
  };

  return (
    <div className="mt-6 grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Search sites"
            aria-label="Search sites"
            className="h-8 w-56 pl-8"
          />
        </div>
        <select className={selectClass} value={filters.label} onChange={(e) => set("label", e.target.value)} aria-label="Label">
          <option value="">All labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          <option value={NO_LABEL}>No label</option>
        </select>
        <select className={selectClass} value={filters.wp} onChange={(e) => set("wp", e.target.value)} aria-label="WordPress version">
          <option value="">Any WordPress</option>
          <option value="outdated">WordPress update available</option>
          {wpVersions.map((v) => (
            <option key={v} value={v}>
              WordPress {v}
            </option>
          ))}
        </select>
        <select className={selectClass} value={filters.php} onChange={(e) => set("php", e.target.value)} aria-label="PHP version">
          <option value="">Any PHP</option>
          {phpVersions.map((v) => (
            <option key={v} value={v}>
              PHP {v}
            </option>
          ))}
        </select>
        <select className={selectClass} value={filters.sort} onChange={(e) => set("sort", e.target.value)} aria-label="Sort by">
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => apply({ ...EMPTY, status: filters.status, sort: filters.sort })}>
            <X />
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-lg border p-1" role="tablist" aria-label="Filter sites by status">
        {tabs.map((t) => {
          const n = matching.filter(t.test).length;
          const on = t.id === tab.id;
          return (
            <button
              key={t.id || "all"}
              role="tab"
              aria-selected={on}
              onClick={() => set("status", t.id)}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-1 text-sm transition-colors",
                on ? "border-primary bg-primary/5 font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
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
              onChange={() => setSelected(allChosen ? new Set() : new Set(visible.map((r) => r.id)))}
            />
            {chosen.length > 0 ? `${chosen.length} selected` : "Select all"}
          </label>
          {bulk.text && <span className={cn("text-sm", bulk.ok ? "text-muted-foreground" : "text-red-700 dark:text-red-400")}>{bulk.text}</span>}
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button variant="ghost" size="sm" disabled={bulk.busy || chosen.length === 0} onClick={resyncChosen}>
              <RefreshCw className={bulk.busy ? "animate-spin" : undefined} />
              Resync
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", size: "sm" })} disabled={bulk.busy || chosen.length === 0}>
                <Tag />
                Label
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Label {chosen.length} {chosen.length === 1 ? "site" : "sites"}</DropdownMenuLabel>
                  {labels.length === 0 && <p className="px-2 py-1.5 text-xs text-muted-foreground">No labels yet.</p>}
                  {labels.map((l) => {
                    const count = chosen.filter((r) => r.labelIds.includes(l.id)).length;
                    return (
                      <DropdownMenuCheckboxItem
                        key={l.id}
                        checked={count > 0 && count === chosen.length}
                        onCheckedChange={(on) => labelChosen(l.id, on)}
                      >
                        <span className={cn("size-2 shrink-0 rounded-full", LABEL_COLORS[l.color].dot)} />
                        <span className="truncate">{l.name}</span>
                        {count > 0 && count < chosen.length && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/labels")}>{labels.length === 0 ? "Create labels" : "Manage labels"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Column names, aligned with the row cells below (wide screens only). */}
        <div className="hidden items-center gap-3 border-b px-4 pt-4 pb-2.5 text-sm font-semibold text-foreground lg:flex">
          <span className="w-4 shrink-0" />
          <span className="w-9 shrink-0" />
          <span className="min-w-0 flex-1">Site</span>
          <span className="w-32 shrink-0">WordPress</span>
          <span className="w-16 shrink-0">PHP</span>
          <span className="w-28 shrink-0">Updates</span>
          <span className="w-36 shrink-0">Site Health</span>
          <span className="w-44 shrink-0">Security</span>
          <span className="w-44 shrink-0" />
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">No sites match these filters.</p>
        ) : (
          <ul className="divide-y">
            {visible.map((site) => (
              <SiteItem
                key={site.id}
                site={site}
                labels={labels}
                selected={selected.has(site.id)}
                onSelect={(on) =>
                  setSelected((s) => {
                    const next = new Set(s);
                    if (on) next.add(site.id);
                    else next.delete(site.id);
                    return next;
                  })
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SiteItem({ site, labels, selected, onSelect }: { site: SiteListRow; labels: Label[]; selected: boolean; onSelect: (on: boolean) => void }) {
  return (
    <li className={cn("flex flex-wrap items-center gap-3 px-4 py-3 lg:flex-nowrap", selected && "bg-muted/40")}>
      <input
        type="checkbox"
        aria-label={`Select ${site.name}`}
        className="size-4 shrink-0 accent-primary"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
      />
      <SiteIcon icon={site.icon} url={site.url} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/sites/${site.id}`} className="truncate font-medium hover:underline">
            {site.name}
          </Link>
          {/* Only the states that need attention; "Reporting" is the normal case. */}
          {site.state !== "ok" && <StatusBadge state={site.state} />}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 align-bottom hover:text-foreground hover:underline"
          >
            <span className="truncate">{site.url}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          {site.lastReport && ` · ${site.lastReport}`}
        </div>
        <div className="mt-1">
          <LabelPicker siteId={site.id} labels={labels} assigned={site.labelIds} />
        </div>
      </div>

      {site.cells ? (
        <>
          <div className="w-32 shrink-0 font-mono text-xs">
            <span className="text-muted-foreground lg:hidden">WordPress </span>
            {site.wp || "—"}
            {site.cells.coreUpdate && <div className="mt-1">{site.cells.coreUpdate}</div>}
          </div>
          <div className="w-16 shrink-0 font-mono text-xs">
            <span className="text-muted-foreground lg:hidden">PHP </span>
            {site.php || "—"}
          </div>
          <div className="w-28 shrink-0">{site.cells.updates}</div>
          <div className="w-36 shrink-0">{site.cells.health}</div>
          <div className="w-44 shrink-0">{site.cells.security}</div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground lg:w-[29rem] lg:shrink-0">Waiting for the first report</div>
      )}

      <div className="flex w-44 shrink-0 items-start justify-end gap-1.5">
        <ResyncButton siteId={site.id} compact />
        <WpAdminButton siteId={site.id} siteUrl={site.url} sso={site.sso} compact />
      </div>
    </li>
  );
}
