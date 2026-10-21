-- Account deletion (issue #346, CONTEXT.md: Deleted Account): a Vote stays
-- when its Member deletes their account, by nobody, like their Dishes,
-- Cookings and Comments. So it gets an id of its own, and one per Dish and
-- Member becomes a unique index, under which Votes by nobody never clash.
ALTER TABLE "vote" DROP CONSTRAINT "vote_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "vote" DROP CONSTRAINT "vote_dish_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "vote" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vote" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vote_dish_id_user_id_idx" ON "vote" USING btree ("dish_id","user_id");