import { betterAuth, type BetterAuthPlugin } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { APIError, createAuthEndpoint, createAuthMiddleware } from 'better-auth/api'
import { setSessionCookie } from 'better-auth/cookies'
import { emailOTP } from 'better-auth/plugins/email-otp'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { USERNAME_MAX, usernameProblem } from '../../shared/username'
import { db } from '../db'
import * as schema from '../db/schema'
import { parseServerEnv } from '../env'
import { isAllowlisted, NOT_ALLOWLISTED, UNVERIFIED_EMAIL } from './allowlist'
import { openSignUpOn } from './open-sign-up'
import { FORGOTTEN_INVITE_COOKIE, joinByInvite, REMEMBERED_INVITE_COOKIE } from './invites'
import { usernameTaken } from './people'
import { spendClientLimit } from './rate-limit'
import { emailSignInOffered, mailSignInCode, SIGN_IN_CODE_MINUTES } from './sign-in-code'

const env = parseServerEnv(process.env)

// The gate on every sign-in, and on every request after it: everyone who has
// an account signs in (#350), as long as Google calls their email verified.
// Better Auth would otherwise create a user whose email Google marks
// unverified.
export function signInRefusal(user: { emailVerified?: unknown }) {
  return user.emailVerified === true ? undefined : UNVERIFIED_EMAIL
}

// The gate on a new user, signing up: as on every sign-in, and Open Sign-up
// is on or the email is on the Allowlist. Both refusals read "Not unlocked".
export async function signUpRefusal(user: { email?: unknown, emailVerified?: unknown }) {
  return signInRefusal(user)
    ?? (isAllowlisted(String(user.email), env.ALLOWLIST_EMAILS) || await openSignUpOn() ? undefined : NOT_ALLOWLISTED)
}

// The only Better Auth endpoints malkochen uses: Google sign-in and its
// callback, email sign-in (asking for a code, signing in with it), the
// session, sign-out and (local dev, tests) the dev sign-in.
// Every other path under /api/auth answers 404, so nobody can, say, set any
// name or image through /update-user (#191). An allowlist, not Better Auth's
// disabledPaths: a built-in endpoint a later Better Auth adds stays off too.
const USED_AUTH_PATHS = new Set(['/sign-in/social', '/callback/google', '/email-otp/send-verification-otp', '/sign-in/email-otp', '/get-session', '/sign-out', '/dev/sign-in'])

// Email sign-in with a code (#345, ADR 0007): a 6-digit code by email, typed
// where sign-in started, plus a link that signs in where it opens. A code
// works once, for SIGN_IN_CODE_MINUTES, and takes 5 wrong tries; asking for
// a new one replaces it. Better Auth limits both endpoints per IP address.
// A user is one user per email address, so an address that signed in with
// Google signs into that account. Only the sign-in kind of code is sent;
// email verification, password reset and changing email are off.
const SIGN_IN_TRIES = 5
// Asking for a code, or signing in with one: calls per minute per IP address.
const EMAIL_SIGN_IN_CALLS_PER_MINUTE = 5
const emailSignIn = emailOTP({
  otpLength: 6,
  expiresIn: SIGN_IN_CODE_MINUTES * 60,
  allowedAttempts: SIGN_IN_TRIES,
  storeOTP: 'hashed',
  rateLimit: { window: 60, max: EMAIL_SIGN_IN_CALLS_PER_MINUTE },
  sendVerificationOTP: async ({ email, otp, type }, ctx) => {
    if (type === 'sign-in') await mailSignInCode(email, otp, ctx?.headers?.get('accept-language') ?? null)
  },
})

// Before a code is sent: only the sign-in kind, and only to an address that
// has an account or that the sign-up gate lets in, so malkochen never emails
// a code that can't be used. A refusal reads "Not unlocked", like a refused
// Google sign-in. New users are checked again on creation
// (validateUserInfo), returning ones on every request
// (server/middleware/auth.ts). Then only so many codes an hour per
// IP address and per address (#347, server/rate-limits.ts); over either,
// 429 "TOO_MANY_CODES" with `retryAt`, when another can be asked for.
const beforeSendingCode = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/email-otp/send-verification-otp') return
  const { email, type } = (ctx.body ?? {}) as { email?: unknown, type?: unknown }
  if (type !== 'sign-in') throw new APIError('BAD_REQUEST', { message: 'Only sign-in codes are sent' })
  const address = String(email ?? '').trim().toLowerCase()
  const known = await ctx.context.internalAdapter.findUserByEmail(address)
  const refusal = !known && await signUpRefusal({ email: address, emailVerified: true })
  if (refusal) throw new APIError('FORBIDDEN', { code: refusal.error, message: refusal.errorDescription })
  // The visitor's IP address as h3's getRequestIP reads it: the first of
  // x-forwarded-for, which Vercel sets.
  const ip = ctx.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const retryAt = await spendClientLimit(ip, 'sign-in-codes-per-ip') ?? await spendClientLimit(address, 'sign-in-codes-per-address')
  if (retryAt) throw new APIError('TOO_MANY_REQUESTS', { code: 'TOO_MANY_CODES', message: 'Too many sign-in codes', retryAt: retryAt.toISOString() })
})

