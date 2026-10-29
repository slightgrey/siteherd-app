"use client";

import { RefreshCw } from "lucide-react";
import { ItemJobBadge } from "@/components/update-status";
import { Button } from "@/components/ui/button";
import { itemKey, type ItemJobState, type UpdateItem } from "@/lib/update-types";
import { useStartUpdates } from "./use-start-updates";

/**
 * Update button for a single item (WordPress core, or all translations). Shows
 * the item's job state instead while it runs or waits in the queue.
 */
export function UpdateButton({
  siteId,
  item,
  state,
  children,
}: {
  siteId: string;
  item: UpdateItem;
  state: ItemJobState | null;
  children: React.ReactNode;
}) {
  const updates = useStartUpdates(siteId, {});
  const adding = updates.submitting.has(itemKey(item));
  return (
    <div className="flex flex-col items-end gap-1">
      {state || adding ? (
        <ItemJobBadge state={state} />
      ) : (
        <Button size="sm" onClick={() => updates.start([item], "one")}>
          <RefreshCw />
          {children}
        </Button>
      )}
      {updates.error && <p className="text-xs text-bad">{updates.error}</p>}
    </div>
  );
}
