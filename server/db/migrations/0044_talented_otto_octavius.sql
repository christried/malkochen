CREATE TABLE "snackbert" (
	"user_id" text PRIMARY KEY NOT NULL,
	"switched_on" boolean DEFAULT false NOT NULL,
	"has_account" boolean NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "snackbert" ADD CONSTRAINT "snackbert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;