const onlyUsedEndpoints = {
  id: 'only-used-endpoints',
  onRequest: async (request) => {
    const path = new URL(request.url).pathname.replace(/^\/api\/auth/, '')
    if (!USED_AUTH_PATHS.has(path)) return { response: new Response('Not Found', { status: 404 }) }
  },
} satisfies BetterAuthPlugin

// For the dev sign-in: a Username from the first word of `name`, as
// migration 0019 makes one, with the next free number when it is taken.
async function giveUsername(userId: string, name: string, confirmed: boolean) {
  const first = name.trim().split(/\s+/)[0]!.replace(/[^\p{L}\p{M}\d_.-]/gu, '').slice(0, USERNAME_MAX)
  const base = usernameProblem(first) ? 'Koch' : first
  for (let n = 1; ; n++) {
    const username = n === 1 ? base : `${base.slice(0, USERNAME_MAX - String(n).length)}${n}`
    if (await usernameTaken(userId, username)) continue
    await db.update(schema.user).set({ username, usernameConfirmedAt: confirmed ? new Date() : null }).where(eq(schema.user.id, userId))
    return
  }
}

// Local dev and tests only (AUTH_DEV_BYPASS=1, refused on Vercel production
// and preview by server/env.ts): POST /api/auth/dev/sign-in
// { email, name?, image?, emailVerified? } signs in without Google. It goes
// through the same gates (verified email; for a new user, the Allowlist or
// Open Sign-up) and the same user and session creation as a Google sign-in;
// only the OAuth round trip is skipped.
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
        // A new user's Username. Unlike after Google ('none': they pick one
        // first), they get one made from their name, so local dev and the
        // tests start on a Board; 'suggested' leaves it to be confirmed, as
        // migration 0019 left the users from before Usernames.
        username: z.enum(['none', 'suggested', 'picked']).optional(),
      }),
    }, async (ctx) => {
      const { email, name, image, emailVerified = true, username = 'picked' } = ctx.body
      const adapter = ctx.context.internalAdapter
      const existing = (await adapter.findUserByEmail(email))?.user
      // A new user goes through validateUserInfo inside createUser, exactly
      // like a first Google sign-in; a returning one is checked here, like
      // Google's repeat sign-in.
      const refusal = existing && signInRefusal({ emailVerified })
      if (refusal) throw new APIError('FORBIDDEN', { code: refusal.error, message: refusal.errorDescription })

      const user = existing
        ?? await adapter.createUser({ email, name: name ?? email.split('@')[0]!, image, emailVerified }, { method: 'dev-bypass' })
      if (!existing && username !== 'none') await giveUsername(user.id, user.name, username === 'picked')
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
  // Counted in the database (rate_limit), not in memory: every Vercel
  // function instance has its own memory, so a limit kept there is never
  // reached. On in production only, Better Auth's default. The dev sign-in
  // (local dev and tests only) is left out: the tests sign in many times a
  // second, all from one address.
  rateLimit: { storage: 'database', customRules: { '/dev/sign-in': false } },
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
    // The same for their Username and when they confirmed it: only
    // PUT /api/me/username sets them.
    additionalFields: {
      ownPicture: { type: 'string', required: false, input: false },
      username: { type: 'string', required: false, input: false },
      usernameConfirmedAt: { type: 'date', required: false, input: false },
      tourSeen: { type: 'number', required: false, input: false },
      // Their language (#326): only PUT /api/me/language sets it.
      language: { type: 'string', required: false, input: false, defaultValue: 'auto' },
      // The language their browser asked for last (#328): only the API's
      // guard (server/middleware/auth.ts) sets it.
      browserLanguage: { type: 'string', required: false, input: false },
    },
    // Runs on user creation (the sign-up gate) and, for Google, on every
    // repeat sign-in too (the sign-in gate). Gets what Google says about the
    // user, emailVerified included.
    validateUserInfo: ({ user, source }) => source.action === 'create-user' ? signUpRefusal(user) : signInRefusal(user),
  },
  hooks: {
    before: beforeSendingCode,
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
  plugins: [onlyUsedEndpoints, ...(emailSignInOffered ? [emailSignIn] : []), ...(env.AUTH_DEV_BYPASS === '1' ? [devSignIn] : [])],
})

export type SessionUser = typeof auth.$Infer.Session.user
