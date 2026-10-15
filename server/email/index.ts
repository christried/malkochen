import { de } from '../../app/strings/de'
import { boardPath, dishPath } from '../../shared/address'
import type { BoardNews } from '../push'

// The Email Digest (#220): the email a Member who switched it on gets in the
// evening, listing the Dishes others added to their Boards since the last
// one, and how it goes out (Resend's API, through `fetch`). Pure apart from
// that request; who gets one, with which Dishes, is server/utils/email-digest.ts.

export type { BoardNews }

export interface Email {
  to: string
  subject: string
  html: string
  text: string
}

// The verified sending domain at Resend.
export const FROM = 'malkochen <malkochen@christried.me>'

// Where a Member switches it off again: their settings (pages/settings.vue).
const SETTINGS = '/settings'

const escapeHtml = (text: string) => text
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll('\'', '&#39;')

// One email to `to` about each Board's news (each Board with at least one
// Dish, newest first), linking back to the app at `origin`.
export function digestEmail(to: string, boards: BoardNews[], origin: string): Email {
  const t = de.emailDigest
  const count = boards.reduce((sum, b) => sum + b.dishes.length, 0)
  const link = (path: string) => `${origin}${path}`
  const boardName = (board: BoardNews['board']) => `${board.emoji} ${board.name}`

  const text = [
    `${t.heading}`,
    ...boards.flatMap(({ board, dishes }) => [
      '',
      boardName(board),
      ...dishes.map(d => `- ${d.title} (${t.addedBy(d.addedBy)}): ${link(dishPath(board, d))}`),
      `${t.openBoard}: ${link(boardPath(board))}`,
    ]),
    '',
    '--',
    t.why,
    `${t.turnOff}: ${link(SETTINGS)}`,
  ].join('\n')

  const ink = '#131211'
  const muted = '#6B6862'
  const html = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(t.heading)}</title></head>
<body style="margin:0;padding:24px 16px;background:#F7F6F2;color:${ink};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:0 0 16px">${escapeHtml(t.heading)}</h1>
${boards.map(({ board, dishes }) => `<div style="background:#FFFFFF;border-radius:16px;padding:16px 20px;margin:0 0 16px">
<h2 style="font-family:Georgia,serif;font-size:20px;font-weight:600;margin:0 0 8px"><a href="${escapeHtml(link(boardPath(board)))}" style="color:${ink};text-decoration:none">${escapeHtml(boardName(board))}</a></h2>
<ul style="margin:0 0 12px;padding:0 0 0 20px">
${dishes.map(d => `<li style="margin:0 0 4px"><a href="${escapeHtml(link(dishPath(board, d)))}" style="color:${ink}">${escapeHtml(d.title)}</a> <span style="color:${muted}">${escapeHtml(t.addedBy(d.addedBy))}</span></li>`).join('\n')}
</ul>
<a href="${escapeHtml(link(boardPath(board)))}" style="display:inline-block;background:${ink};color:#F7F6F2;border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:600">${escapeHtml(t.openBoard)}</a>
</div>`).join('\n')}
<p style="color:${muted};font-size:13px;margin:24px 0 0">${escapeHtml(t.why)} <a href="${escapeHtml(link(SETTINGS))}" style="color:${muted}">${escapeHtml(t.turnOff)}</a></p>
</div>
</body>
</html>`

  return { to, subject: t.subject(count), html, text }
}

// Who each email reached, and who it didn't (Resend refused the batch or
// couldn't be reached): by address.
export interface SendOutcome {
  sent: string[]
  failed: string[]
}

// Sends emails through Resend. Never rejects.
export type MailSender = (emails: Email[]) => Promise<SendOutcome>

interface MailSenderOptions {
  apiKey: string
  // Resend's API; the API tests stand one in (tests/api/resend-service.ts).
  baseUrl?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  onFailure?: (reason: string) => void
}

// The most emails one call to Resend's batch endpoint takes.
const BATCH = 100

export function createMailSender({ apiKey, baseUrl = 'https://api.resend.com', fetch = globalThis.fetch, timeoutMs = 10_000, onFailure = () => {} }: MailSenderOptions): MailSender {
  async function sendBatch(emails: Email[]): Promise<boolean> {
    try {
      const res = await fetch(`${baseUrl}/emails/batch`, {
        method: 'POST',
        headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(emails.map(({ to, ...email }) => ({ from: FROM, to: [to], ...email }))),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.ok) return true
      onFailure(`Resend answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
      return false
    }
    catch (err) {
      onFailure(`Resend: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  return async (emails) => {
    const outcome: SendOutcome = { sent: [], failed: [] }
    // One batch after the other: Resend limits requests per second.
    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH)
      outcome[await sendBatch(batch) ? 'sent' : 'failed'].push(...batch.map(e => e.to))
    }
    return outcome
  }
}
