"use client";

import { Check, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { resyncSite } from "../../actions";

/**
 * The site sends a fresh report now, then the page reloads its data. Site
 * header size by default; `compact` for table rows (smaller, error shown inline
 * because a popover would be clipped by the table's scroll container).
 */
export function ResyncButton({ siteId, compact = false }: { siteId: string; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // "Synced" is only a short confirmation.
  useEffect(() => {
    if (!result?.ok) return;
    const timer = setTimeout(() => setResult(null), 3000);
    return () => clearTimeout(timer);
  }, [result]);

  const resync = () => {
    setResult(null);
    startTransition(async () => {
      const r = await resyncSite(siteId);
      setResult(r.ok ? { ok: true } : { ok: false, error: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size={compact ? "xs" : "sm"}
        disabled={pending}
        onClick={resync}
        title="Ask the site to send a fresh report now, with updates checked again"
      >
        {result?.ok ? <Check /> : <RefreshCw className={pending ? "animate-spin" : undefined} />}
        {pending ? "Syncing…" : result?.ok ? "Synced" : "Resync"}
      </Button>
      {result &&
        !result.ok &&
        (compact ? (
          <p className="mt-1 max-w-56 text-xs whitespace-normal text-red-700 dark:text-red-400">{result.error}</p>
        ) : (
          <p className="absolute top-full right-0 z-10 mt-1 w-72 rounded-md border bg-background px-3 py-2 text-xs text-red-700 dark:text-red-400 shadow-sm">
            {result.error}
          </p>
        ))}
    </div>
  );
}
