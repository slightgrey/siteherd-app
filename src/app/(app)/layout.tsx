import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/session";
import { logout } from "./actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        footer={
          <Suspense>
            <UserMenu />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-card/90 px-4 backdrop-blur lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto">
            <ThemeSwitcher />
          </div>
        </header>
        {/* Left-aligned so the site menu sits next to the sidebar; capped so lines don't get absurdly long on very wide screens. */}
        <div className="w-full max-w-[1440px] px-4 py-8 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function UserMenu() {
  const user = await requireUser();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="truncate px-2 pb-1 text-xs text-sidebar-muted group-data-[collapsible=icon]:hidden">{user.email}</div>
        <form action={logout}>
          <SidebarMenuButton type="submit" tooltip="Log out" className="text-sidebar-muted">
            <LogOut />
            <span>Log out</span>
          </SidebarMenuButton>
        </form>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
