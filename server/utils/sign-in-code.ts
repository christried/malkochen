import { eq } from 'drizzle-orm'
import { chooseLanguage } from '../../shared/language'
import { db } from '../db'
import { user } from '../db/schema'
import { signInCodeEmail } from '../email'
import { parseServerEnv } from '../env'
import { mailSender } from './mail'

const env = parseServerEnv(process.env)

// Email sign-in with a code (#345, ADR 0007), when the Resend API key is set,
// like the Email Digest. Without it, the sign-in page offers Google only.
const sendEmails = mailSender(reason => console.warn(`[sign-in-code] not sent: ${reason}`))

export const emailSignInOffered = sendEmails !== null

// How long a code works.
export const SIGN_IN_CODE_MINUTES = 10

// Emails `code` to `email`, in the language they chose if they have an
// account, else in the one the browser asking for it wants (`acceptLanguage`).
export async function mailSignInCode(email: string, code: string, acceptLanguage: string | null): Promise<void> {
  if (!sendEmails) return
  const [known] = await db
    .select({ language: user.language, browserLanguage: user.browserLanguage })
    .from(user)
    .where(eq(user.email, email))
  const language = chooseLanguage(known?.language, acceptLanguage ?? (known?.browserLanguage ? [known.browserLanguage] : []))
  const origin = env.BETTER_AUTH_URL.replace(/\/+$/, '')
  await sendEmails([signInCodeEmail({ email, language }, code, SIGN_IN_CODE_MINUTES, origin)])
}
