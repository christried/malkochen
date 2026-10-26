ALTER TABLE "dish" ADD COLUMN "link_secret" text;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_link_secret_unique" UNIQUE("link_secret");