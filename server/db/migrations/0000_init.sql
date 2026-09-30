-- Baseline: the schema starts empty. Applying it creates Drizzle's migration
-- journal (drizzle.__drizzle_migrations), which /api/health checks. Feature
-- tickets add their tables with `pnpm db:generate` on top of this.
SELECT 1;
