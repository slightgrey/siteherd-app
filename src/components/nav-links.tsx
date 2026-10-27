"use client";

import { Globe, HeartPulse, LayoutDashboard, RefreshCw, ShieldCheck, Tags } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  /** Sub-pages, listed under the item (hidden when the sidebar is collapsed to icons). */
  children?: { href: string; label: string }[];
};

const nav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sites", label: "Sites", icon: Globe },
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
  { href: "/security", label: "Security", icon: ShieldCheck },
  { href: "/health", label: "Site Health", icon: HeartPulse },
  { href: "/labels", label: "Labels", icon: Tags },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** The menu itself. `activePath` is null in the Suspense fallback (no highlight yet). */
export function NavItems({ activePath }: { activePath: string | null }) {
  return (
    <SidebarMenu>
      {nav.map(({ href, label, icon: Icon, children }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            // A parent links to its first sub-page and stays highlighted on all of them.
            render={<Link href={children?.[0].href ?? href} />}
            isActive={isActive(activePath, href)}
            tooltip={label}
          >
            <Icon />
            <span>{label}</span>
          </SidebarMenuButton>
          {children && (
            <SidebarMenuSub>
              {children.map((c) => (
                <SidebarMenuSubItem key={c.href}>
                  <SidebarMenuSubButton render={<Link href={c.href} />} isActive={isActive(activePath, c.href)}>
                    <span>{c.label}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
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
