"use client";

import { Code2, Globe, Languages, Palette, Plug } from "lucide-react";
import { useState } from "react";
import type { UpdateType } from "@/lib/update-types";
import { cn } from "@/lib/utils";

/** An external image that tries each source in turn, then shows `fallback`. */
function FallbackImage({ sources, className, fallback }: { sources: string[]; className: string; fallback: React.ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  if (attempt >= sources.length) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external icons with format fallbacks; next/image would need every host in remotePatterns.
    <img
      src={sources[attempt]}
      alt=""
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setAttempt((a) => a + 1)}
      // An image that failed before hydration never fires onError.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setAttempt((a) => a + 1);
      }}
    />
  );
}

function IconBox({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
      <Icon className="size-4" />
    </div>
  );
}

const fallbackIcon: Record<UpdateType, React.ComponentType<{ className?: string }>> = {
  plugin: Plug,
  theme: Palette,
  core: Code2,
  translations: Languages,
};

/**
 * A plugin's wordpress.org icon or a theme's screenshot (whichever format
 * exists), else a generic icon. Core and translations always get a generic one.
 *
 * @param id   Plugin file or theme stylesheet.
 * @param slug wordpress.org plugin slug, when known.
 */
export function ItemIcon({ type, id, slug }: { type: UpdateType; id: string; slug: string | null }) {
  const sources =
    type === "theme"
      ? ["screenshot.png", "screenshot.jpg"].map((f) => `https://ts.w.org/wp-content/themes/${id}/${f}`)
      : type === "plugin" && slug
        ? ["icon-128x128.png", "icon-128x128.jpg", "icon-128x128.gif", "icon.svg"].map((f) => `https://ps.w.org/${slug}/assets/${f}`)
        : [];
  return (
    <FallbackImage
      // Remount when the item changes so a new list starts from the first source.
      key={`${type}:${id}`}
      sources={sources}
      className={cn("size-9 shrink-0 rounded-md", type === "theme" && "border object-cover object-top")}
      fallback={<IconBox icon={fallbackIcon[type]} />}
    />
  );
}

/** A site's WordPress Site Icon, else its /favicon.ico, else a globe. */
export function SiteIcon({ icon, url, small = false }: { icon: string | null; url: string; small?: boolean }) {
  const sources = [icon, `${url.replace(/\/+$/, "")}/favicon.ico`].filter((s): s is string => !!s);
  const box = small ? "size-7" : "size-9";
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-md border bg-background", box)}>
      <FallbackImage
        key={url}
        sources={sources}
        className={cn("rounded-sm", small ? "size-4" : "size-6")}
        fallback={<Globe className="size-4 text-muted-foreground" />}
      />
    </div>
  );
}
