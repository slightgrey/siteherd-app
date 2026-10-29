"use client";

import { Globe, HeartPulse, KeyRound, LayoutDashboard, RefreshCw, ShieldCheck, Tags } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType;
  /** Highlight only on this exact path (a sibling item owns its sub-paths). */
  exact?: boolean;
  /** Sub-pages, listed under the item (hidden when the sidebar is collapsed to icons). */
  children?: { href: string; label: string }[];
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/sites", label: "Sites", icon: Globe },
      { href: "/labels", label: "Labels", icon: Tags },
    ],
  },
  {
    label: "Maintenance",
    items: [
      {
        href: "/updates",
        label: "Bulk update",
        icon: RefreshCw,
        children: [
          { href: "/updates/plugins", label: "Plugins" },
          { href: "/updates/themes", label: "Themes" },
          { href: "/updates/core", label: "Core" },
          { href: "/updates/translations", label: "Translations" },
        ],
      },
    ],
  },
  {
    label: "Security",
    items: [
      { href: "/security", label: "Vulnerabilities & files", icon: ShieldCheck, exact: true },
      { href: "/security/logins", label: "Login attacks", icon: KeyRound },
      { href: "/health", label: "Site Health", icon: HeartPulse },
    ],
  },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

// Inactive rows are muted on the night sidebar; the active row lifts and its icon takes the accent.
const buttonClass =
  "h-9 rounded-[10px] px-3 font-medium text-sidebar-muted data-active:text-sidebar-accent-foreground data-active:shadow-card data-active:[&_svg]:text-sidebar-primary";

/** The menu itself. `activePath` is null in the Suspense fallback (no highlight yet). */
export function NavItems({ activePath }: { activePath: string | null }) {
  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label} className="py-1">
          <SidebarGroupLabel className="text-[11px] font-semibold tracking-[0.08em] text-sidebar-muted uppercase">
            {group.label}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {group.items.map(({ href, label, icon: Icon, children, exact }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    // A parent links to its first sub-page and stays highlighted on all of them.
                    render={<Link href={children?.[0].href ?? href} />}
                    isActive={exact ? activePath === href : isActive(activePath, href)}
                    tooltip={label}
                    className={buttonClass}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                  {children && (
                    <SidebarMenuSub className="border-sidebar-accent">
                      {children.map((c) => (
                        <SidebarMenuSubItem key={c.href}>
                          <SidebarMenuSubButton
                            render={<Link href={c.href} />}
                            isActive={activePath === c.href}
                            className="text-sidebar-muted data-active:text-sidebar-accent-foreground"
                          >
                            <span>{c.label}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

/**
 * Reads the URL to highlight the current page. On routes with unknown dynamic
 * params (e.g. /sites/[id]) usePathname suspends during prerendering, so render
 * this inside <Suspense fallback={<NavItems activePath={null} />}>.
 */
export function NavLinks() {
  return <NavItems activePath={usePathname()} />;
}
