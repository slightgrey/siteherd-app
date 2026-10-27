"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import { useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Sso } from "@/lib/report";


/**
 * WP Admin button in the site header.
 * - One-click login with a fixed admin: one click opens wp-admin logged in.
 * - "Ask every time": a menu of the site's administrators.
 * - Not available (older plugin, turned off): a plain link to the WordPress login.
 */
export function WpAdminButton({
  siteId,
  siteUrl,
  sso,
  compact = false,
}: {
  siteId: string;
  siteUrl: string;
  sso: Sso | null;
  /** Smaller button, for table rows. */
  compact?: boolean;
}) {
  const buttonClass = buttonVariants({ variant: "outline", size: compact ? "xs" : "sm" });
  const formRef = useRef<HTMLFormElement>(null);
  const userRef = useRef<HTMLInputElement>(null);
  const plainUrl = `${siteUrl}/wp-admin/`;

  const loginAs = (userId: number) => {
    userRef.current!.value = String(userId);
    formRef.current!.requestSubmit();
  };

  const form = (
    <form ref={formRef} method="post" action={`/sites/${siteId}/wp-admin`} target="_blank" className="hidden">
      <input ref={userRef} type="hidden" name="user" defaultValue={sso?.user_id ?? ""} />
    </form>
  );

  if (!sso?.enabled || (!sso.user_id && sso.admins.length === 0)) {
    return (
      <a
        href={plainUrl}
        target="_blank"
        rel="noreferrer"
        className={buttonClass}
        title={sso && !sso.enabled ? "One-click login is turned off on this site" : "Log in with your WordPress password"}
      >
        WP Admin <ExternalLink />
      </a>
    );
  }

  if (sso.user_id) {
    const admin = sso.admins.find((a) => a.id === sso.user_id);
    return (
      <>
        {form}
        <button type="button" className={buttonClass} onClick={() => loginAs(sso.user_id!)} title={admin ? `Log in as ${admin.name}` : undefined}>
          WP Admin <ExternalLink />
        </button>
      </>
    );
  }

  return (
    <>
      {form}
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonClass}>
          WP Admin <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Log in as</DropdownMenuLabel>
            {sso.admins.map((a) => (
              <DropdownMenuItem key={a.id} onClick={() => loginAs(a.id)}>
                <span className="flex-1">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.login}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.open(plainUrl, "_blank", "noreferrer")}>
            Log in with a password
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
