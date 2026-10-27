"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { itemKey, type UpdateItem } from "@/lib/update-types";
import { updateSiteItems } from "../../actions";

/**
 * Starts (or queues) updates on one site, with the confirmations they need.
 *
 * Updating overwrites edited plugin files. A single update asks first,
 * "selected" asks once for all edited ones, "all" skips them. Core always asks.
 *
 * @param edited Item key → number of files that differ from wordpress.org.
 */
export function useStartUpdates(siteId: string, edited: Record<string, number>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Items whose request is on its way; their rows show "Adding…" until the page refreshes.
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  /** Returns the item keys actually sent (empty if cancelled). */
  const start = (requested: UpdateItem[], mode: "one" | "selected" | "all"): string[] => {
    let items = requested;
    if (items.length === 0) return [];
    setInfo(null);
    const editedItems = items.filter((i) => edited[itemKey(i)] !== undefined);
    let overwrite = false;
    if (editedItems.length > 0) {
      const names = editedItems.map((i) => i.name).join(", ");
      if (mode === "all") {
        setInfo(`Skipped plugins with edited files: ${names}. Update them one at a time.`);
      } else if (mode === "one") {
        const [p] = editedItems;
        const n = edited[itemKey(p)];
        if (
          !confirm(
            `${p.name} has ${n} edited ${n === 1 ? "file" : "files"}. Updating replaces ${n === 1 ? "it" : "them"} with the stock ${p.to} version.\n\nThe edited version is kept on the site and can be restored with Rollback for 30 days, or until this plugin is updated again.`,
          )
        ) {
          return [];
        }
        overwrite = true;
      } else {
        overwrite = confirm(
          `These plugins have edited files that the update would overwrite: ${names}.\n\nThe edited versions are kept on the site and can be restored with Rollback for 30 days, or until each plugin is updated again.\n\nOK updates them too. Cancel skips them.`,
        );
      }
      if (!overwrite) items = items.filter((i) => edited[itemKey(i)] === undefined);
      if (items.length === 0) return [];
    }
    const core = items.find((i) => i.type === "core");
    if (
      core &&
      !confirm(
        `Update WordPress from ${core.from} to ${core.to}?\n\nCore updates can't be rolled back automatically. Plugins and themes in this run are updated first.`,
      )
    ) {
      return [];
    }
    setError(null);
    const keys = items.map(itemKey);
    setSubmitting((s) => new Set([...s, ...keys]));
    // Not a transition: other Update buttons stay clickable while this request runs.
    void (async () => {
      const result = await updateSiteItems(
        siteId,
        items.map(({ type, id }) =>
          overwrite && edited[itemKey({ type, id })] !== undefined ? { type, id, overwriteEdits: true } : { type, id },
        ),
      );
      if (!result.ok) setError(result.error);
      // Clear "Adding…" in the same commit as the refreshed jobs, so the row goes straight to its new state.
      startTransition(() => {
        router.refresh();
        setSubmitting((s) => new Set([...s].filter((k) => !keys.includes(k))));
      });
    })();
    return keys;
  };

  return { start, submitting, error, info };
}
