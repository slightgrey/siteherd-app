CREATE TABLE "update_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"user_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"items" jsonb NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "update_jobs" ADD CONSTRAINT "update_jobs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "update_jobs" ADD CONSTRAINT "update_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "update_jobs_site_created_idx" ON "update_jobs" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "update_jobs_one_active_idx" ON "update_jobs" USING btree ("site_id") WHERE status in ('queued', 'running');