import { Badge } from "@/components/ui/badge";
import type { Health, Integrity } from "@/lib/report";
import { integrityProblems } from "@/lib/report";

const tone = {
  good: "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  bad: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
};

export function ToneBadge({ t, children }: { t: keyof typeof tone; children: React.ReactNode }) {
  return <Badge className={tone[t]}>{children}</Badge>;
}

export function UpdatesBadge({ total }: { total: number }) {
  return total === 0 ? <ToneBadge t="good">Up to date</ToneBadge> : <ToneBadge t="warn">{total} pending</ToneBadge>;
}

export function HealthBadge({ health }: { health: Health | null }) {
  if (!health) return <ToneBadge t="muted">Not checked</ToneBadge>;
  const { critical, recommended } = health.counts;
  if (critical > 0) return <ToneBadge t="bad">{critical} critical</ToneBadge>;
  if (recommended > 0) return <ToneBadge t="warn">{recommended} to improve</ToneBadge>;
  return <ToneBadge t="good">Good</ToneBadge>;
}

export function IntegrityBadge({ integrity }: { integrity: Integrity | null }) {
  const problems = integrityProblems(integrity);
  if (!problems) return <ToneBadge t="muted">Not checked</ToneBadge>;
  if (problems.total > 0) return <ToneBadge t="bad">Files changed</ToneBadge>;
  if (problems.coreError) return <ToneBadge t="warn">Couldn&apos;t verify</ToneBadge>;
  return <ToneBadge t="good">Files OK</ToneBadge>;
}

export function FailedLoginsBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return <ToneBadge t={count >= 20 ? "bad" : "warn"}>{count} failed logins</ToneBadge>;
}
