import { stringsFor } from '../../app/strings'
import { boardPath, dishHistoryPath, dishPath } from '../../shared/address'
import type { Language } from '../../shared/language'
import type { BoardNews, Talk } from '../push'

// The emails malkochen sends, and how they go out (Resend's API, through
// `fetch`): the Email Digest (#220), which a Member who switched it on gets
// in the evening, listing the Dishes others added to their Boards since the
// last one and the Comments and Votes they gave (#353), the sign-in code (#345) and the confirmation of a deleted
// account (#346). Pure apart from that request; who
// gets a digest, with which Dishes, is server/utils/email-digest.ts.

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

// The colours every email is written in.
const INK = '#131211'
const MUTED = '#6B6862'

// An email's whole HTML document around its `content`, in `language`;
// `preheader` is the inbox's preview line, if it has its own.
function emailPage(language: Language, subject: string, content: string, preheader?: string): string {
  return `<!doctype html>
<html lang="${language}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 16px;background:#F7F6F2;color:${INK};font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;line-height:1.5">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}</div>
` : ''}<div style="max-width:560px;margin:0 auto">
${content}
</div>
</body>
</html>`
}

// Who an email goes to: their address, their Username to greet them with
// (null before they picked one) and the language it's written in (theirs,
// server/utils/people.ts recipientLanguage).
export interface Recipient {
  email: string
  name: string | null
  language: Language
}

// How much of a Comment the Digest shows (#353).
const COMMENT_START = 100

// The start of a Comment, on one line: as many whole words as fit in
// COMMENT_START characters, then „ …". A first word too long on its own is
// cut inside it, never inside an emoji.
function commentStart(comment: string): string {
  const text = [...comment.trim().replace(/\s+/g, ' ')]
  if (text.length <= COMMENT_START) return text.join('')
  const cut = text.slice(0, COMMENT_START + 1).join('')
  const atWord = cut.lastIndexOf(' ')
  return `${atWord > 0 ? cut.slice(0, atWord) : text.slice(0, COMMENT_START).join('')} …`
}

// One email to `to` about each Board's news (in the order given, each Board
// with at least one Dish, Comment or Vote): its new Dishes, then the
// Comments and Votes on its Dishes („Im Verlauf", #353), each newest first,
// linking back to the app at `origin`.
export function digestEmail(to: Recipient, boards: BoardNews[], origin: string): Email {
  const t = stringsFor(to.language).emailDigest
  const count = boards.reduce((sum, b) => sum + b.dishes.length, 0)
  const talk = boards.flatMap(b => b.talk ?? [])
  const comments = talk.filter(one => 'comment' in one).length
  const link = (path: string) => `${origin}${path}`
  const boardName = (board: BoardNews['board']) => `${board.emoji} ${board.name}`
  const onlyBoard = boards.length === 1 ? boardName(boards[0]!.board) : null
  // Without new Dishes, the Comments and Votes are counted instead.
  const subject = count > 0 ? t.subject(count, onlyBoard) : t.talkSubject(comments, talk.length - comments, onlyBoard)
  const names = [...new Set(boards.flatMap(b => [...b.dishes.map(d => d.addedBy), ...(b.talk ?? []).map(one => one.by)]))]
  const greeting = t.greeting(to.name)
  // A Comment or Vote as its line, with `dish` as given (a link in the
  // HTML) and what Members typed through `escape`.
  const line = (one: Talk, dish: string, escape: (text: string) => string) => 'comment' in one
    ? t.comment(escape(one.by), dish, escape(commentStart(one.comment)))
    : t.voted(escape(one.by), dish, one.up)

  const text = [
    greeting,
    t.intro,
    ...boards.flatMap(({ board, dishes, talk = [] }) => [
      '',
      boardName(board),
      ...dishes.map(d => `- ${d.title} (${t.addedBy(d.addedBy)}): ${link(dishPath(board, d))}`),
      ...talk.length > 0 ? [t.history, ...talk.map(one => `- ${line(one, one.dish.title, text => text)}\n  ${link(dishHistoryPath(board, one.dish))}`)] : [],
      `${t.openBoard}: ${link(boardPath(board))}`,
    ]),
    '',
    t.why,
    `${t.noMore} ${t.turnOff}: ${link(SETTINGS)}`,
  ].join('\n')

  const html = emailPage(to.language, subject, `<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:0 0 4px">${escapeHtml(greeting)}</h1>
