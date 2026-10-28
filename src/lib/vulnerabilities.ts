// Matching a site's report against known vulnerabilities (Wordfence Intelligence
// feed, stored by src/lib/vuln-feed.ts). Pure: no DB or server imports, so the
// client components and tests can use it.

import type { Report } from "@/lib/report";

/** One affected range from the feed. "*" as a bound means "no limit". */
export type VersionRange = {
  from_version: string;
  from_inclusive: boolean;
  to_version: string;
  to_inclusive: boolean;
};

export type SoftwareType = "plugin" | "theme" | "core";

/** A stored vulnerability row, as far as matching and display need it. */
export type VulnRow = {
  id: string;
  softwareType: SoftwareType;
  slug: string;
  title: string;
  affected: VersionRange[];
  patchedVersions: string[];
  cvssScore: number | null;
  cvssRating: string | null;
  cve: string | null;
  link: string | null;
};

export type Vuln = {
  id: string;
  title: string;
  /** "Critical" | "High" | "Medium" | "Low" | null when the feed has no CVSS data. */
  rating: string | null;
  score: number | null;
  cve: string | null;
  /** Lowest patched version above the installed one, or null if there's no fix yet. */
  fixedIn: string | null;
  link: string | null;
};

/** An installed plugin, theme or core with the vulnerabilities its version has. */
export type VulnerableItem = {
  type: SoftwareType;
  /** Plugin file, theme stylesheet, or "core" (the same ids as update items). */
  id: string;
  name: string;
  version: string;
  vulns: Vuln[];
};

// PHP's version_compare() ranks these words; any other word sorts below "dev".
const SPECIAL: Record<string, number> = { dev: 0, alpha: 1, a: 1, beta: 2, b: 2, rc: 3, "#": 4, pl: 5, p: 5 };

function canonical(version: string): string[] {
  const parts = version
    .trim()
    .toLowerCase()
    .replace(/[-_+]/g, ".")
    // Split "1.0rc1" into "1.0.rc.1", like PHP does.
    .replace(/(\d)([a-z])/g, "$1.$2")
    .replace(/([a-z])(\d)/g, "$1.$2")
    .split(".")
    .filter((p) => p !== "");
  // Trailing zero segments don't matter: 1.0 equals 1.0.0.
  while (parts.length > 1 && /^0+$/.test(parts[parts.length - 1])) parts.pop();
  return parts;
}

function rank(part: string) {
  return /^\d+$/.test(part) ? SPECIAL["#"] : (SPECIAL[part] ?? -1);
}

/** Like PHP's version_compare(a, b), except that trailing ".0"s are ignored. Returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = canonical(a);
  const pb = canonical(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return rank(y) === SPECIAL["#"] ? -1 : 1; // 1.0 < 1.0.1, but 1.0 > 1.0-beta
    if (y === undefined) return rank(x) === SPECIAL["#"] ? 1 : -1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d !== 0) return d < 0 ? -1 : 1;
      continue;
    }
    const d = rank(x) - rank(y);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function isAffected(version: string, range: VersionRange): boolean {
  const from = range.from_version?.trim();
  const to = range.to_version?.trim();
  if (from && from !== "*") {
    const c = compareVersions(version, from);
    if (c < 0 || (c === 0 && !range.from_inclusive)) return false;
  }
  if (to && to !== "*") {
    const c = compareVersions(version, to);
    if (c > 0 || (c === 0 && !range.to_inclusive)) return false;
  }
  return true;
}

/** wordpress.org slug of a plugin file: its folder, or the file name for single-file plugins. */
export function slugOf(pluginFile: string): string {
  const slash = pluginFile.indexOf("/");
  return slash > 0 ? pluginFile.slice(0, slash) : pluginFile.replace(/\.php$/i, "");
}

export function rowKey(type: SoftwareType, slug: string) {
  return `${type}:${slug.toLowerCase()}`;
}

/** The (type, slug) pairs a report needs vulnerability rows for. */
export function softwareKeys(report: Report): { type: SoftwareType; slug: string }[] {
  return [
    { type: "core" as const, slug: "wordpress" },
    ...report.plugins.map((p) => ({ type: "plugin" as const, slug: slugOf(p.file) })),
    ...report.themes.map((t) => ({ type: "theme" as const, slug: t.stylesheet })),
  ];
}

const RATING_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

/** Sort key for a vulnerability: rating first, then score. */
export function severityRank(v: Pick<Vuln, "rating" | "score">) {
  return (RATING_ORDER[v.rating?.toLowerCase() ?? ""] ?? 0) * 100 + (v.score ?? 0);
}

function toVuln(row: VulnRow, version: string): Vuln {
  const fixes = row.patchedVersions.filter((p) => compareVersions(p, version) > 0).sort(compareVersions);
  return {
    id: row.id,
    title: row.title,
    rating: row.cvssRating,
    score: row.cvssScore,
    cve: row.cve,
    fixedIn: fixes[0] ?? null,
    link: row.link,
  };
}

/** Installed items of a report that have known vulnerabilities, most severe first. */
export function matchReport(report: Report, rows: Map<string, VulnRow[]>): VulnerableItem[] {
  const installed = [
    { type: "core" as const, id: "core", slug: "wordpress", name: "WordPress", version: report.wp_version },
    ...report.plugins.map((p) => ({ type: "plugin" as const, id: p.file, slug: slugOf(p.file), name: p.name || p.file, version: p.version })),
    ...report.themes.map((t) => ({ type: "theme" as const, id: t.stylesheet, slug: t.stylesheet, name: t.name || t.stylesheet, version: t.version })),
  ];
  const items: VulnerableItem[] = [];
  for (const it of installed) {
    if (!it.version) continue;
    const vulns = (rows.get(rowKey(it.type, it.slug)) ?? [])
      .filter((row) => row.affected.some((range) => isAffected(it.version, range)))
      .map((row) => toVuln(row, it.version))
      .sort((a, b) => severityRank(b) - severityRank(a));
    if (vulns.length > 0) items.push({ type: it.type, id: it.id, name: it.name, version: it.version, vulns });
  }
  return items.sort((a, b) => severityRank(b.vulns[0]) - severityRank(a.vulns[0]));
}

/** Highest rating among the item's vulnerabilities, for badges. */
export function worstRating(item: VulnerableItem): string | null {
  return item.vulns[0]?.rating ?? null;
}
