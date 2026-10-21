CREATE TABLE "dish_opened" (
	"dish_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dish_opened_dish_id_user_id_pk" PRIMARY KEY("dish_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "dish_opened" ADD CONSTRAINT "dish_opened_dish_id_dish_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dish"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish_opened" ADD CONSTRAINT "dish_opened_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Every Member (also of an Archived Board) counts as having opened every
-- Dish on their Boards now, so
-- what happened before the cards could show it marks none of them (#335).
INSERT INTO "dish_opened" ("dish_id", "user_id", "opened_at")
SELECT "dish"."id", "members"."user_id", now()
FROM "dish" INNER JOIN (
  SELECT "board_id", "user_id" FROM "membership"
  UNION SELECT "board_id", "user_id" FROM "archived_membership"
) AS "members" ON "members"."board_id" = "dish"."board_id";
