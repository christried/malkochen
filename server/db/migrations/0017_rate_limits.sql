-- Rate limits (issue #196): Better Auth's counts in the database instead of
-- each instance's memory (rate_limit), and malkochen's own per-user limits on
-- costly calls (rate_limit_use, server/rate-limits.ts).
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_use" (
	"user_id" text NOT NULL,
	"limited" text NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"calls" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limit_use_user_id_limited_pk" PRIMARY KEY("user_id","limited")
);
--> statement-breakpoint
ALTER TABLE "rate_limit_use" ADD CONSTRAINT "rate_limit_use_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;