"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { UpdatesBadge } from "@/components/report-badges";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type UpdateCounts = {
  /** Newer WordPress version on offer, if any. */
  core: string | null;
  plugins: number;
  themes: number;
  /** Pending language packs (they count as one update in `total`). */
  translations: number;
  total: number;
};

function Line({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span>{label}</span>
      {value ? (
        <span className="font-medium tabular-nums">{value}</span>
      ) : (
        <CheckCircle2 className="size-3.5 text-good" aria-label="Up to date" />
      )}
    </div>
  );
}

/**
 * The "N pending" badge; hovering or focusing it shows what's pending per kind.
 * It links to `href` (the site's Plugins tab, which opens on "Update available"
 * when plugins have updates).
 */
export function UpdatesBreakdown({ counts, href }: { counts: UpdateCounts; href: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Link href={href} />}
        className="rounded-full outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <UpdatesBadge total={counts.total} />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="block min-w-40 py-2">
        <div className="grid gap-1">
          <Line label="Core" value={counts.core} />
          <Line label="Plugins" value={counts.plugins} />
          <Line label="Themes" value={counts.themes} />
          <Line label="Translations" value={counts.translations} />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
