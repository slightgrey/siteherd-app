"use client";

import { Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Settings sections; add new ones (notifications, alerts) here. Styled like the site menu (site-nav.tsx).
const SECTIONS = [{ href: "/settings/white-label", label: "White label", icon: Tag }];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto border-b pb-2 md:w-52 md:shrink-0 md:flex-col md:gap-0.5 md:overflow-visible md:border-r md:border-b-0 md:pr-4 md:pb-0"
    >
      {SECTIONS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-accent font-medium text-foreground hover:bg-accent",
            )}
          >
            <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
