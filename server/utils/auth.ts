import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthEndpoint, createAuthMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { z } from 'zod'
import { db } from '../db'
import * as schema from '../db/schema'
import { parseServerEnv } from '../env'
import { isAllowlisted, NOT_ALLOWLISTED, UNVERIFIED_EMAIL } from './allowlist'
import { FORGOTTEN_INVITE_COOKIE, joinByInvite, REMEMBERED_INVITE_COOKIE } from './invites'

const env = parseServerEnv(process.env)

function allowlistRefusal(email: string) {
  return isAllowlisted(email, env.ALLOWLIST_EMAILS) ? undefined : NOT_ALLOWLISTED
}

// The gate on every sign-in, and on every request after it: the email must be
// on the Allowlist and verified by Google. Better Auth would otherwise create
// a user whose email Google marks unverified. Both refusals read "Not
// unlocked".
export function signInRefusal(user: { email?: unknown, emailVerified?: unknown }) {
  return user.emailVerified === true ? allowlistRefusal(String(user.email)) : UNVERIFIED_EMAIL
}

// The only Better Auth endpoints malkochen uses: Google sign-in and its
// callback, the session, sign-out and (local dev, tests) the dev sign-in.
// Every other path under /api/auth answers 404, so nobody can, say, set any
// name or image through /update-user (#191). An allowlist, not Better Auth's
// disabledPaths: a built-in endpoint a later Better Auth adds stays off too.
const USED_AUTH_PATHS = new Set(['/sign-in/social', '/callback/google', '/get-session', '/sign-out', '/dev/sign-in'])

const onlyUsedEndpoints = {
  id: 'only-used-endpoints',
  onRequest: async (request) => {
    const path = new URL(request.url).pathname.replace(/^\/api\/auth/, '')
    if (!USED_AUTH_PATHS.has(path)) return { response: new Response('Not Found', { status: 404 }) }
  },
} satisfies BetterAuthPlugin

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
      const adapter = ctx.context.internalAdapter
      const existing = (await adapter.findUserByEmail(email))?.user
      // A new user goes through validateUserInfo inside createUser, exactly
      // like a first Google sign-in; a returning one is checked here, like
      // Google's repeat sign-in.
      const refusal = existing && signInRefusal({ email, emailVerified })
      if (refusal) throw new APIError('FORBIDDEN', { code: refusal.error, message: refusal.errorDescription })

      const user = existing
        ?? await adapter.createUser({ email, name: name ?? email.split('@')[0]!, image, emailVerified }, { method: 'dev-bypass' })
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
    // The user's own Profile Picture (server/utils/people.ts), so the session
    // carries it. Never taken from a sign-in or Better Auth's own endpoints
    // (input: false): only PUT /api/me/picture sets it.
    additionalFields: {
      ownPicture: { type: 'string', required: false, input: false },
    },
    // Runs on user creation and, for Google, on every repeat sign-in too, so
    // someone removed from the Allowlist can't sign in again. Gets what Google
    // says about the user, emailVerified included.
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
  plugins: [onlyUsedEndpoints, ...(env.AUTH_DEV_BYPASS === '1' ? [devSignIn] : [])],
})

export type SessionUser = typeof auth.$Infer.Session.user
