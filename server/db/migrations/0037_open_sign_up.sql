-- Open Sign-up (issue #350): malkochen's own settings, one row, switched by
-- the Operator on the Admin Page; Open Sign-up starts off. The switch is
-- recorded in the event log, as an event of no Board.
CREATE TABLE "setting" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"open_sign_up" boolean DEFAULT false NOT NULL,
	CONSTRAINT "setting_one_row" CHECK ("setting"."id")
);
--> statement-breakpoint
INSERT INTO "setting" DEFAULT VALUES;
--> statement-breakpoint
ALTER TABLE "event_log" ALTER COLUMN "board_id" DROP NOT NULL;
