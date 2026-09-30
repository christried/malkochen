import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthEndpoint, createAuthMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { db } from '../db'
import * as schema from '../db/schema'
import { parseServerEnv } from '../env'
import { isAllowlisted, NOT_ALLOWLISTED } from './allowlist'
import { FORGOTTEN_INVITE_COOKIE, joinByInvite, REMEMBERED_INVITE_COOKIE } from './invites'

const env = parseServerEnv(process.env)

export function allowlistRefusal(email: string) {
  return isAllowlisted(email, env.ALLOWLIST_EMAILS) ? undefined : NOT_ALLOWLISTED
}

// Local dev and tests only (AUTH_DEV_BYPASS=1, refused on Vercel production
// and preview by server/env.ts): POST /api/auth/dev/sign-in { email, name? }
// signs in without Google. It goes through the same Allowlist gate and the
// same user and session creation as a Google sign-in; only the OAuth round
// trip is skipped.
const devSignIn = {
  id: 'dev-sign-in',
  endpoints: {
    devSignIn: createAuthEndpoint('/dev/sign-in', {
      method: 'POST',
      body: z.object({ email: z.email(), name: z.string().min(1).optional() }),
    }, async (ctx) => {
      const { email, name } = ctx.body
      const refusal = allowlistRefusal(email)
      if (refusal) throw new APIError('FORBIDDEN', { code: refusal.error, message: refusal.errorDescription })

      const adapter = ctx.context.internalAdapter
      const user = (await adapter.findUserByEmail(email))?.user
        ?? await adapter.createUser({ email, name: name ?? email.split('@')[0]!, emailVerified: true }, { method: 'dev-bypass' })
      const session = await adapter.createSession(user.id)
      await setSessionCookie(ctx, { session, user })
      return ctx.json({ userId: user.id })
    }),
  },
} satisfies BetterAuthPlugin

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // A refused Google sign-in (and any other OAuth error) redirects here as
  // /login?error=<code>, instead of to Better Auth's own error page.
  onAPIError: { errorURL: '/login' },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    // Runs on user creation and, for Google, on every repeat sign-in too, so
    // someone removed from the Allowlist can't sign in again.
    validateUserInfo: ({ user }) => allowlistRefusal(String(user.email)),
  },
  hooks: {
    // A sign-in that goes through joins the remembered invite's Board (PRD
    // stories 4, 5, 64) before the app picks where to land, so a first-time
    // user arriving this way never gets "Meine Küche". A refused sign-in
    // creates no session and keeps the invite for the next try.
    after: createAuthMiddleware(async (ctx) => {
      const signedIn = ctx.context.newSession
      const token = ctx.getCookie(REMEMBERED_INVITE_COOKIE)
      if (!signedIn || !token) return
      await joinByInvite(token, signedIn.user.id)
      ctx.setCookie(REMEMBERED_INVITE_COOKIE, '', FORGOTTEN_INVITE_COOKIE)
    }),
  },
  plugins: env.AUTH_DEV_BYPASS === '1' ? [devSignIn] : [],
})

export type SessionUser = typeof auth.$Infer.Session.user
