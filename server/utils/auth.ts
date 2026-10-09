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

// The gate on every sign-in: the email must be on the Allowlist and verified
// by Google. Better Auth would otherwise create a user whose email Google
// marks unverified. Refused the same way, as "Not unlocked".
export function signInRefusal(user: { email?: unknown, emailVerified?: unknown }) {
  return user.emailVerified === true ? allowlistRefusal(String(user.email)) : NOT_ALLOWLISTED
}

// Better Auth's built-in endpoints that malkochen never uses. They answer 404,
// so nobody can, say, set any name or image through /update-user. Kept on:
// /sign-in/social and /callback/:id (Google), /get-session, /sign-out, /ok,
// /error and the dev sign-in. Checked against better-auth 1.7.6
// (dist/api/index.mjs); a new built-in endpoint after an upgrade belongs here
// unless the app uses it. /reset-password/:token can't be listed (only exact
// paths match): it only redirects, and with email and password sign-in off no
// token for it is ever made.
const UNUSED_AUTH_PATHS = [
  '/update-user',
  '/update-session',
  '/change-email',
  '/delete-user',
  '/delete-user/callback',
  '/link-social',
  '/unlink-account',
  '/list-accounts',
  '/account-info',
  '/get-access-token',
  '/refresh-token',
  '/list-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',
  '/sign-up/email',
  '/sign-in/email',
  '/change-password',
  '/set-password',
  '/verify-password',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
  '/verify-email',
]

// Local dev and tests only (AUTH_DEV_BYPASS=1, refused on Vercel production
// and preview by server/env.ts): POST /api/auth/dev/sign-in
// { email, name?, image?, emailVerified? } signs in without Google. It goes
// through the same sign-in gate (Allowlist, verified email) and the
// same user and session creation as a Google sign-in; only the OAuth round
// trip is skipped.
const devSignIn = {
  id: 'dev-sign-in',
  endpoints: {
    devSignIn: createAuthEndpoint('/dev/sign-in', {
      method: 'POST',
      body: z.object({
        email: z.email(),
        name: z.string().min(1).optional(),
        image: z.url().optional(),
        // What Google would say about the email; verified unless told otherwise.
        emailVerified: z.boolean().optional(),
      }),
    }, async (ctx) => {
      const { email, name, image, emailVerified = true } = ctx.body
      const refusal = signInRefusal({ email, emailVerified })
      if (refusal) throw new APIError('FORBIDDEN', { code: refusal.error, message: refusal.errorDescription })

      const adapter = ctx.context.internalAdapter
      const user = (await adapter.findUserByEmail(email))?.user
        ?? await adapter.createUser({ email, name: name ?? email.split('@')[0]!, image, emailVerified: true }, { method: 'dev-bypass' })
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
  disabledPaths: UNUSED_AUTH_PATHS,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    // The user's own Profile Picture (server/utils/people.ts), so the session
    // carries it. Never taken from a sign-in or Better Auth's own endpoints
    // (input: false): only PUT /api/me/picture sets it.
    additionalFields: {
      ownPicture: { type: 'string', required: false, input: false },
    },
    // Runs on user creation and, for Google, on every repeat sign-in too, so
    // someone removed from the Allowlist can't sign in again.
    validateUserInfo: ({ user }) => signInRefusal(user),
  },
  hooks: {
    // A sign-in that goes through joins the remembered invite's Board (PRD
    // stories 4, 5, 64) before the app picks where to land, so a first-time
    // user arriving this way never gets "Meine Küche". A refused sign-in
    // creates no session and keeps the invite for the next try. Not limited
    // like the invite routes' lookups: each try takes a sign-in that goes
    // through.
    after: createAuthMiddleware(async (ctx) => {
      const signedIn = ctx.context.newSession
      const secret = ctx.getCookie(REMEMBERED_INVITE_COOKIE)
      if (!signedIn || !secret) return
      await joinByInvite(secret, signedIn.user.id)
      ctx.setCookie(REMEMBERED_INVITE_COOKIE, '', FORGOTTEN_INVITE_COOKIE)
    }),
  },
  plugins: env.AUTH_DEV_BYPASS === '1' ? [devSignIn] : [],
})

export type SessionUser = typeof auth.$Infer.Session.user
