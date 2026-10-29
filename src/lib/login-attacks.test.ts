import { describe, expect, it } from "vitest";
import { fillDays, loginAttention, usualPerDay, type DayCounts } from "./login-attacks";

const NOW = Date.parse("2026-10-29T15:00:00Z");
const day = (d: string, login: number, xmlrpc = 0): DayCounts => ({ day: d, login, xmlrpc, rest: 0, other: 0 });
const week = ["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"];

describe("fillDays", () => {
  it("returns one entry per day up to today, zeros for gaps", () => {
    const days = fillDays([day("2026-10-28", 5, 2)], 3, NOW);
    expect(days.map((d) => [d.day, d.total])).toEqual([
      ["2026-10-27", 0],
      ["2026-10-28", 7],
      ["2026-10-29", 0],
    ]);
  });
});

describe("usualPerDay", () => {
  it("is the median of the full days before today", () => {
    const history = week.map((d, i) => day(d, [100, 120, 90, 110, 5000, 100, 95][i]));
    expect(usualPerDay([...history, day("2026-10-29", 9999)], NOW)).toBe(100);
  });

  it("counts quiet days after the first recorded one as zero", () => {
    expect(usualPerDay([day("2026-10-25", 40)], NOW)).toBe(0);
  });

  it("needs at least 3 days since recording started", () => {
    expect(usualPerDay([day("2026-10-27", 40), day("2026-10-28", 50)], NOW)).toBeNull();
    expect(usualPerDay([], NOW)).toBeNull();
  });
});

describe("loginAttention", () => {
  const steady = week.map((d) => day(d, 3000));
  const unprotected = { any: false };
  const protectedSite = { any: true };

  it("ignores small numbers", () => {
    expect(loginAttention({ total24h: 99, history: [], protection: unprotected, now: NOW })).toBeNull();
  });

  it("flags a spike over the usual level, even when protected", () => {
    const r = loginAttention({ total24h: 9500, history: steady, protection: protectedSite, now: NOW });
    expect(r).toEqual({ text: "Login attack spike: 9500 failed logins (usually ~3000 a day)", severity: "bad" });
  });

  it("doesn't flag steady traffic on a protected site", () => {
    expect(loginAttention({ total24h: 3100, history: steady, protection: protectedSite, now: NOW })).toBeNull();
  });

  it("warns about steady traffic without protection", () => {
    expect(loginAttention({ total24h: 3100, history: steady, protection: unprotected, now: NOW })).toEqual({
      text: "3100 failed logins, no login protection",
      severity: "warn",
    });
  });

  it("treats a usual level of zero as one a day", () => {
    const quiet = week.map((d) => day(d, 0));
    quiet[0] = day("2026-10-22", 1);
    expect(loginAttention({ total24h: 150, history: quiet, protection: protectedSite, now: NOW })?.severity).toBe("bad");
  });
});
