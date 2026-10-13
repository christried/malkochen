-- Usernames (issue #209): the name a user picks for themselves, and the only
-- one the app shows of them. Unique whatever the case.
ALTER TABLE "user" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "username_confirmed_at" timestamp with time zone;--> statement-breakpoint
-- Every user from before gets one made from their Google first name: its
-- first word, without the ASCII characters a Username can't have (letters of
-- any alphabet stay, whatever the database's locale), at most 24 characters;
-- "Koch" if that leaves fewer than 2. The earliest user keeps the plain name,
-- later ones with the same name (whatever the case) get the next free
-- number: "Chris", "Chris2". Not confirmed: each is asked once whether theirs
-- fits ("Passt dein Name?").
DO $$
DECLARE
  person record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR person IN SELECT id, name FROM "user" ORDER BY created_at, id LOOP
    base := left(regexp_replace(split_part(btrim(regexp_replace(person.name, '\s+', ' ', 'g')), ' ', 1), '[\x01-\x2c\x2f\x3a-\x40\x5b-\x5e\x60\x7b-\x7f]', '', 'g'), 24);
    IF char_length(base) < 2 THEN
      base := 'Koch';
    END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM "user" WHERE lower(username) = lower(candidate)) LOOP
      n := n + 1;
      candidate := left(base, 24 - char_length(n::text)) || n;
    END LOOP;
    UPDATE "user" SET username = candidate WHERE id = person.id;
  END LOOP;
END
$$;--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_lower_idx" ON "user" USING btree (lower("username"));
