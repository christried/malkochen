-- Readable Invite Links (issue #128). An Invite Link's secret: 17
-- characters from the alphabet of Dish codes (no look-alikes: 0/o, 1/l/i),
-- about 84 bits. The bytes come from gen_random_uuid(), which draws them
-- from a cryptographically strong source (random() does not): the 14 of
-- its 16 that aren't version or variant bits, each below 248 (8 x 31) so
-- that every character is equally likely. Boards keep the token they have
-- (32 hex characters, still a working link) until it is reset.
CREATE FUNCTION random_invite_secret() RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet constant text := '23456789abcdefghjkmnpqrstuvwxyz';
  bytes bytea;
  b int;
  secret text := '';
BEGIN
  WHILE length(secret) < 17 LOOP
    bytes := uuid_send(gen_random_uuid());
    FOR i IN 0..15 LOOP
      CONTINUE WHEN i IN (6, 8);
      b := get_byte(bytes, i);
      CONTINUE WHEN b >= 248;
      secret := secret || substr(alphabet, 1 + b % 31, 1);
      EXIT WHEN length(secret) = 17;
    END LOOP;
  END LOOP;
  RETURN secret;
END
$$;--> statement-breakpoint
CREATE TABLE "invite_miss" (
	"client" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"misses" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "invite_token" SET DEFAULT random_invite_secret();