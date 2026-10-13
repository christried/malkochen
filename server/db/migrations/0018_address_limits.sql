-- Limits per IP address for what needs no session (issue #247): the reports
-- of what broke a page's Content Security Policy (address_limit_use,
-- server/rate-limits.ts).
CREATE TABLE "address_limit_use" (
	"address" text NOT NULL,
	"limited" text NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"calls" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "address_limit_use_address_limited_pk" PRIMARY KEY("address","limited")
);
