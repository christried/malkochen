-- The Changelog (issue #354): the last Version each user opened it in, so
-- Your Settings can mark "Was ist neu" as new until they do.
ALTER TABLE "user" ADD COLUMN "version_seen" text;
