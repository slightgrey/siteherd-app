import { z } from "zod";
import { itemKey } from "./update-types";

// Shape of the JSON the wp-siteherd plugin sends (Siteherd_Collector::collect()).
// Reports are stored raw, so parse leniently: every field falls back to a safe
// default, and older plugins (schema 1) simply have no health/integrity.

const str = z.string().catch("");
const nullableStr = z.string().nullable().catch(null);
const count = z.number().int().nonnegative().catch(0);
const files = z.array(z.string()).catch([]);

const PluginSchema = z.object({
  file: z.string(),
  name: str,
  version: str,
  active: z.boolean().catch(false),
  update: nullableStr,
});

const ThemeSchema = z.object({
  stylesheet: z.string(),
  name: str,
  version: str,
  active: z.boolean().catch(false),
  update: nullableStr,
});

const HealthSchema = z.object({
  checked_at: str,
  counts: z.object({ good: count, recommended: count, critical: count }),
  issues: z
    .array(
      z.object({
        test: str,
        label: str,
        status: z.enum(["critical", "recommended"]).catch("recommended"),
        badge: str,
        description: str,
      }),
    )
    .catch([]),
  skipped: count,
});

const CoreIntegritySchema = z.object({
  status: z.enum(["ok", "issues", "error"]).catch("error"),
  error: nullableStr.optional(),
  modified: files,
  modified_count: count,
  missing: files,
  missing_count: count,
  unexpected: files,
  unexpected_count: count,
});

const PluginIntegritySchema = z.object({
  file: z.string(),
  status: z.enum(["ok", "issues", "not_checkable", "error"]).catch("error"),
  error: nullableStr.optional(),
  modified: files,
  modified_count: count,
  missing: files,
  missing_count: count,
});

const IntegritySchema = z.object({
  checked_at: str,
  core: CoreIntegritySchema,
  plugins: z.array(PluginIntegritySchema).catch([]),
});

// Schema 3+: one-click login settings. Older plugins don't support one-click login.
const SsoSchema = z.object({
  enabled: z.boolean().catch(false),
  // Administrator the site always logs in as; null means "ask every time".
  user_id: z.number().int().positive().nullable().catch(null),
  admins: z.array(z.object({ id: z.number().int().positive(), login: str, name: str })).catch([]),
});

// Schema 5+: language packs WordPress can update. slug is "default" for core,
// the plugin folder for plugins, the stylesheet for themes.
const TranslationSchema = z.object({
  type: z.enum(["core", "plugin", "theme"]).catch("core"),
  slug: str,
  language: str,
  version: str,
  updated: str,
});

// Schema 4+: versions the plugin saved when updating, available for rollback.
const RollbackSchema = z.object({
  type: z.enum(["plugin", "theme"]),
  id: z.string(),
  version: z.string(),
  kept_at: str,
});

const ReportSchema = z.object({
  schema: z.number().catch(1),
  plugin_version: str,
  site_url: str,
  // Schema 5+: the WordPress Site Icon (64 px), when one is set.
  site_icon: nullableStr,
  wp_version: str,
  php_version: str,
  db_version: str,
  is_multisite: z.boolean().catch(false),
  locale: str,
  core_update: nullableStr,
  plugins: z.array(PluginSchema).catch([]),
  themes: z.array(ThemeSchema).catch([]),
  translations: z.array(TranslationSchema).catch([]),
  failed_logins_24h: count,
  health: HealthSchema.nullable().catch(null),
  integrity: IntegritySchema.nullable().catch(null),
  sso: SsoSchema.nullable().catch(null),
  rollbacks: z.array(RollbackSchema).catch([]),
  generated_at: str,
});

export type Report = z.infer<typeof ReportSchema>;
export type ReportPlugin = z.infer<typeof PluginSchema>;
export type ReportTheme = z.infer<typeof ThemeSchema>;
export type Health = z.infer<typeof HealthSchema>;
export type Integrity = z.infer<typeof IntegritySchema>;
export type PluginIntegrity = z.infer<typeof PluginIntegritySchema>;
export type Sso = z.infer<typeof SsoSchema>;
export type Translation = z.infer<typeof TranslationSchema>;

/** The site's icon URL from the report, if it's a plain http(s) URL. */
export function siteIconUrl(report: Report | null) {
  const icon = report?.site_icon;
  return icon && /^https?:\/\//i.test(icon) ? icon : null;
}

/** Name of what a language pack belongs to: WordPress, or the plugin/theme's name from the report. */
export function translationOwner(report: Report, t: Translation) {
  if (t.type === "core") return "WordPress";
  if (t.type === "theme") return report.themes.find((x) => x.stylesheet === t.slug)?.name || t.slug;
  return report.plugins.find((p) => p.file.split("/")[0] === t.slug)?.name || t.slug;
}

/**
 * Which administrator one-click login should use, given the site's settings and
 * an optional choice from the dashboard. Null when it isn't possible.
 */
export function ssoUserFor(sso: Sso | null, requested?: number): number | null {
  if (!sso?.enabled) return null;
  if (sso.user_id) return sso.user_id;
  return requested && sso.admins.some((a) => a.id === requested) ? requested : null;
}

/** Returns null only if the payload isn't an object at all. */
export function parseReport(payload: unknown): Report | null {
  const result = ReportSchema.safeParse(payload ?? undefined);
  return result.success ? result.data : null;
}

/**
 * Pending updates, leaving out items the user excluded from updates on this
 * site (item keys from itemKey(); see lib/exclusions.ts).
 */
export function pendingUpdates(report: Report, excluded: ReadonlySet<string> = new Set()) {
  const plugins = report.plugins.filter((p) => p.update && !excluded.has(itemKey({ type: "plugin", id: p.file })));
  const themes = report.themes.filter((t) => t.update && !excluded.has(itemKey({ type: "theme", id: t.stylesheet })));
  const core = report.core_update && !excluded.has(itemKey({ type: "core", id: "core" })) ? report.core_update : null;
  // Language packs are updated all at once, so they count as one update (as in WordPress).
  const translations = report.translations.length;
  return {
    core,
    plugins,
    themes,
    translations,
    total: (core ? 1 : 0) + plugins.length + themes.length + (translations > 0 ? 1 : 0),
  };
}

/**
 * Plugins whose files differ from wordpress.org (edited on the site), by plugin
 * file. Updating one overwrites the edits.
 */
export function editedPlugins(report: Report): Map<string, PluginIntegrity> {
  return new Map((report.integrity?.plugins ?? []).filter((p) => p.status === "issues").map((p) => [p.file, p]));
}

/** Integrity problems worth alerting on. Plugins that can't be checked aren't problems. */
export function integrityProblems(integrity: Integrity | null) {
  if (!integrity) return null;
  const core = integrity.core;
  const coreFiles = core.modified_count + core.missing_count + core.unexpected_count;
  const plugins = integrity.plugins.filter((p) => p.status === "issues");
  return {
    coreError: core.status === "error" ? (core.error ?? "Unknown error") : null,
    coreFiles,
    plugins,
    total: coreFiles + plugins.length,
  };
}
