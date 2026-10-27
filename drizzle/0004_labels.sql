CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_labels" (
	"site_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "site_labels_site_id_label_id_pk" PRIMARY KEY("site_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_labels" ADD CONSTRAINT "site_labels_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_labels" ADD CONSTRAINT "site_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_user_name_idx" ON "labels" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "site_labels_label_idx" ON "site_labels" USING btree ("label_id");