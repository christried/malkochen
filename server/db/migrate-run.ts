import 'dotenv/config'
import { parseDatabaseEnv } from '../env'
import { migrateDatabase } from './migrate'

// `pnpm db:migrate`: applies pending migrations to DATABASE_URL.
migrateDatabase(parseDatabaseEnv(process.env).DATABASE_URL).then(
  () => console.log('Migrations applied.'),
  (err) => {
    console.error('Migration failed:', err)
    process.exit(1)
  },
)
