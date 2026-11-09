CREATE TABLE "snackbert_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cooking_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dish" ADD COLUMN "image_is_own_photo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "snackbert_report" ADD CONSTRAINT "snackbert_report_cooking_id_cooking_id_fk" FOREIGN KEY ("cooking_id") REFERENCES "public"."cooking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snackbert_report" ADD CONSTRAINT "snackbert_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snackbert_report_cooking_id_user_id_idx" ON "snackbert_report" USING btree ("cooking_id","user_id");