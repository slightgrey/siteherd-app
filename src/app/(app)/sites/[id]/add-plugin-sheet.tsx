"use client";

import { AlertTriangle, Check, Download, Loader2, Plus, Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { pluginAction, searchWporgPlugins } from "@/app/(app)/actions";
import { ItemIcon } from "@/components/item-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { WporgPlugin } from "@/lib/wporg";

function installs(n: number) {
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}M+ installs`;
  if (n >= 1000) return `${Math.floor(n / 1000)}K+ installs`;
  return n > 0 ? `${n}+ installs` : "New";
}

/**
 * "Add plugin": search wordpress.org and install a plugin on this site,
 * optionally activating it. Runs as an install job in the site's queue.
 */
export function AddPluginSheet({ siteId, installed }: { siteId: string; installed: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WporgPlugin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [installing, setInstalling] = useState<string | null>(null);
  // Slugs requested in this session, shown as "Added to queue" until the report lists them.
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const installedSet = new Set(installed);

  // Search as the user types, after a short pause.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(
      () =>
        startSearch(async () => {
          const result = await searchWporgPlugins(q);
          if (result.ok) {
            setResults(result.plugins);
            setError(null);
          } else setError(result.error);
        }),
      350,
    );
    return () => clearTimeout(timer);
  }, [query]);

  const install = async (plugin: WporgPlugin, activate: boolean) => {
    setInstalling(plugin.slug);
    setError(null);
    const result = await pluginAction(siteId, "install", [{ id: plugin.slug, name: plugin.name, activate }]);
    setInstalling(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRequested((s) => new Set(s).add(plugin.slug));
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={buttonVariants({ size: "sm" })}>
        <Plus />
        Add plugin
      </SheetTrigger>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b p-5">
          <SheetTitle>Add plugin</SheetTitle>
          <SheetDescription>Search the wordpress.org directory and install on this site.</SheetDescription>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins, e.g. contact form"
              className="pl-9"
            />
            {searching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3">
          {error && (
            <div className="m-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}
          {results === null ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">Type at least two letters to search.</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted-foreground">No plugins found.</p>
          ) : (
            <ul className="grid gap-1">
              {results.map((p) => {
                const isInstalled = installedSet.has(p.slug);
                const isRequested = requested.has(p.slug);
                return (
                  <li key={p.slug} className="flex gap-3 rounded-xl p-3 hover:bg-muted/50">
                    {p.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.icon} alt="" className="size-12 shrink-0 rounded-lg" />
                    ) : (
                      <ItemIcon type="plugin" id={p.slug} slug={p.slug} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <a
                            href={`https://wordpress.org/plugins/${p.slug}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-1 font-medium hover:underline"
                          >
                            {p.name}
                          </a>
                          {p.author && <div className="truncate text-xs text-muted-foreground">by {p.author}</div>}
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {(p.rating / 20).toFixed(1)} ({p.ratings.toLocaleString()})
                        </span>
                        <span>{installs(p.activeInstalls)}</span>
                        {p.tested && <span>Tested up to {p.tested}</span>}
                        <span className="font-mono">v{p.version}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {isInstalled ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                            <Check className="size-3.5" />
                            Installed
                          </span>
                        ) : isRequested ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <Check className="size-3.5" />
                            Added to the queue
                          </span>
                        ) : (
                          <>
                            <Button size="xs" disabled={installing !== null} onClick={() => install(p, true)}>
                              {installing === p.slug ? <Loader2 className="animate-spin" /> : <Download />}
                              Install &amp; activate
                            </Button>
                            <Button size="xs" variant="outline" disabled={installing !== null} onClick={() => install(p, false)}>
                              Install
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
