import { Badge } from "@/components/ui/badge";

// Cron pushes every 5–15 min, so 30 min without a report means something is wrong.
const STALE_AFTER_MS = 30 * 60 * 1000;

export type SiteState = "ok" | "stale" | "never";

export function siteState(lastReportAt: Date | null, now: number): SiteState {
  if (!lastReportAt) return "never";
  return now - lastReportAt.getTime() > STALE_AFTER_MS ? "stale" : "ok";
}

const badgeStyles: Record<SiteState, string> = {
  ok: "bg-good-soft text-good",
  stale: "bg-warn-soft text-warn",
  never: "bg-muted text-muted-foreground",
};
const badgeLabels: Record<SiteState, string> = { ok: "Reporting", stale: "Stale", never: "Not connected" };

export function StatusBadge({ state }: { state: SiteState }) {
  return <Badge className={badgeStyles[state]}>{badgeLabels[state]}</Badge>;
}

export function timeAgo(date: Date, now: number) {
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
