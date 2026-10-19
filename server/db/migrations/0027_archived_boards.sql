CREATE TABLE "archived_membership" (
	"board_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"is_owner" boolean NOT NULL,
	"last_opened_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"new_since" timestamp with time zone,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "archived_membership_board_id_user_id_pk" PRIMARY KEY("board_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "archived_membership" ADD CONSTRAINT "archived_membership_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archived_membership" ADD CONSTRAINT "archived_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archived_membership_user_id_idx" ON "archived_membership" USING btree ("user_id");