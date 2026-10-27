import { CheckCircle2, CircleDashed, Loader2, RotateCcw, XCircle, MinusCircle } from "lucide-react";
import { ToneBadge } from "@/components/report-badges";
import type { ItemJobState, UpdateItem, UpdateResult } from "@/lib/update-types";
import { itemJobLabel, itemKey } from "@/lib/update-types";

// Job as passed to client components (dates pre-formatted on the server).
export type ClientJob = {
  id: string;
  kind: "update" | "rollback";
  status: "waiting" | "queued" | "running" | "completed" | "failed";
  items: UpdateItem[];
  results: UpdateResult[];
  error: string | null;
  note: string | null;
  when: string;
};

const resultLook: Record<UpdateResult["status"], { tone: "good" | "warn" | "bad" | "muted"; label: string; icon: React.ReactNode }> = {
  updated: { tone: "good", label: "Updated", icon: <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" /> },
  rolled_back: { tone: "warn", label: "Rolled back", icon: <RotateCcw className="size-4 text-amber-600 dark:text-amber-400" /> },
  failed: { tone: "bad", label: "Failed", icon: <XCircle className="size-4 text-red-600 dark:text-red-400" /> },
  skipped: { tone: "muted", label: "Skipped", icon: <MinusCircle className="size-4 text-muted-foreground" /> },
};

// In a rollback run, "updated" means the old version is back, and "rolled_back"
// means the site broke so the newer version was put back again.
const rollbackLook: typeof resultLook = {
  ...resultLook,
  updated: { tone: "good", label: "Restored", icon: <RotateCcw className="size-4 text-green-600 dark:text-green-400" /> },
  rolled_back: { tone: "warn", label: "Reverted", icon: <RotateCcw className="size-4 text-amber-600 dark:text-amber-400" /> },
};

export function jobTitle(job: Pick<ClientJob, "kind" | "items">) {
  const n = job.items.length;
  return `${job.kind === "rollback" ? "Rollback" : "Update run"} · ${n} ${n === 1 ? "item" : "items"}`;
}

/** Row label for an item in an unfinished job. A null state means the request is still being sent. */
export function ItemJobBadge({ state }: { state: ItemJobState | null }) {
  if (state?.waiting) return <ToneBadge t="muted">Queued</ToneBadge>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      {state ? itemJobLabel(state) : "Adding…"}
    </span>
  );
}

export function JobStatusBadge({ job }: { job: ClientJob }) {
  if (job.status === "waiting") return <ToneBadge t="muted">Queued</ToneBadge>;
  if (job.status === "queued") return <ToneBadge t="muted">Starting…</ToneBadge>;
  if (job.status === "running") return <ToneBadge t="warn">{job.kind === "rollback" ? "Rolling back…" : "Updating…"}</ToneBadge>;
  if (job.status === "failed") return <ToneBadge t="bad">Failed</ToneBadge>;
  const bad = job.results.some((r) => r.status === "failed" || r.status === "rolled_back");
  return bad ? <ToneBadge t="warn">Finished with problems</ToneBadge> : <ToneBadge t="good">Completed</ToneBadge>;
}

/** Per-item lines for a job: results so far, then the item in progress, then waiting ones. */
export function JobItems({ job }: { job: ClientJob }) {
  const done = new Map(job.results.map((r) => [itemKey(r), r]));
  const look = job.kind === "rollback" ? rollbackLook : resultLook;
  // The plugin works through items in order: plugins, then themes, core, translations.
  const order = { plugin: 0, theme: 1, core: 2, translations: 3 };
  const current =
    job.status === "running"
      ? [...job.items].sort((a, b) => order[a.type] - order[b.type]).find((i) => !done.has(itemKey(i)))
      : undefined;
  return (
    <ul className="divide-y text-sm">
      {job.items.map((item) => {
        const result = done.get(itemKey(item));
        let icon: React.ReactNode;
        let label: React.ReactNode;
        if (result) {
          const l = look[result.status];
          icon = l.icon;
          label = <ToneBadge t={l.tone}>{l.label}</ToneBadge>;
        } else if (current && itemKey(current) === itemKey(item)) {
          icon = <Loader2 className="size-4 animate-spin text-muted-foreground" />;
          label = <span className="text-muted-foreground">Updating…</span>;
        } else if (job.status === "waiting" || job.status === "queued" || job.status === "running") {
          icon = <CircleDashed className="size-4 text-muted-foreground" />;
          label = <span className="text-muted-foreground">Waiting</span>;
        } else {
          icon = <MinusCircle className="size-4 text-muted-foreground" />;
          label = <span className="text-muted-foreground">Not run</span>;
        }
        const from = result?.from ?? item.from;
        const to = result?.status === "updated" ? result.to : item.to;
        return (
          <li key={itemKey(item)} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <span className="mt-0.5">{icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.name}</span>
                {item.type !== "translations" && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {from} → {to}
                  </span>
                )}
              </div>
              {result?.message && <p className="mt-0.5 text-xs text-muted-foreground">{result.message}</p>}
            </div>
            <div className="shrink-0">{label}</div>
          </li>
        );
      })}
    </ul>
  );
}
