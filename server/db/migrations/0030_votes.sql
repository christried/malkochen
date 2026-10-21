CREATE TABLE "vote" (
	"dish_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"up" boolean NOT NULL,
	"voted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_dish_id_user_id_pk" PRIMARY KEY("dish_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_dish_id_dish_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dish"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;