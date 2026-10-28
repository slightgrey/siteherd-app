import { z } from "zod";

// Searching the wordpress.org plugin directory for the "Add plugin" sheet.
// https://codex.wordpress.org/WordPress.org_API#Plugins

export type WporgPlugin = {
  slug: string;
  name: string;
  author: string;
  version: string;
  rating: number; // 0-100
  ratings: number;
  activeInstalls: number;
  tested: string | null;
  requiresPhp: string | null;
  description: string;
  icon: string | null;
};

const ResultSchema = z.object({
  plugins: z.array(
    z.object({
      slug: z.string(),
      name: z.string().catch(""),
      author: z.string().catch(""),
      version: z.string().catch(""),
      rating: z.coerce.number().catch(0),
      num_ratings: z.coerce.number().catch(0),
      active_installs: z.coerce.number().catch(0),
      tested: z.string().nullable().catch(null),
      requires_php: z.union([z.string(), z.literal(false)]).nullable().catch(null),
      short_description: z.string().catch(""),
      icons: z.record(z.string(), z.string()).catch({}),
    }),
  ),
});

// The API returns names and descriptions with HTML entities and tags.
function plain(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export async function searchPlugins(query: string): Promise<WporgPlugin[]> {
  const params = new URLSearchParams({
    action: "query_plugins",
    "request[search]": query,
    "request[per_page]": "12",
    "request[fields][icons]": "1",
    "request[fields][active_installs]": "1",
    "request[fields][short_description]": "1",
    "request[fields][sections]": "0",
    "request[fields][tags]": "0",
    "request[fields][versions]": "0",
  });
  const res = await fetch(`https://api.wordpress.org/plugins/info/1.2/?${params}`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`wordpress.org answered with HTTP ${res.status}`);
  const parsed = ResultSchema.safeParse(await res.json());
  if (!parsed.success) return [];
  return parsed.data.plugins.map((p) => ({
    slug: p.slug,
    name: plain(p.name) || p.slug,
    author: plain(p.author),
    version: p.version,
    rating: p.rating,
    ratings: p.num_ratings,
    activeInstalls: p.active_installs,
    tested: p.tested,
    requiresPhp: p.requires_php || null,
    description: plain(p.short_description),
    icon: p.icons["2x"] ?? p.icons["1x"] ?? p.icons.svg ?? null,
  }));
}
