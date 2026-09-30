import { z } from 'zod'

// The one list of environment variables the server needs. Every new variable
// is added here, to .env.example, and to the README's "Environment variables"
// table -- and set in Vercel for production, preview and development.
const serverEnvSchema = z.object({
  // Postgres connection string: Neon in deployed environments, a local
  // Postgres (localhost) in tests and optionally in dev.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
})

type ServerEnv = z.infer<typeof serverEnvSchema>

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source)
  if (!result.success) {
    const problems = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid environment -- check .env against .env.example. ${problems}`)
  }
  return result.data
}
