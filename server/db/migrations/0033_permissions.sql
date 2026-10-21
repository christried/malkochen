-- Permissions (issue #340, CONTEXT.md): each Member's, as a fixed set of
-- flags. Every existing Member, and every archived membership, gets every
-- Permission, so nobody loses anything.
ALTER TABLE "archived_membership" ADD COLUMN "permissions" jsonb DEFAULT '{"addDishes":true,"editDishes":true,"moveDishes":true,"archiveDishes":true,"editColumns":true,"shareInvite":true,"commentAndVote":true,"editBoard":true}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "permissions" jsonb DEFAULT '{"addDishes":true,"editDishes":true,"moveDishes":true,"archiveDishes":true,"editColumns":true,"shareInvite":true,"commentAndVote":true,"editBoard":true}'::jsonb NOT NULL;--> statement-breakpoint
-- A Member's Permissions changing moves the Board Version (ADR 0008), like
-- who the Owner is, so their open Board follows at its next check.
DROP TRIGGER board_version_owner ON membership;--> statement-breakpoint
CREATE TRIGGER board_version_standing AFTER UPDATE ON membership
  FOR EACH ROW WHEN (OLD.is_owner IS DISTINCT FROM NEW.is_owner OR OLD.permissions IS DISTINCT FROM NEW.permissions OR OLD.board_id IS DISTINCT FROM NEW.board_id)
  EXECUTE FUNCTION board_version_by_board_id();
