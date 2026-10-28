"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { cancelQueuedJob } from "@/app/(app)/actions";
import { JobItems, JobStatusBadge, type ClientJob } from "@/components/update-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobKind } from "@/lib/update-types";

/**
 * The site's running update/rollback with live progress, then the jobs queued
 * behind it. Re-fetches the page every few seconds while anything is unfinished.
 *
 * @param jobs Unfinished jobs (waiting, queued, running), newest first as loadJobs() returns them.
 */
export function JobQueue({ siteId, jobs }: { siteId: string; jobs: ClientJob[] }) {
  const router = useRouter();
  const active = jobs.find((j) => j.status === "queued" || j.status === "running") ?? null;
  // Oldest first: the order they'll run in.
  const waiting = jobs.filter((j) => j.status === "waiting").reverse();
  const unfinished = jobs.length > 0;

  useEffect(() => {
    if (!unfinished) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [unfinished, router]);

  if (!unfinished) return null;
  return (
    <div className="grid gap-4">
      {active && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {ACTIVE_TITLES[active.kind]} <JobStatusBadge job={active} />
            </CardTitle>
            <CardDescription>
              {ACTIVE_DESCRIPTIONS[active.kind]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JobItems job={active} />
          </CardContent>
        </Card>
      )}
      {waiting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Up next ({waiting.length})</CardTitle>
            <CardDescription>These run one at a time, in this order, after the current one finishes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="divide-y text-sm">
              {waiting.map((job, i) => (
                <QueuedJob key={job.id} siteId={siteId} job={job} position={i + 1} />
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QueuedJob({ siteId, job, position }: { siteId: string; job: ClientJob; position: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cancel = () =>
    startTransition(async () => {
      await cancelQueuedJob(siteId, job.id);
      router.refresh();
    });
  return (
    <li className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
      <span className="w-5 shrink-0 text-muted-foreground">{position}.</span>
      <div className="min-w-0 flex-1">
        {job.items.map((item) => (
          <div key={`${item.type}:${item.id}`} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {QUEUED_VERBS[job.kind]} {item.name}
              {job.kind === "install" && item.activate && " and activate"}
            </span>
            {item.type !== "translations" && (job.kind === "update" || job.kind === "rollback") && (
              <span className="font-mono text-xs text-muted-foreground">
                {item.from} → {item.to}
              </span>
            )}
          </div>
        ))}
      </div>
      <Button variant="ghost" size="xs" disabled={pending} onClick={cancel} title="Remove from the queue">
        <X />
        Remove
      </Button>
    </li>
  );
}

const ACTIVE_TITLES: Record<JobKind, string> = {
  update: "Update in progress",
  rollback: "Rollback in progress",
  install: "Installing",
  delete: "Deleting",
  activate: "Activating",
  deactivate: "Deactivating",
};

const ACTIVE_DESCRIPTIONS: Record<JobKind, string> = {
  update: "Each plugin and theme is backed up, updated, then the site is checked. If it stops loading, the previous version is restored automatically.",
  rollback: "The current version is backed up, the earlier version is put back, then the site is checked. If it stops loading, the current version is restored.",
  install: "Plugins are downloaded from wordpress.org and installed. If one is activated and the site stops loading, it is deactivated again.",
  delete: "Each plugin is deactivated, a copy of its files is saved on the site for 30 days, then WordPress deletes it.",
  activate: "Each plugin is activated, then the site is checked. If it stops loading, the plugin is deactivated again.",
  deactivate: "Each plugin is deactivated.",
};

const QUEUED_VERBS: Record<JobKind, string> = {
  update: "Update",
  rollback: "Roll back",
  install: "Install",
  delete: "Delete",
  activate: "Activate",
  deactivate: "Deactivate",
};
