-- The Admin Page (issue #348): per UTC day, the emails Resend took and the
-- polls of open Boards (counted one in ten), which no other table holds, to
-- compare with the free tiers of Resend and Vercel.
CREATE TABLE "usage_count" (
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "usage_count_day_kind_pk" PRIMARY KEY("day","kind")
);
