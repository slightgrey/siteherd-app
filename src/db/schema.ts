import { relations, sql } from "drizzle-orm";
import { JOB_KINDS, type UpdateItem, type UpdateResult } from "../lib/update-types";
import type { VersionRange } from "../lib/vulnerabilities";
import {
  bigserial,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Always stored lowercased; see normalizeEmail().
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// The uuid primary key doubles as the public Site ID sent in X-Siteherd-Site.
// The secret is stored in plaintext because the dashboard needs it to compute
// HMACs (both to verify pushes and to sign pulls).
export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastReportAt: timestamp("last_report_at", { withTimezone: true }),
}, (t) => [index("sites_user_idx").on(t.userId)]);

export const reports = pgTable(
  "reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    // Kept so a captured request can't be replayed inside the 5-minute window.
    signature: text("signature").notNull(),
    payload: jsonb("payload").notNull(),
  },
  (t) => [
    uniqueIndex("reports_site_signature_idx").on(t.siteId, t.signature),
    index("reports_site_received_idx").on(t.siteId, t.receivedAt),
  ],
);

// Remote update runs. The plugin does the work in the background and pushes
// progress to /api/sites/update-result; see src/lib/updates.ts.
export const updateJobs = pgTable(
  "update_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    // "rollback" jobs go back to an earlier version (item.to is the older version).
    // "install" / "delete" / "activate" / "deactivate" manage plugins (schema 6+).
    kind: text("kind", { enum: JOB_KINDS }).notNull().default("update"),
    // "waiting": queued in the dashboard behind the site's active job, not sent
    // yet (see advanceQueue()). "queued": sent to the site, not started.
    status: text("status", { enum: ["waiting", "queued", "running", "completed", "failed"] }).notNull().default("queued"),
    items: jsonb("items").$type<UpdateItem[]>().notNull(),
    results: jsonb("results").$type<UpdateResult[]>().notNull().default([]),
    error: text("error"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("update_jobs_site_created_idx").on(t.siteId, t.createdAt),
    // One active job per site; the plugin also refuses a second one.
    uniqueIndex("update_jobs_one_active_idx").on(t.siteId).where(sql`status in ('queued', 'running')`),
  ],
);

// Items the user never wants updated from the dashboard on a site (e.g. a
// customised plugin). They are hidden from pending counts and can't be updated.
export const updateExclusions = pgTable(
  "update_exclusions",
  {
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["plugin", "theme", "core"] }).notNull(),
    // Plugin file, theme stylesheet, or "core".
    itemId: text("item_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.type, t.itemId] })],
);

// The user's own labels for grouping sites (e.g. by client or agency).
// `color` is a key of LABEL_COLORS in src/lib/labels.ts.
export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("gray"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Names are unique per user, ignoring case.
  (t) => [uniqueIndex("labels_user_name_idx").on(t.userId, sql`lower(${t.name})`)],
);

// Which labels a site has; a label can be on many sites and a site can have many labels.
export const siteLabels = pgTable(
  "site_labels",
  {
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.labelId] }), index("site_labels_label_idx").on(t.labelId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  sites: many(sites),
  labels: many(labels),
}));

// Known vulnerabilities from the Wordfence Intelligence feed, one row per
// affected piece of software. Replaced wholesale by syncFeed() (src/lib/vuln-feed.ts).
export const vulnerabilities = pgTable(
  "vulnerabilities",
  {
    id: text("id").notNull(),
    softwareType: text("software_type", { enum: ["plugin", "theme", "core"] }).notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    affected: jsonb("affected").$type<VersionRange[]>().notNull(),
    patchedVersions: jsonb("patched_versions").$type<string[]>().notNull(),
    cvssScore: doublePrecision("cvss_score"),
    cvssRating: text("cvss_rating"),
    cve: text("cve"),
    link: text("link"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.id, t.softwareType, t.slug] }), index("vulnerabilities_slug_idx").on(t.softwareType, t.slug)],
);

// Bookkeeping for background jobs: the "wordfence" feed sync and "report_retention".
export const feedState = pgTable("feed_state", {
  name: text("name").primaryKey(),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  count: integer("count").notNull().default(0),
  error: text("error"),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
});

export const sitesRelations = relations(sites, ({ one, many }) => ({
  user: one(users, { fields: [sites.userId], references: [users.id] }),
  reports: many(reports),
  updateJobs: many(updateJobs),
  siteLabels: many(siteLabels),
}));

export const labelsRelations = relations(labels, ({ one, many }) => ({
  user: one(users, { fields: [labels.userId], references: [users.id] }),
  siteLabels: many(siteLabels),
}));

export const siteLabelsRelations = relations(siteLabels, ({ one }) => ({
  site: one(sites, { fields: [siteLabels.siteId], references: [sites.id] }),
  label: one(labels, { fields: [siteLabels.labelId], references: [labels.id] }),
}));

export const updateJobsRelations = relations(updateJobs, ({ one }) => ({
  site: one(sites, { fields: [updateJobs.siteId], references: [sites.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  site: one(sites, { fields: [reports.siteId], references: [sites.id] }),
}));

export type Site = typeof sites.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type UpdateJob = typeof updateJobs.$inferSelect;
export type Label = typeof labels.$inferSelect;
