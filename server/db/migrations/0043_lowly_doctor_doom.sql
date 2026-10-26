ALTER TABLE "setting" ADD COLUMN "source_facts_before" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "setting" ADD COLUMN "source_facts_filled_at" timestamp with time zone;
--> statement-breakpoint
-- The Dishes the backfill fills are those created before this deploy; later Dishes get their value when they are added.
UPDATE "setting" SET "source_facts_before" = now();
