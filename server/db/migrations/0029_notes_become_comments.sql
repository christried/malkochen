-- Notes become Comments (#333): a Dish's note becomes a Comment by whoever
-- added the Dish, at the Dish's creation time; a Cooking's note one by
-- whoever recorded it, at its time. An author whose account is gone stays
-- null ("Gelöschtes Konto"). An empty note becomes nothing, nor does the
-- note of a deleted Cooking, which the Dish History leaves out. Then the
-- note columns go.
INSERT INTO "comment" ("dish_id", "author_id", "text", "created_at")
SELECT "id", "added_by", btrim("note", E' \t\r\n'), "created_at" FROM "dish"
WHERE btrim(coalesce("note", ''), E' \t\r\n') <> '';--> statement-breakpoint
INSERT INTO "comment" ("dish_id", "author_id", "text", "created_at")
SELECT "dish_id", "recorded_by", btrim("note", E' \t\r\n'), "cooked_at" FROM "cooking"
WHERE "deleted_at" IS NULL AND btrim(coalesce("note", ''), E' \t\r\n') <> '';--> statement-breakpoint
ALTER TABLE "cooking" DROP COLUMN "note";--> statement-breakpoint
ALTER TABLE "dish" DROP COLUMN "note";
