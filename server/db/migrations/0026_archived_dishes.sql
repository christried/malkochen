ALTER TABLE "dish" ALTER COLUMN "column_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dish" ADD COLUMN "archived_by" text;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_archived_by_user_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_column_unless_archived" CHECK ("dish"."deleted_at" is not null or "dish"."column_id" is not null);--> statement-breakpoint
-- Who archived a Dish already archived: the last archiving the event log
-- (#331) recorded for it, if that account still exists. One archived before
-- the log began stays unknown.
UPDATE "dish" SET "archived_by" = (
  SELECT "event_log"."user_id" FROM "event_log"
  WHERE "event_log"."kind" = 'dish_archived' AND "event_log"."dish_id" = "dish"."id"
    AND EXISTS (SELECT 1 FROM "user" WHERE "user"."id" = "event_log"."user_id")
  ORDER BY "event_log"."id" DESC LIMIT 1
) WHERE "dish"."deleted_at" IS NOT NULL;
