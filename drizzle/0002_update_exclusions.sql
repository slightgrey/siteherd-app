CREATE TABLE "update_exclusions" (
	"site_id" uuid NOT NULL,
	"type" text NOT NULL,
	"item_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "update_exclusions_site_id_type_item_id_pk" PRIMARY KEY("site_id","type","item_id")
);
--> statement-breakpoint
ALTER TABLE "update_exclusions" ADD CONSTRAINT "update_exclusions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;