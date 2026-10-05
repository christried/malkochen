-- Readable addresses (issue #127). A Dish's short code: four characters from
-- an alphabet without look-alikes (0/o, 1/l/i), unique across all Dishes.
-- After ten draws in a row that are taken, codes get a character longer.
CREATE FUNCTION random_dish_code() RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  candidate text;
  tries int := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..(4 + tries / 10) LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM dish WHERE code = candidate);
    tries := tries + 1;
  END LOOP;
  RETURN candidate;
END
$$;--> statement-breakpoint
CREATE TABLE "board_slug" (
	"slug" text PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "dish" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "board_slug" ADD CONSTRAINT "board_slug_board_id_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_slug_board_id_idx" ON "board_slug" USING btree ("board_id");--> statement-breakpoint
-- Existing Dishes get their codes one by one, so each draw sees the ones
-- before it.
DO $$
DECLARE
  d record;
BEGIN
  FOR d IN SELECT id FROM dish LOOP
    UPDATE dish SET code = random_dish_code() WHERE id = d.id;
  END LOOP;
END
$$;--> statement-breakpoint
ALTER TABLE "dish" ALTER COLUMN "code" SET DEFAULT random_dish_code();--> statement-breakpoint
ALTER TABLE "dish" ALTER COLUMN "code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "dish" ADD CONSTRAINT "dish_code_unique" UNIQUE("code");--> statement-breakpoint
-- Existing Boards get slugs from their names, oldest Board first, as
-- shared/address.ts makes them (umlauts as ae/oe/ue, ß as ss, accents and
-- emoji dropped, at most 60 characters; "board" if nothing is left), and
-- "-2", "-3"... where one is taken. From now on the app picks them
-- (server/utils/addresses.ts).
DO $$
DECLARE
  b record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR b IN SELECT id, name FROM board ORDER BY created_at, id LOOP
    base := rtrim(left(ltrim(regexp_replace(lower(translate(
      replace(replace(replace(replace(replace(replace(replace(replace(b.name,
        'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'), 'Ä', 'ae'), 'Ö', 'oe'), 'Ü', 'ue'), 'ẞ', 'ss'),
      'ÀÁÂÃÅàáâãåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕòóôõÙÚÛùúûÝýÿÑñÇç',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOooooUUUuuuYyyNnCc'
    )), '[^a-z0-9]+', '-', 'g'), '-'), 60), '-');
    IF base = '' THEN base := 'board'; END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (SELECT 1 FROM board_slug WHERE slug = candidate) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    INSERT INTO board_slug (slug, board_id) VALUES (candidate, b.id);
    UPDATE board SET slug = candidate WHERE id = b.id;
  END LOOP;
END
$$;
