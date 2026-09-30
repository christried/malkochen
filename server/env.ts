import { z } from 'zod'

// The one list of environment variables the server needs. Every new variable
// is added here, to .env.example, and to the README's "Environment variables"
// table -- and set in Vercel for production, preview and development.
const databaseEnvSchema = z.object({
  // Postgres connection string: Neon in deployed environments, a local
  // Postgres (localhost) in tests and optionally in dev.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
})

function isDeployed(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'production' || vercelEnv === 'preview'
}

const serverEnvSchema = databaseEnvSchema.extend({
  // Signs session cookies. A long random string, different per environment.
  BETTER_AUTH_SECRET: z.string().min(32),
  // The app's public origin, e.g. https://malkochen.example or
  // http://localhost:3000. Google redirects back to <this>/api/auth/callback/google.
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  // Comma-separated email addresses allowed to sign in at all.
  ALLOWLIST_EMAILS: z.string().default(''),
  // Local dev and tests only: '1' enables POST /api/auth/dev/sign-in, which
  // signs in any Allowlisted email without Google.
  AUTH_DEV_BYPASS: z.enum(['', '0', '1']).default(''),
  // Vercel Blob read/write token for the Image Store. Without it, images are
  // stored on disk under .data/images (local dev and tests only).
  BLOB_READ_WRITE_TOKEN: z.string().default(''),
  // Set by Vercel itself; used to refuse the dev bypass there and to require
  // the Blob token.
  VERCEL_ENV: z.string().optional(),
}).refine(
  env => !(env.AUTH_DEV_BYPASS === '1' && isDeployed(env.VERCEL_ENV)),
  { path: ['AUTH_DEV_BYPASS'], message: 'must never be set in Vercel production or preview' },
).refine(
  env => env.BLOB_READ_WRITE_TOKEN !== '' || !isDeployed(env.VERCEL_ENV),
  { path: ['BLOB_READ_WRITE_TOKEN'], message: 'is required in Vercel production and preview' },
)

type Source = Record<string, string | undefined>

function parse<T>(schema: z.ZodType<T>, source: Source): T {
  const result = schema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment -- check .env against .env.example. ${problems}`)
  }
  return result.data
}

// Everything the app server needs. Checked once at boot (server/plugins/env.ts).
export function parseServerEnv(source: Source) {
  return parse(serverEnvSchema, source)
}

// Only the database connection -- for the migrator and the db module, which
// must not need auth secrets.
export function parseDatabaseEnv(source: Source) {
  return parse(databaseEnvSchema, source)
}
