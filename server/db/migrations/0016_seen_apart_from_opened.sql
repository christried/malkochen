-- "Seen up to" apart from "opened last" (issue #227). Polling used to move
-- last_opened_at, so a poll of a Board just left that landed after the next
-- Board's open put the left one back in front. Polling now moves seen_at
-- only. Until now last_opened_at held both, so seen_at starts from it.
ALTER TABLE "membership" ADD COLUMN "seen_at" timestamp with time zone;--> statement-breakpoint
UPDATE "membership" SET "seen_at" = "last_opened_at";
