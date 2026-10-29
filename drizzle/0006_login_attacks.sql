CREATE TABLE "failed_login_hours" (
	"site_id" uuid NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"login" integer DEFAULT 0 NOT NULL,
	"xmlrpc" integer DEFAULT 0 NOT NULL,
	"rest" integer DEFAULT 0 NOT NULL,
	"other" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "failed_login_hours_site_id_hour_pk" PRIMARY KEY("site_id","hour")
);
--> statement-breakpoint
CREATE TABLE "site_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"data" jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "failed_login_hours" ADD CONSTRAINT "failed_login_hours_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_events" ADD CONSTRAINT "site_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_events_site_at_idx" ON "site_events" USING btree ("site_id","at");