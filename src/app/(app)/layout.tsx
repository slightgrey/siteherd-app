import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/session";
import { loadUserSettings } from "@/lib/user-settings";
import { brandSubtitle } from "@/lib/white-label";
import { logout } from "./actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        subtitle={
          <Suspense fallback={brandSubtitle(null)}>
            <BrandSubtitle />
          </Suspense>
        }
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

// The agency name from Settings → White label, else "WordPress fleet".
async function BrandSubtitle() {
  await connection();
  const user = await requireUser();
  return brandSubtitle((await loadUserSettings(user.id)).agencyName);
}

async function UserMenu() {
  await connection();
  const user = await requireUser();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-1 pb-1 pl-2 group-data-[collapsible=icon]:hidden">
          <span className="min-w-0 flex-1 truncate text-xs text-sidebar-muted">{user.email}</span>
          <Link
            href="/settings"
            title="Settings"
            aria-label="Settings"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-4"
          >
            <Settings />
          </Link>
        </div>
        {/* With the sidebar collapsed to icons, the email row is hidden; Settings gets its own icon button. */}
        <SidebarMenuButton
          tooltip="Settings"
          render={<Link href="/settings" />}
          className="hidden text-sidebar-muted group-data-[collapsible=icon]:flex"
        >
          <Settings />
          <span>Settings</span>
        </SidebarMenuButton>
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
