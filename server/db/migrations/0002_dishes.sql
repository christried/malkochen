CREATE TABLE "dish" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"placeholder" text NOT NULL,
	"added_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_column_id_board_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_column"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dish_board_id_idx" ON "dish" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "dish_column_id_position_idx" ON "dish" USING btree ("column_id","position");