CREATE TABLE "event_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "event_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"board_id" uuid NOT NULL,
	"dish_id" uuid,
	"user_id" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE INDEX "event_log_at_idx" ON "event_log" USING btree ("at");