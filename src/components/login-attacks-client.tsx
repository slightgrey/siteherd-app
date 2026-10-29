"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clearLoginLockouts, dismissSiteEvent, setLoginLockout, setXmlrpcOff } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import type { DayTotal } from "@/lib/login-attacks";
import { FAILED_LOGIN_SOURCE_LABELS, type FailedLoginSource, type Lockout } from "@/lib/report";
import { cn } from "@/lib/utils";

// Categorical slots 1–4 of the dataviz palette, fixed per source (validated for
// light and dark surfaces). Light-mode contrast is low for REST and Unknown, so
// the legend always shows the numbers and every bar has a tooltip.
export const SOURCE_COLOR: Record<FailedLoginSource, string> = {
  login: "bg-[#2a78d6] dark:bg-[#3987e5]",
  xmlrpc: "bg-[#eb6834] dark:bg-[#d95926]",
  rest: "bg-[#1baf7a] dark:bg-[#199e70]",
  other: "bg-[#eda100] dark:bg-[#c98500]",
};

const SOURCES = Object.keys(FAILED_LOGIN_SOURCE_LABELS) as FailedLoginSource[];

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Failed logins per day, stacked by source, with a tooltip per day. */
export function LoginTrendChart({ days }: { days: DayTotal[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.total));
  const shown = SOURCES.filter((s) => days.some((d) => d[s] > 0));
  const totals = Object.fromEntries(SOURCES.map((s) => [s, days.reduce((n, d) => n + d[s], 0)])) as Record<FailedLoginSource, number>;
  const active = hover === null ? null : days[hover];

  return (
    <figure className="grid gap-3">
      {shown.length > 1 && (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {shown.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", SOURCE_COLOR[s])} />
              {FAILED_LOGIN_SOURCE_LABELS[s]} <span className="tabular-nums text-foreground">{totals[s].toLocaleString()}</span>
            </span>
          ))}
        </figcaption>
      )}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed" />
        <span className="pointer-events-none absolute top-0 right-0 -translate-y-full pb-0.5 text-xs tabular-nums text-muted-foreground">
          {max.toLocaleString()}
        </span>
        <div className="flex h-36 items-end gap-0.5 border-b" onMouseLeave={() => setHover(null)}>
          {days.map((d, i) => (
            <div
              key={d.day}
              className="flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setHover(i)}
              aria-label={`${formatDay(d.day)}: ${d.total} failed logins`}
            >
              <div
                className={cn("flex w-full flex-col-reverse gap-px overflow-hidden rounded-t-[4px]", hover !== null && hover !== i && "opacity-60")}
                style={{ height: `${(d.total / max) * 100}%` }}
              >
                {SOURCES.map((s) => (d[s] > 0 ? <div key={s} className={SOURCE_COLOR[s]} style={{ flexGrow: d[s] }} /> : null))}
              </div>
            </div>
          ))}
        </div>
        {active && (
          <div
            className="pointer-events-none absolute bottom-full z-10 mb-2 w-max -translate-x-1/2 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm"
            style={{ left: `${((hover! + 0.5) / days.length) * 100}%` }}
          >
            <p className="font-medium">
              {formatDay(active.day)}: {active.total.toLocaleString()} failed
            </p>
            {SOURCES.filter((s) => active[s] > 0).map((s) => (
              <p key={s} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={cn("size-2 rounded-sm", SOURCE_COLOR[s])} />
                {FAILED_LOGIN_SOURCE_LABELS[s]} <span className="tabular-nums text-foreground">{active[s].toLocaleString()}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDay(days[0].day)}</span>
        <span>Today (UTC)</span>
      </div>
    </figure>
  );
}

/** Block or allow XML-RPC logins on one site. */
export function XmlrpcButton({ siteId, off, size = "sm" }: { siteId: string; off: boolean; size?: "sm" | "xs" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const r = await setXmlrpcOff(siteId, !off);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  };
  return (
    <div className="grid justify-items-start gap-1">
      <Button variant={off ? "outline" : "default"} size={size} disabled={pending} onClick={toggle}>
        {pending && <Loader2 className="animate-spin" />}
        {off ? "Allow XML-RPC again" : "Block XML-RPC logins"}
      </Button>
      {error && <p className="max-w-64 text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Block XML-RPC on every listed site, one request per site. */
export function BlockAllXmlrpcButton({ sites }: { sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failures, setFailures] = useState<string[]>([]);
  const run = () => {
    setFailures([]);
    startTransition(async () => {
      const results = await Promise.all(sites.map(async (s) => ({ s, r: await setXmlrpcOff(s.id, true) })));
      setFailures(results.flatMap(({ s, r }) => (r.ok ? [] : [`${s.name}: ${r.error}`])));
      router.refresh();
    });
  };
  return (
    <div className="grid justify-items-end gap-1">
      <Button size="sm" disabled={pending || sites.length === 0} onClick={run}>
        {pending && <Loader2 className="animate-spin" />}
        Block XML-RPC on {sites.length} {sites.length === 1 ? "site" : "sites"}
      </Button>
      {failures.map((f) => (
        <p key={f} className="max-w-96 text-right text-xs text-red-700 dark:text-red-400">
          {f}
        </p>
      ))}
    </div>
  );
}

/** "That was me": stop flagging a new administrator. */
export function DismissEventButton({ siteId, eventId }: { siteId: string; eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="xs"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if ((await dismissSiteEvent(siteId, eventId)).ok) router.refresh();
        })
      }
    >
      <Check />
      That was me
    </Button>
  );
}

/** Turn WP Siteherd's login lockout on or off, with its limits, and clear lockouts. */
export function LockoutControls({ siteId, lockout }: { siteId: string; lockout: Lockout }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [retries, setRetries] = useState(lockout.max_retries);
  const [minutes, setMinutes] = useState(lockout.lockout_minutes);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = retries !== lockout.max_retries || minutes !== lockout.lockout_minutes;

  const save = (enabled: boolean) =>
    startTransition(async () => {
      setMessage(null);
      const r = await setLoginLockout(siteId, { enabled, max_retries: retries, lockout_minutes: minutes });
      if (r.ok) router.refresh();
      else setMessage({ ok: false, text: r.error });
    });
  const clear = () =>
    startTransition(async () => {
      setMessage(null);
      const r = await clearLoginLockouts(siteId);
      setMessage(r.ok ? { ok: true, text: "All lockouts cleared." } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });

  const select = "h-8 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          Lock out after
          <select className={select} value={retries} onChange={(e) => setRetries(Number(e.target.value))} disabled={pending}>
            {[3, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n} failed logins
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          for
          <select className={select} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} disabled={pending}>
            {[15, 30, 60, 240].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {lockout.enabled ? (
          <>
            {changed && (
              <Button size="sm" disabled={pending} onClick={() => save(true)}>
                {pending && <Loader2 className="animate-spin" />}
                Save limits
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={pending} onClick={() => save(false)}>
              Turn off
            </Button>
            <Button variant="outline" size="sm" disabled={pending} onClick={clear}>
              Clear all lockouts
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => save(true)}>
            {pending && <Loader2 className="animate-spin" />}
            Turn on login lockout
          </Button>
        )}
      </div>
      {message && <p className={cn("text-xs", message.ok ? "text-muted-foreground" : "text-red-700 dark:text-red-400")}>{message.text}</p>}
    </div>
  );
}

/** Turn the lockout on for every listed site, one request per site. */
export function LockoutAllButton({ sites }: { sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failures, setFailures] = useState<string[]>([]);
  const run = () => {
    setFailures([]);
    startTransition(async () => {
      const results = await Promise.all(sites.map(async (s) => ({ s, r: await setLoginLockout(s.id, { enabled: true }) })));
      setFailures(results.flatMap(({ s, r }) => (r.ok ? [] : [`${s.name}: ${r.error}`])));
      router.refresh();
    });
  };
  return (
    <div className="grid justify-items-end gap-1">
      <Button size="sm" variant="outline" disabled={pending || sites.length === 0} onClick={run}>
        {pending && <Loader2 className="animate-spin" />}
        Turn on lockout on {sites.length} {sites.length === 1 ? "site" : "sites"}
      </Button>
      {failures.map((f) => (
        <p key={f} className="max-w-96 text-right text-xs text-red-700 dark:text-red-400">
          {f}
        </p>
      ))}
    </div>
  );
}
