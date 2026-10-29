import Link from "next/link";
import { Suspense } from "react";
import { NavItems, NavLinks } from "@/components/nav-links";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function AppSidebar({ subtitle, footer }: { subtitle: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-sidebar-primary font-display text-[15px] font-bold tracking-tight text-sidebar-primary-foreground">
                sh
              </span>
              <span className="grid leading-tight">
                <span className="font-display text-base font-semibold tracking-tight">SiteHerd</span>
                <span className="truncate text-xs text-sidebar-muted">{subtitle}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <Suspense fallback={<NavItems activePath={null} />}>
          <NavLinks />
        </Suspense>
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
