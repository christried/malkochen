import { createMailSender, type MailSender } from '../email'
import { parseServerEnv } from '../env'
import { countUsage } from './usage'

const env = parseServerEnv(process.env)

// Sends through Resend when the API key is set (null otherwise), and counts
// every email Resend took, for the Admin Page (#348). `onFailure` is told why
// a batch didn't go out.
export function mailSender(onFailure: (reason: string) => void): MailSender | null {
  if (!env.RESEND_API_KEY) return null
  const send = createMailSender({ apiKey: env.RESEND_API_KEY, baseUrl: env.RESEND_BASE_URL || undefined, onFailure })
  return async (emails) => {
    const outcome = await send(emails)
    // Like the sender itself, never rejects: a count missed is no email missed.
    await countUsage('email', outcome.sent.length).catch(error => console.warn(`[usage] emails not counted: ${error}`))
    return outcome
  }
}
