ALTER TABLE "board_column" ADD COLUMN "subtitle" text;--> statement-breakpoint
-- Column Subtitles (#121): existing Boards get the default ones only where a
-- Column still has its default name. The Gekocht Column's is fixed and not stored.
UPDATE "board_column" SET "subtitle" = 'Worauf hast du Lust?' WHERE "name" = 'Ideen' AND NOT "is_gekocht";--> statement-breakpoint
UPDATE "board_column" SET "subtitle" = 'Das steht an.' WHERE "name" = 'Diese Woche' AND NOT "is_gekocht";
