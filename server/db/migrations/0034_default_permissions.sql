-- Default Permissions (issue #343, CONTEXT.md): what a Member joining
-- through a Board's Invite Link gets. Every existing Board, archived ones
-- too, allows everything, as before, until its Owner changes them. A change
-- moves the Board Version through the Board's own trigger (migration 0032).
ALTER TABLE "board" ADD COLUMN "default_permissions" jsonb DEFAULT '{"addDishes":true,"editDishes":true,"moveDishes":true,"archiveDishes":true,"editColumns":true,"shareInvite":true,"commentAndVote":true,"editBoard":true}'::jsonb NOT NULL;
