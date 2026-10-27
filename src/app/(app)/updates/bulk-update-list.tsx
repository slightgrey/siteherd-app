"use client";

import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { updateSiteItems } from "@/app/(app)/actions";
import { ItemIcon, SiteIcon } from "@/components/item-icons";
import { ToneBadge } from "@/components/report-badges";
import { ItemJobBadge } from "@/components/update-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BulkItem, BulkSite } from "@/lib/bulk-updates";
import type { UpdateType } from "@/lib/update-types";
import { cn } from "@/lib/utils";

// The site tab where each kind of update lives.
const siteTab: Record<UpdateType, string> = { plugin: "plugins", theme: "themes", core: "core", translations: "translations" };
const nouns: Record<UpdateType, string> = { plugin: "plugins", theme: "themes", core: "WordPress updates", translations: "translation updates" };

type Pair = { item: BulkItem; site: BulkSite };
const pairKey = (siteId: string, itemKey: string) => `${siteId}|${itemKey}`;

/** A checkbox that can also show "some selected". */
function TriCheckbox({ checked, indeterminate, ...props }: React.ComponentProps<"input"> & { indeterminate: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} className="size-4 shrink-0 accent-primary" {...props} />;
}

/**
 * Bulk updates of one kind across sites, styled like a site's Plugins list.
 * Each item lists the sites it can be updated on; ticking the item ticks all
 * of them, or pick single sites. Starting an update sends one job per site
 * (queued behind anything already running there).
 */
