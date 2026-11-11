ALTER TABLE "dish" ADD COLUMN "recipe_ingredients" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "dish" ADD COLUMN "recipe_steps" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "dish" ADD COLUMN "recipe_link" text;