<p style="margin:0 0 16px">${escapeHtml(t.intro)}</p>
${boards.map(({ board, dishes, talk = [] }) => `<div style="background:#FFFFFF;border-radius:16px;padding:16px 20px;margin:0 0 16px">
<h2 style="font-family:Georgia,serif;font-size:20px;font-weight:600;margin:0 0 8px"><a href="${escapeHtml(link(boardPath(board)))}" style="color:${INK};text-decoration:none">${escapeHtml(boardName(board))}</a></h2>
${dishes.length > 0 ? `<ul style="margin:0 0 12px;padding:0 0 0 20px">
${dishes.map(d => `<li style="margin:0 0 4px"><a href="${escapeHtml(link(dishPath(board, d)))}" style="color:${INK}">${escapeHtml(d.title)}</a> <span style="color:${MUTED}">${escapeHtml(t.addedBy(d.addedBy))}</span></li>`).join('\n')}
</ul>
` : ''}${talk.length > 0 ? `<h3 style="font-size:14px;font-weight:600;color:${MUTED};margin:0 0 4px">${escapeHtml(t.history)}</h3>
<ul style="margin:0 0 12px;padding:0 0 0 20px">
${talk.map(one => `<li style="margin:0 0 4px">${line(one, `<a href="${escapeHtml(link(dishHistoryPath(board, one.dish)))}" style="color:${INK}">${escapeHtml(one.dish.title)}</a>`, escapeHtml)}</li>`).join('\n')}
</ul>
` : ''}<a href="${escapeHtml(link(boardPath(board)))}" style="display:inline-block;background:${INK};color:#F7F6F2;border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:600">${escapeHtml(t.openBoard)}</a>
</div>`).join('\n')}
<p style="color:${MUTED};font-size:13px;margin:24px 0 0">${escapeHtml(t.why)} ${escapeHtml(t.noMore)} <a href="${escapeHtml(link(SETTINGS))}" style="color:${MUTED}">${escapeHtml(t.turnOff)}</a>.</p>`, t.preheader(names))

  return { to: to.email, subject, html, text }
}

// Where the link in a sign-in email leads: the sign-in page, which signs in
// with the code it carries (app/pages/login.vue).
export function signInLinkPath(email: string, code: string): string {
  return `/login?${new URLSearchParams({ email, code })}`
}

// The email with a sign-in code (#345, ADR 0007): the code to type where
// sign-in started, valid for `minutes`, and a link at `origin` that signs in
// wherever it opens.
export function signInCodeEmail(to: { email: string, language: Language }, code: string, minutes: number, origin: string): Email {
  const t = stringsFor(to.language).signInEmail
  const subject = t.subject(code)
  const link = `${origin}${signInLinkPath(to.email, code)}`

  const text = [
    t.headline,
    '',
    t.intro,
    code,
    t.expires(minutes),
    '',
    `${t.linkIntro} ${link}`,
    '',
    t.notYou,
  ].join('\n')

  const html = emailPage(to.language, subject, `<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:0 0 4px">${escapeHtml(t.headline)}</h1>
<p style="margin:0 0 16px">${escapeHtml(t.intro)}</p>
<div style="background:#FFFFFF;border-radius:16px;padding:16px 20px;margin:0 0 8px;text-align:center">
<p style="font-family:Menlo,Consolas,monospace;font-size:32px;font-weight:600;letter-spacing:8px;margin:0">${escapeHtml(code)}</p>
</div>
<p style="color:${MUTED};font-size:14px;margin:0 0 24px">${escapeHtml(t.expires(minutes))}</p>
<p style="margin:0 0 8px">${escapeHtml(t.linkIntro)}</p>
<a href="${escapeHtml(link)}" style="display:inline-block;background:${INK};color:#F7F6F2;border-radius:999px;padding:8px 18px;text-decoration:none;font-weight:600">${escapeHtml(t.link)}</a>
<p style="color:${MUTED};font-size:13px;margin:24px 0 0">${escapeHtml(t.notYou)}</p>`)

  return { to: to.email, subject, html, text }
}

// The email confirming that `to` deleted their account (#346), greeting them
// by the Username they had.
export function accountDeletedEmail(to: { email: string, name: string, language: Language }): Email {
  const t = stringsFor(to.language).accountDeletedEmail
  const greeting = t.greeting(to.name)
  const text = [t.headline, '', greeting, '', t.kept, '', t.again, '', t.notYou].join('\n')
  const html = emailPage(to.language, t.subject, `<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:600;margin:0 0 4px">${escapeHtml(t.headline)}</h1>
<p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px">${escapeHtml(t.kept)}</p>
<p style="margin:0 0 16px">${escapeHtml(t.again)}</p>
<p style="color:${MUTED};font-size:13px;margin:24px 0 0">${escapeHtml(t.notYou)}</p>`)
  return { to: to.email, subject: t.subject, html, text }
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
const BATCH_SIZE = 100

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
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE)
      outcome[await sendBatch(batch) ? 'sent' : 'failed'].push(...batch.map(e => e.to))
    }
    return outcome
  }
}
