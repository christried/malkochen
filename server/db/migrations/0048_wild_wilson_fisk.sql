CREATE TABLE "recipe_finder" (
	"user_id" text PRIMARY KEY NOT NULL,
	"switched_on" boolean DEFAULT false NOT NULL,
	"asked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "recipe_finder" ADD CONSTRAINT "recipe_finder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;