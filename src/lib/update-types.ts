// Shared by the DB schema, server code and client components (no server imports here).

export type UpdateType = "plugin" | "theme" | "core" | "translations";

/** What was requested: plugin file, theme stylesheet, "core", or "translations" (every pending language pack). */
export type UpdateItem = { type: UpdateType; id: string; name: string; from: string; to: string };

/** Per-item outcome pushed by the plugin (Siteherd_Updater::outcome). */
export type UpdateResult = {
  type: UpdateType;
  id: string;
  name: string;
  from: string | null;
  to: string | null;
  status: "updated" | "failed" | "rolled_back" | "skipped";
  message: string | null;
};

// Sent to the site and not finished. Only one per site at a time.
export const ACTIVE_JOB_STATUSES = ["queued", "running"] as const;
// Not finished: active, or "waiting" in the dashboard's queue behind the active one.
export const PENDING_JOB_STATUSES = ["waiting", ...ACTIVE_JOB_STATUSES] as const;

export function itemKey(item: { type: UpdateType; id: string }) {
  return `${item.type}:${item.id}`;
}

/** What an unfinished job is doing to an item, for row labels. */
export type ItemJobState = { kind: "update" | "rollback"; waiting: boolean };

/** Item key → state, for items in unfinished jobs (the active one wins over a waiting one). */
export function itemJobStates(jobs: { kind: "update" | "rollback"; status: string; items: { type: UpdateType; id: string }[] }[]) {
  const states: Record<string, ItemJobState> = {};
  for (const job of jobs) {
    if (!(PENDING_JOB_STATUSES as readonly string[]).includes(job.status)) continue;
    const waiting = job.status === "waiting";
    for (const item of job.items) {
      const key = itemKey(item);
      if (!states[key] || !waiting) states[key] = { kind: job.kind, waiting };
    }
  }
  return states;
}

export function itemJobLabel(state: ItemJobState) {
  if (state.waiting) return "Queued";
  return state.kind === "rollback" ? "Rolling back…" : "Updating…";
}
