ALTER TABLE "comment" ADD COLUMN "arrived_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cooking" ADD COLUMN "arrived_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vote" ADD COLUMN "arrived_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Everything before this deploy arrived when it was made (ADR 0012).
UPDATE "comment" SET "arrived_at" = "created_at";--> statement-breakpoint
UPDATE "cooking" SET "arrived_at" = "cooked_at";--> statement-breakpoint
UPDATE "vote" SET "arrived_at" = "voted_at";