export function BulkUpdateList({ type, items, active }: { type: UpdateType; items: BulkItem[]; active: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Pairs whose request is on its way; they show "Adding…" until the page refreshes.
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // While anything runs or waits on a site, re-fetch every few seconds to show progress.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, router]);

  const q = query.trim().toLowerCase();
  const visible = items.filter((i) => !q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
  const selectable = (item: BulkItem) =>
    item.sites.filter((s) => !s.excluded && !s.job && !submitting.has(pairKey(s.siteId, item.key)));
  const allPairs = visible.flatMap((item) => selectable(item).map((site) => ({ item, site })));
  const chosen = allPairs.filter((p) => selected.has(pairKey(p.site.siteId, p.item.key)));

  const toggle = (keys: string[], on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  /** Start (or queue) updates for these item/site pairs: one request per site. */
  const start = async (requested: Pair[]) => {
    let pairs = requested;
    if (pairs.length === 0) return;
    const coreSites = pairs.filter((p) => p.item.type === "core").length;
    if (
      coreSites > 0 &&
      !confirm(`Update WordPress on ${coreSites} ${coreSites === 1 ? "site" : "sites"}?\n\nCore updates can't be rolled back automatically.`)
    ) {
      return;
    }
    const edited = pairs.filter((p) => p.site.edited !== null);
    let overwrite = false;
    if (edited.length > 0) {
      const list = edited.map((p) => `• ${p.item.name} on ${p.site.siteName}`).join("\n");
      overwrite = confirm(
        `These plugins have edited files that the update would overwrite:\n${list}\n\nThe edited versions are kept on each site and can be restored with Rollback for 30 days.\n\nOK updates them too. Cancel skips them.`,
      );
      if (!overwrite) pairs = pairs.filter((p) => p.site.edited === null);
      if (pairs.length === 0) return;
    }

    const keys = pairs.map((p) => pairKey(p.site.siteId, p.item.key));
    const bySite = new Map<string, Pair[]>();
    for (const p of pairs) bySite.set(p.site.siteId, [...(bySite.get(p.site.siteId) ?? []), p]);

    setBusy(true);
    setSubmitting((s) => new Set([...s, ...keys]));
    toggle(keys, false);
    let started = 0;
    let queued = 0;
    const errors: string[] = [];
    for (const [i, [siteId, list]] of [...bySite].entries()) {
      setMessage({ ok: true, text: `Starting on site ${i + 1} of ${bySite.size}…` });
      const result = await updateSiteItems(
        siteId,
        list.map(({ item, site }) => ({ type: item.type, id: item.id, ...(overwrite && site.edited !== null ? { overwriteEdits: true } : {}) })),
      );
      if (!result.ok) errors.push(`${list[0].site.siteName}: ${result.error}`);
      else if (result.queued) queued++;
      else started++;
    }
    const sites = (n: number) => `${n} ${n === 1 ? "site" : "sites"}`;
    const done = [started > 0 && `Started on ${sites(started)}`, queued > 0 && `queued on ${sites(queued)} (after what's running there)`]
      .filter(Boolean)
      .join(", ");
    setMessage(
      errors.length === 0
        ? { ok: true, text: `${done}.` }
        : { ok: false, text: `${done ? `${done}. ` : ""}Couldn't start on ${sites(errors.length)}: ${errors.join(" · ")}` },
    );
    setBusy(false);
    // Clear "Adding…" in the same commit as the refreshed data.
    startTransition(() => {
      router.refresh();
      setSubmitting((s) => new Set([...s].filter((k) => !keys.includes(k))));
    });
  };

  if (items.length === 0) {
    return <p className="mt-10 text-center text-sm text-muted-foreground">No {nouns[type]} pending on any site. Everything is up to date.</p>;
  }

  const allChosen = allPairs.length > 0 && chosen.length === allPairs.length;
  return (
    <div className="mt-6 grid gap-4">
      {type === "plugin" || type === "theme" ? (
        <div className="relative w-fit">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${nouns[type]}`}
            aria-label={`Search ${nouns[type]}`}
            className="h-8 w-64 pl-8"
          />
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/40 px-4 py-2.5">
          <label className="flex items-center gap-3 text-sm font-medium">
            <TriCheckbox
              checked={allChosen}
              indeterminate={chosen.length > 0 && !allChosen}
              disabled={allPairs.length === 0}
              onChange={() => toggle(allPairs.map((p) => pairKey(p.site.siteId, p.item.key)), !allChosen)}
            />
            {chosen.length > 0 ? `${chosen.length} selected` : "Select all"}
          </label>
          {message && (
            <span className={cn("flex items-center gap-1.5 text-sm", message.ok ? "text-muted-foreground" : "text-red-700 dark:text-red-400")}>
              {!message.ok && <AlertTriangle className="size-4 shrink-0" />}
              {message.text}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(expanded.size === visible.length ? new Set() : new Set(visible.map((i) => i.key)))}
            >
              {expanded.size === visible.length ? "Collapse all" : "Expand all"}
            </Button>
            <Button size="sm" disabled={busy || chosen.length === 0} onClick={() => start(chosen)}>
              <RefreshCw className={busy ? "animate-spin" : undefined} />
              Update selected{chosen.length > 0 && ` (${chosen.length})`}
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing matches your search.</p>
        ) : (
          <ul className="divide-y">
            {visible.map((item) => (
              <ItemRow
                key={item.key}
                item={item}
                selectable={selectable(item)}
                selected={selected}
                submitting={submitting}
                open={expanded.has(item.key)}
                busy={busy}
                onToggleOpen={() =>
                  setExpanded((s) => {
                    const next = new Set(s);
                    if (next.has(item.key)) next.delete(item.key);
                    else next.add(item.key);
                    return next;
                  })
                }
                onSelect={toggle}
                onUpdate={(sites) => start(sites.map((site) => ({ item, site })))}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  selectable,
  selected,
  submitting,
  open,
  busy,
  onToggleOpen,
  onSelect,
  onUpdate,
}: {
  item: BulkItem;
  /** Sites this item can be updated on right now. */
  selectable: BulkSite[];
  selected: Set<string>;
  submitting: Set<string>;
  open: boolean;
  busy: boolean;
  onToggleOpen: () => void;
  onSelect: (keys: string[], on: boolean) => void;
  onUpdate: (sites: BulkSite[]) => void;
}) {
  const keys = selectable.map((s) => pairKey(s.siteId, item.key));
  const n = keys.filter((k) => selected.has(k)).length;
  const included = item.sites.filter((s) => !s.excluded);
  const excluded = item.sites.length - included.length;
  const targets = [...new Set(included.map((s) => s.to))];
  const edited = included.filter((s) => s.edited !== null).length;
  const running = included.filter((s) => s.job && !s.job.waiting).length;
  const waiting = included.filter((s) => s.job?.waiting).length;
  const adding = included.filter((s) => submitting.has(pairKey(s.siteId, item.key))).length;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <li>
      <div className={cn("flex items-center gap-3 px-4 py-3", n > 0 && "bg-muted/40")}>
        <TriCheckbox
          aria-label={`Select ${item.name} on all sites`}
          checked={keys.length > 0 && n === keys.length}
          indeterminate={n > 0 && n < keys.length}
          disabled={keys.length === 0}
          onChange={() => onSelect(keys, n !== keys.length)}
        />
        <ItemIcon type={item.type} id={item.id} slug={item.slug} />
        <button type="button" onClick={onToggleOpen} className="group min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="truncate group-hover:underline">{item.name}</span>
            <Chevron className="size-4 shrink-0 text-muted-foreground" />
          </span>
          <span className="block text-sm text-muted-foreground">
            Available on {included.length} {included.length === 1 ? "site" : "sites"}
            {excluded > 0 && ` · excluded on ${excluded}`}
          </span>
        </button>
        <div className="hidden w-36 shrink-0 sm:block">
          {item.type === "translations" ? (
            <span className="text-sm text-muted-foreground">New language packs</span>
          ) : targets.length === 1 ? (
            <ToneBadge t="warn">{targets[0]}</ToneBadge>
          ) : (
            <span className="text-sm text-muted-foreground">{targets.length} versions</span>
          )}
        </div>
        <div className="hidden w-48 shrink-0 flex-wrap justify-end gap-1.5 md:flex">
          {edited > 0 && (
            <span title="Files edited on these sites; updating overwrites the edits">
              <ToneBadge t="warn">Edited on {edited}</ToneBadge>
            </span>
          )}
          {running + adding > 0 && <ToneBadge t="warn">Updating on {running + adding}</ToneBadge>}
          {waiting > 0 && <ToneBadge t="muted">Queued on {waiting}</ToneBadge>}
        </div>
        <div className="flex w-28 shrink-0 justify-end">
          {selectable.length > 0 && (
            <Button variant="outline" size="xs" disabled={busy} onClick={() => onUpdate(selectable)}>
              Update{selectable.length > 1 && ` (${selectable.length})`}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <ul className="divide-y border-t bg-muted/20">
          {item.sites.map((site) => {
            const key = pairKey(site.siteId, item.key);
            const isAdding = submitting.has(key);
            const canPick = !site.excluded && !site.job && !isAdding;
            return (
              <li key={site.siteId} className={cn("flex items-center gap-3 py-2 pr-4 pl-11", selected.has(key) && "bg-muted/40")}>
                <input
                  type="checkbox"
                  aria-label={`Update ${item.name} on ${site.siteName}`}
                  className="size-4 shrink-0 accent-primary"
                  checked={selected.has(key)}
                  disabled={!canPick}
                  onChange={(e) => onSelect([key], e.target.checked)}
                />
                <SiteIcon icon={site.siteIcon} url={site.siteUrl} small />
                <div className="min-w-0 flex-1">
                  <Link href={`/sites/${site.siteId}/${siteTab[item.type]}`} className="truncate text-sm font-medium hover:underline">
                    {site.siteName}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">{site.siteUrl}</div>
                </div>
                <div className="hidden w-36 shrink-0 text-xs sm:block">
                  {site.detail ?? (
                    <span className="font-mono">
                      <span className="text-muted-foreground">{site.from}</span> → {site.to}
                    </span>
                  )}
                </div>
                <div className="flex w-48 shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {site.edited !== null && (
                    <span title={`${site.edited} ${site.edited === 1 ? "file differs" : "files differ"} from wordpress.org`}>
                      <ToneBadge t="warn">Edited</ToneBadge>
                    </span>
                  )}
                  {site.excluded && <ToneBadge t="muted">Excluded</ToneBadge>}
                  {(site.job || isAdding) && <ItemJobBadge state={isAdding ? null : site.job} />}
                </div>
                <div className="w-28 shrink-0" />
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
