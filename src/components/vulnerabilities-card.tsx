import { ExternalLink, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ItemIcon } from "@/components/item-icons";
import { ToneBadge } from "@/components/report-badges";
import { timeAgo } from "@/components/site-status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { feedConfigured, loadFeedState } from "@/lib/vuln-feed";
import { severityRank, slugOf, type Vuln, type VulnerableItem } from "@/lib/vulnerabilities";

/** One vulnerable plugin/theme/core, with the sites that have it (fleet view) or none (site view). */
export type VulnGroup = {
  item: VulnerableItem;
  sites?: { id: string; name: string; version: string }[];
};

/** Groups the fleet's vulnerable items by plugin/theme/core, most severe first. */
export function groupFleetVulns(sites: { id: string; name: string; vulns: VulnerableItem[] }[]): VulnGroup[] {
  const groups = new Map<string, { item: VulnerableItem; sites: { id: string; name: string; version: string }[] }>();
  for (const site of sites) {
    for (const item of site.vulns) {
      const key = `${item.type}:${item.type === "plugin" ? slugOf(item.id) : item.id}`;
      const group = groups.get(key) ?? { item: { ...item, vulns: [] }, sites: [] };
      const seen = new Set(group.item.vulns.map((v) => v.id));
      group.item.vulns.push(...item.vulns.filter((v) => !seen.has(v.id)));
      group.sites.push({ id: site.id, name: site.name, version: item.version });
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, item: { ...g.item, vulns: g.item.vulns.sort((a, b) => severityRank(b) - severityRank(a)) } }))
    .sort((a, b) => severityRank(b.item.vulns[0]) - severityRank(a.item.vulns[0]) || b.sites.length - a.sites.length);
}

const RATING_TONE: Record<string, "bad" | "warn" | "muted"> = { critical: "bad", high: "bad", medium: "warn", low: "muted" };

function RatingBadge({ vuln }: { vuln: Vuln }) {
  if (!vuln.rating) return <ToneBadge t="bad">Vulnerable</ToneBadge>;
  return (
    <ToneBadge t={RATING_TONE[vuln.rating.toLowerCase()] ?? "bad"}>
      {vuln.rating}
      {vuln.score !== null && ` ${vuln.score.toFixed(1)}`}
    </ToneBadge>
  );
}

/**
 * Known vulnerabilities (Wordfence Intelligence) in installed plugins, themes
 * and core. Shows the feed's state when there's nothing to list yet.
 */
export async function VulnerabilitiesCard({ groups, now, updatesHref }: { groups: VulnGroup[]; now: number; updatesHref: string }) {
  const configured = feedConfigured();
  const feed = configured ? await loadFeedState() : null;
  const total = groups.reduce((n, g) => n + g.item.vulns.length, 0);

  let status: React.ReactNode;
  if (!configured) status = "Add a Wordfence API key (WORDFENCE_API_KEY) to check for vulnerabilities.";
  else if (!feed?.syncedAt) status = feed?.error ? `Couldn't download vulnerability data yet: ${feed.error}` : "Downloading vulnerability data… Refresh in a minute.";
  else status = `${feed.count.toLocaleString()} known vulnerabilities checked, data updated ${timeAgo(feed.syncedAt, now)}.`;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          Vulnerabilities
          {total > 0 && <ToneBadge t="bad">{total}</ToneBadge>}
        </CardTitle>
        <CardDescription>{status}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {configured && feed?.syncedAt && groups.length === 0 && (
          <div className="flex items-center gap-3 px-6 py-8 text-sm">
            <span className="flex size-10 items-center justify-center rounded-full bg-good-soft text-good">
              <ShieldCheck className="size-5" />
            </span>
            No known vulnerabilities in the installed versions.
          </div>
        )}
        {groups.length > 0 && (
          <ul className="divide-y">
            {groups.map(({ item, sites }) => (
              <li key={`${item.type}:${item.id}`} className="flex gap-4 px-6 py-5">
                <ItemIcon type={item.type === "core" ? "core" : item.type} id={item.id} slug={item.type === "plugin" ? slugOf(item.id) : null} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    {!sites && <span className="font-mono text-xs text-muted-foreground">{item.version}</span>}
                    <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                  </div>
                  {sites && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {sites.map((s) => (
                        <Link key={s.id} href={`/sites/${s.id}/${item.type === "theme" ? "themes" : item.type === "core" ? "core" : "plugins"}`} className="hover:text-foreground hover:underline">
                          {s.name} <span className="font-mono">{s.version}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  <ul className="mt-3 grid gap-2">
                    {item.vulns.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 text-sm">
                        <RatingBadge vuln={v} />
                        <div className="min-w-0 flex-1">
                          <div>{v.title}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                            {v.fixedIn ? (
                              <span className="text-good">Fixed in {v.fixedIn}</span>
                            ) : (
                              <span className="text-bad">No fix yet: consider removing it</span>
                            )}
                            {v.cve && <span className="font-mono">{v.cve}</span>}
                            {v.link && (
                              <a href={v.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
                                Details <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {item.vulns.some((v) => v.fixedIn) && (
                  <Link href={updatesHref} className="h-fit shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted">
                    Update
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {configured && (
          <p className="border-t px-6 py-3 text-xs text-muted-foreground">
            <ShieldAlert className="mr-1.5 inline size-3.5 align-[-2px]" />
            Vulnerability data provided by{" "}
            <a href="https://www.wordfence.com/threat-intel/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              Wordfence Intelligence
            </a>
            . Copyright 2012-{new Date(now).getFullYear()} Defiant Inc., used under its{" "}
            <a href="https://www.wordfence.com/wordfence-intelligence-terms-and-conditions/" target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
              license
            </a>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}
