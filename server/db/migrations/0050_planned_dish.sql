CREATE TABLE "planned_dish" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" uuid NOT NULL,
	"day" date NOT NULL,
	"position" integer NOT NULL,
	"planned_by" text,
	"planned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "planned_dish" ADD CONSTRAINT "planned_dish_dish_id_dish_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dish"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_dish" ADD CONSTRAINT "planned_dish_planned_by_user_id_fk" FOREIGN KEY ("planned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planned_dish_dish_id_idx" ON "planned_dish" USING btree ("dish_id");--> statement-breakpoint
-- The Week Plan moves the Board Version (ADR 0008) like a Cooking does: it
-- belongs to its Board through its Dish.
CREATE TRIGGER board_version AFTER INSERT OR UPDATE OR DELETE ON planned_dish
  FOR EACH ROW EXECUTE FUNCTION board_version_by_dish_id();--> statement-breakpoint
-- A Dish moved to another Board leaves its old Board's Week Plan, whichever
-- write moved it (a move, a drag, a bulk move, the undo of a cook across
-- Boards). That is why it is a trigger and not code in each of them.
CREATE FUNCTION planned_dish_off_moved_dish() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM planned_dish WHERE dish_id = NEW.id;
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE TRIGGER planned_dish_off_moved_dish AFTER UPDATE OF board_id ON dish
  FOR EACH ROW WHEN (OLD.board_id IS DISTINCT FROM NEW.board_id)
  EXECUTE FUNCTION planned_dish_off_moved_dish();
