CREATE TABLE "cooking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dish_id" uuid NOT NULL,
	"cooked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text,
	"recorded_by" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cooking" ADD CONSTRAINT "cooking_dish_id_dish_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dish"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cooking" ADD CONSTRAINT "cooking_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cooking_dish_id_idx" ON "cooking" USING btree ("dish_id","cooked_at");