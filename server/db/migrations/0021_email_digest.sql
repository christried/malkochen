CREATE TABLE "email_digest" (
	"user_id" text PRIMARY KEY NOT NULL,
	"covered_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_digest" ADD CONSTRAINT "email_digest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;