-- Limits per IP address for what needs no session (issue #247): the reports
-- of what broke a page's Content Security Policy (client_limit_use,
-- server/rate-limits.ts).
CREATE TABLE "client_limit_use" (
	"client" text NOT NULL,
	"limited" text NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"calls" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "client_limit_use_client_limited_pk" PRIMARY KEY("client","limited")
);
