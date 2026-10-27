"use client";

import {
  Code2,
  FileCheck2,
  HeartPulse,
  Languages,
  LayoutDashboard,
  Palette,
  Plug,
  ScrollText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SiteNavCounts = { plugins: number; themes: number; core: number; translations: number; critical: number; files: number };

type Item = { slug: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number; alert?: boolean };

export function SiteNav({ siteId, counts }: { siteId: string; counts: SiteNavCounts | null }) {
  const pathname = usePathname();
  const base = `/sites/${siteId}`;
  const groups: { label?: string; items: Item[] }[] = [
    {
      items: [
        { slug: "", label: "Overview", icon: LayoutDashboard },
        { slug: "activity", label: "Activity log", icon: ScrollText },
      ],
    },
    {
      label: "WordPress",
      items: [
        { slug: "plugins", label: "Plugins", icon: Plug, count: counts?.plugins },
        { slug: "themes", label: "Themes", icon: Palette, count: counts?.themes },
        { slug: "core", label: "Core", icon: Code2, count: counts?.core },
        { slug: "translations", label: "Translations", icon: Languages, count: counts?.translations },
      ],
    },
    {
      label: "Security",
      items: [
        { slug: "health", label: "Site Health", icon: HeartPulse, count: counts?.critical, alert: true },
        { slug: "security", label: "Files & logins", icon: FileCheck2, count: counts?.files, alert: true },
      ],
    },
    { items: [{ slug: "settings", label: "Settings", icon: Settings }] },
  ];

  return (
    <nav
      aria-label="Site sections"
      className="flex gap-1 overflow-x-auto border-b pb-2 md:w-52 md:shrink-0 md:flex-col md:gap-4 md:overflow-visible md:border-r md:border-b-0 md:pr-4 md:pb-0"
    >
      {groups.map((group, i) => (
        <div key={i} className="flex gap-1 md:flex-col md:gap-0.5">
          {group.label && (
            <div className="hidden px-2 pb-1 text-xs font-medium text-muted-foreground md:block">{group.label}</div>
          )}
          {group.items.map(({ slug, label, icon: Icon, count, alert }) => {
            const href = slug ? `${base}/${slug}` : base;
            const active = pathname === href;
            return (
              <Link
                key={slug}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-muted",
                  active && "bg-muted font-medium",
                )}
              >
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                {!!count && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs font-medium",
                      alert ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
