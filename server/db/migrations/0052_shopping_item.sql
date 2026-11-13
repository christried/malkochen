CREATE TABLE "shopping_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"text" text NOT NULL,
	"dish_id" uuid,
	"dish_title" text,
	"group_at" timestamp with time zone,
	"position" integer NOT NULL,
	"ticked" boolean DEFAULT false NOT NULL,
	"added_by" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_item" ADD CONSTRAINT "shopping_item_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_item_board_id_idx" ON "shopping_item" USING btree ("board_id");--> statement-breakpoint
-- The Shopping List moves the Board Version (ADR 0008) like a Column does: it
-- belongs to its Board by its board_id.
CREATE TRIGGER board_version AFTER INSERT OR UPDATE OR DELETE ON shopping_item
  FOR EACH ROW EXECUTE FUNCTION board_version_by_board_id();
