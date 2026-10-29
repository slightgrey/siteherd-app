"use client";

import { Popover } from "@base-ui/react/popover";
import { Check, ChevronsUpDown, LayoutGrid, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { StatusBadge, type SiteState } from "@/components/site-status";
import { cn } from "@/lib/utils";

type SiteOption = { id: string; name: string; url: string; state: SiteState };

const dot: Record<SiteState, string> = { ok: "bg-good", stale: "bg-warn", never: "bg-zinc-300 dark:bg-zinc-600" };

/**
 * The site name and status in the site header, opening a searchable list of
 * all the user's sites. Picking one keeps the current tab (e.g. Plugins → that
 * site's Plugins). Type to filter, ↑/↓ to move, Enter to open.
 */
export function SiteSwitcher({ current, state, sites }: { current: { id: string; name: string }; state: SiteState; sites: SiteOption[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // "/sites/<id>/plugins" → "plugins"; "" on the overview.
  const tab = pathname?.split("/").slice(3).join("/") ?? "";
  const hrefFor = (id: string) => `/sites/${id}${tab ? `/${tab}` : ""}`;

  const q = query.trim().toLowerCase();
  const matches = sites.filter((s) => !q || s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q));

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setQuery("");
      setActive(Math.max(0, sites.findIndex((s) => s.id === current.id)));
    }
  };
  const go = (id: string) => {
    setOpen(false);
    router.push(hrefFor(id));
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (matches.length === 0 ? 0 : (i + step + matches.length) % matches.length));
    } else if (e.key === "Enter" && matches[active]) {
      e.preventDefault();
      go(matches[active].id);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {/* The button goes inside the heading (a heading isn't allowed inside a button). */}
      <h1 className="min-w-0 font-display text-2xl font-semibold tracking-tight">
        <Popover.Trigger className="group flex max-w-full items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          <span className="truncate">{current.name}</span>
          <StatusBadge state={state} />
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-label="Switch site" />
        </Popover.Trigger>
      </h1>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="isolate z-50 outline-none">
          <Popover.Popup
            initialFocus={inputRef}
            className="flex max-h-(--available-height) w-80 origin-(--transform-origin) flex-col rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            <div className="relative border-b p-2">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search sites"
                aria-label="Search sites"
                role="combobox"
                aria-expanded
                aria-controls="site-switcher-list"
                aria-activedescendant={matches[active] ? `site-option-${matches[active].id}` : undefined}
                className="h-8 w-full rounded-md bg-transparent pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul id="site-switcher-list" role="listbox" aria-label="Sites" className="max-h-80 overflow-y-auto p-1">
              {matches.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">No sites match.</li>}
              {matches.map((s, i) => (
                <li key={s.id} id={`site-option-${s.id}`} role="option" aria-selected={i === active}>
                  <Link
                    href={hrefFor(s.id)}
                    onClick={() => setOpen(false)}
                    onMouseMove={() => setActive(i)}
                    tabIndex={-1}
                    className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-sm", i === active && "bg-accent text-accent-foreground")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot[s.state])} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.url}</span>
                    </span>
                    {s.id === current.id && <Check className="mt-0.5 size-4 shrink-0" />}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t p-1">
              <Link
                href="/sites"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <LayoutGrid className="size-4" />
                All sites
              </Link>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
