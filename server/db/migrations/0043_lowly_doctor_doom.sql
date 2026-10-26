ALTER TABLE "setting" ADD COLUMN "source_facts_before" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "setting" ADD COLUMN "source_facts_filled_at" timestamp with time zone;
--> statement-breakpoint
-- The Dishes the backfill fills are those created before this deploy; later Dishes get their value when they are added.
-- An hour past the migration: Vercel migrates during the build, and the old deploy keeps adding Dishes with no value
-- until the new one is live. The backfill reads only Dishes with no value, so the new deploy's own are left alone.
UPDATE "setting" SET "source_facts_before" = now() + interval '1 hour';
