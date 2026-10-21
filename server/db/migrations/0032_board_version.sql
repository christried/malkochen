-- The Board Version (issue #338, ADR 0008): every change to what a Board's
-- Members see on it moves it on, so an open Board asks only for it and loads
-- the whole Board when it moved. Triggers move it, not the write handlers,
-- so none can forget to and hard deletes count too. Per-Member reading
-- state never moves it: seen_at, last_opened_at and new_since on membership,
-- and dish_opened. Nor does the event log, which no Member sees.
ALTER TABLE "board" ADD COLUMN "version" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE FUNCTION bump_board_version(target uuid) RETURNS void LANGUAGE sql AS $$
  UPDATE board SET version = version + 1 WHERE id = target
$$;--> statement-breakpoint
-- The Board's own row: its name, emoji, Invite Link, Address, archiving.
-- Any change but to the version itself, which the triggers below make.
CREATE FUNCTION board_version_on_board() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER board_version BEFORE UPDATE ON board
  FOR EACH ROW WHEN (OLD.* IS DISTINCT FROM NEW.* AND OLD.version = NEW.version)
  EXECUTE FUNCTION board_version_on_board();--> statement-breakpoint
-- A row that belongs to a Board by its board_id: both Boards when it moves
-- to another one.
CREATE FUNCTION board_version_by_board_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM bump_board_version(NEW.board_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM bump_board_version(OLD.board_id);
  ELSE
    PERFORM bump_board_version(OLD.board_id);
    IF NEW.board_id IS DISTINCT FROM OLD.board_id THEN PERFORM bump_board_version(NEW.board_id); END IF;
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
-- A row that belongs to a Board through its Dish. The Dish is gone when it
-- goes with it (a cascade), and the Dish's own trigger counts that.
CREATE FUNCTION board_version_by_dish_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM bump_board_version((SELECT board_id FROM dish WHERE id = NEW.dish_id));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM bump_board_version((SELECT board_id FROM dish WHERE id = OLD.dish_id));
  ELSE
    PERFORM bump_board_version((SELECT board_id FROM dish WHERE id = OLD.dish_id));
    IF NEW.dish_id IS DISTINCT FROM OLD.dish_id THEN
      PERFORM bump_board_version((SELECT board_id FROM dish WHERE id = NEW.dish_id));
    END IF;
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE TRIGGER board_version AFTER INSERT OR UPDATE OR DELETE ON board_column
  FOR EACH ROW EXECUTE FUNCTION board_version_by_board_id();--> statement-breakpoint
CREATE TRIGGER board_version AFTER INSERT OR UPDATE OR DELETE ON dish
  FOR EACH ROW EXECUTE FUNCTION board_version_by_board_id();--> statement-breakpoint
CREATE TRIGGER board_version AFTER INSERT OR UPDATE OR DELETE ON cooking
  FOR EACH ROW EXECUTE FUNCTION board_version_by_dish_id();--> statement-breakpoint
CREATE TRIGGER board_version AFTER INSERT OR UPDATE OR DELETE ON comment
  FOR EACH ROW EXECUTE FUNCTION board_version_by_dish_id();--> statement-breakpoint
CREATE TRIGGER board_version AFTER INSERT OR UPDATE OR DELETE ON vote
  FOR EACH ROW EXECUTE FUNCTION board_version_by_dish_id();--> statement-breakpoint
-- Members: joining, leaving, being removed, and who the Owner is. Their
-- reading state (seen_at, last_opened_at, new_since) stays out.
CREATE TRIGGER board_version_members AFTER INSERT OR DELETE ON membership
  FOR EACH ROW EXECUTE FUNCTION board_version_by_board_id();--> statement-breakpoint
CREATE TRIGGER board_version_owner AFTER UPDATE ON membership
  FOR EACH ROW WHEN (OLD.is_owner IS DISTINCT FROM NEW.is_owner OR OLD.board_id IS DISTINCT FROM NEW.board_id)
  EXECUTE FUNCTION board_version_by_board_id();--> statement-breakpoint
-- How a Member shows on each of their Boards: their Username and picture.
-- Every one of their Boards in one statement, rather than
-- bump_board_version() for each.
CREATE FUNCTION board_version_by_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE board SET version = version + 1
  WHERE id IN (SELECT board_id FROM membership WHERE user_id = NEW.id);
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE TRIGGER board_version AFTER UPDATE ON "user"
  FOR EACH ROW WHEN ((OLD.username, OLD.own_picture, OLD.image) IS DISTINCT FROM (NEW.username, NEW.own_picture, NEW.image))
  EXECUTE FUNCTION board_version_by_member();
