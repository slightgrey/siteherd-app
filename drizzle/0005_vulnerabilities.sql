CREATE TABLE "feed_state" (
	"name" text PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone,
	"count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"attempted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vulnerabilities" (
	"id" text NOT NULL,
	"software_type" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"affected" jsonb NOT NULL,
	"patched_versions" jsonb NOT NULL,
	"cvss_score" double precision,
	"cvss_rating" text,
	"cve" text,
	"link" text,
	"published_at" timestamp with time zone,
	CONSTRAINT "vulnerabilities_id_software_type_slug_pk" PRIMARY KEY("id","software_type","slug")
);
--> statement-breakpoint
CREATE INDEX "vulnerabilities_slug_idx" ON "vulnerabilities" USING btree ("software_type","slug");