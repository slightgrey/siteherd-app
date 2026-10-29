import type { AttentionReason } from "./fleet";
import type { LoginProtection } from "./login-protection";

// Failed-login history and when it deserves attention. Pure: the loaders in
// fleet.ts / site.ts query failed_login_hours, this decides what it means.

export type DayCounts = { day: string; login: number; xmlrpc: number; rest: number; other: number };
export type DayTotal = DayCounts & { total: number };

/** Below this many failed logins a day, nothing is flagged. */
export const ATTACK_MIN = 100;
/** A spike is this many times the usual daily count. */
const SPIKE_FACTOR = 3;
/** Days of history the usual level is taken from, and the fewest needed. */
const BASELINE_DAYS = 7;
const BASELINE_MIN_DAYS = 3;

/** UTC day key, e.g. "2026-10-29". */
export function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * One entry per UTC day for the last `days` days up to today (oldest first),
 * zeros where nothing was recorded.
 */
export function fillDays(rows: DayCounts[], days: number, now: number): DayTotal[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DayTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(new Date(now - i * 86_400_000));
    const r = byDay.get(day) ?? { day, login: 0, xmlrpc: 0, rest: 0, other: 0 };
    out.push({ ...r, day, total: r.login + r.xmlrpc + r.rest + r.other });
  }
  return out;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The usual failed logins per day: the median of the full days before today
 * (at most 7), counted from the first day anything was recorded. Null with
 * fewer than 3 such days.
 */
export function usualPerDay(history: DayCounts[], now: number): number | null {
  const today = dayKey(new Date(now));
  const recorded = history.filter((d) => d.day < today).map((d) => d.day).sort();
  if (recorded.length === 0) return null;
  const days = fillDays(history, BASELINE_DAYS + 1, now)
    .filter((d) => d.day >= recorded[0] && d.day < today)
    .map((d) => d.total);
  return days.length >= BASELINE_MIN_DAYS ? median(days) : null;
}

/**
 * Whether a site's failed logins need attention:
 * - a spike: at least 100 in 24 hours and 3× the usual daily count;
 * - otherwise at least 100 with nothing protecting the logins.
 * Steady background bot traffic on a protected site isn't flagged.
 */
export function loginAttention(input: {
  total24h: number;
  history: DayCounts[];
  protection: Pick<LoginProtection, "any">;
  now: number;
}): AttentionReason | null {
  const { total24h, history, protection, now } = input;
  if (total24h < ATTACK_MIN) return null;
  const usual = usualPerDay(history, now);
  if (usual !== null && total24h >= SPIKE_FACTOR * Math.max(usual, 1)) {
    return { text: `Login attack spike: ${total24h} failed logins (usually ~${Math.round(usual)} a day)`, severity: "bad" };
  }
  if (!protection.any) return { text: `${total24h} failed logins, no login protection`, severity: "warn" };
  return null;
}
