import { z } from 'zod'

// The one list of environment variables the server needs. Every new variable
// is added here, to .env.example, and to the README's "Environment variables"
// table -- and set in the Vercel environments the README's table names for it.
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
  // Where the disk keeps images without a Blob token. The API tests give
  // their server a folder of its own, so its cleanup job never sweeps away
  // the images of local dev.
  IMAGE_DIR: z.string().default('').transform(dir => dir || '.data/images'),
  // Vercel Cron sends it as a bearer token to the daily jobs under
  // /api/cron/ (server/utils/cron.ts), which refuse every request without
  // it. Empty: they never run.
  CRON_SECRET: z.union([z.literal(''), z.string().min(16)]).default(''),
  // Push notifications (server/utils/push.ts): the VAPID key pair the app
  // signs its pushes with, base64url as `web-push generate-vapid-keys` prints
  // them, and who the push services can contact about them (mailto: or
  // https:). The public key also reaches the client, which subscribes with
  // it (nuxt.config.ts runtimeConfig). All three or none: without them the
  // settings offer no push notifications and nothing is sent.
  VAPID_PUBLIC_KEY: z.union([z.literal(''), z.string().regex(/^[\w-]{87}$/, 'must be a base64url P-256 public key')]).default(''),
  VAPID_PRIVATE_KEY: z.union([z.literal(''), z.string().regex(/^[\w-]{43}$/, 'must be a base64url P-256 private key')]).default(''),
  VAPID_SUBJECT: z.union([z.literal(''), z.string().regex(/^(mailto:\S+@\S+|https:\/\/\S+)$/, 'must be a mailto: or https: address')]).default(''),
  // The Email Digest (#220, server/utils/email-digest.ts): the Resend API key
  // it is sent with, from the verified christried.me domain. Whether it is
  // set also reaches the client (nuxt.config.ts runtimeConfig). Empty: the
  // settings offer no digest and nothing is sent.
  RESEND_API_KEY: z.union([z.literal(''), z.string().regex(/^re_\w+$/, 'must be a Resend API key (re_…)')]).default(''),
  // Tests only: where Resend's API is instead (a stand-in that keeps what is
  // sent). Empty: Resend itself.
  RESEND_BASE_URL: z.union([z.literal(''), z.url({ protocol: /^https?$/ })]).default(''),
  // Set by Vercel itself; used to refuse the dev bypass there and to require
  // the Blob token.
  VERCEL_ENV: z.string().optional(),
}).refine(
  env => !(env.AUTH_DEV_BYPASS === '1' && isDeployed(env.VERCEL_ENV)),
  { path: ['AUTH_DEV_BYPASS'], message: 'must never be set in Vercel production or preview' },
).refine(
  env => !(env.RESEND_BASE_URL !== '' && isDeployed(env.VERCEL_ENV)),
  { path: ['RESEND_BASE_URL'], message: 'must never be set in Vercel production or preview' },
).refine(
  env => env.BLOB_READ_WRITE_TOKEN !== '' || !isDeployed(env.VERCEL_ENV),
  { path: ['BLOB_READ_WRITE_TOKEN'], message: 'is required in Vercel production and preview' },
).refine(
  env => new Set([env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT].map(value => value === '')).size === 1,
  { path: ['VAPID_PUBLIC_KEY'], message: 'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set together, or none of them' },
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
