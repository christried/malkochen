import webpush from 'web-push'
import { stringsFor, type Strings } from '../../app/strings'
import { boardPath, dishPath } from '../../shared/address'
import type { Language } from '../../shared/language'

// Push notifications (#219): what a Member's device shows when others added
// Dishes to one of their Boards, and how it gets there. Pure apart from the
// push request itself, which goes through `fetch`; the database side is in
// server/utils/push.ts.

// What the service worker (public/sw.js) shows: one notification per Board
// (`tag`), replaced as more Dishes come in, and the app address it opens.
export interface PushMessage {
  title: string
  body: string
  tag: string
  url: string
}

// The Dishes others added to a Board since a Member last opened it.
export interface BoardNews {
  board: { id: string, slug: string, name: string, emoji: string }
  // Newest first, each with the Username of who added it.
  dishes: { title: string, code: string, addedBy: string }[]
}

// How long the body gets with its list of Dish titles: a push carries at
// most 4 KB, and a phone shows a line or two anyway.
const MAX_BODY = 120

// „Chris hat 5 Gerichte hinzugefügt" over „🍪 Kochclub: Dal, Ramen und 3
// weitere", the latest adder named first. About one Dish, the title names
// it and it opens that Dish; about several, the Board. In the recipient's
// `language` (server/utils/people.ts recipientLanguage).
export function pushMessage(language: Language, { board, dishes }: BoardNews): PushMessage {
  const t = stringsFor(language).push
  const adders = [...new Set(dishes.map(d => d.addedBy))]
  const [only] = dishes.length === 1 ? dishes : []
  const boardName = `${board.emoji} ${board.name}`
  return {
    title: t.added(adders, dishes.length, only?.title ?? ''),
    body: only ? boardName : body(t.body, boardName, dishes.map(d => d.title)),
    tag: `board-${board.id}`,
    url: only ? dishPath(board, only) : boardPath(board),
  }
}

// The Board, then as many whole titles as fit and how many more. A first
// title too long on its own is cut to fit (by characters, never inside an
// emoji). `listed` writes it in the recipient's language.
function body(listed: Strings['push']['body'], boardName: string, titles: string[]): string {
  const listing = (shown: number) => listed(boardName, titles.slice(0, shown), titles.length - shown)
  let shown = 0
  while (shown < titles.length && listing(shown + 1).length <= MAX_BODY) shown++
  if (shown > 0) return listing(shown)
  const cut = (length: number) => listed(boardName, [`${[...titles[0]!].slice(0, length).join('')} …`], titles.length - 1)
  let length = MAX_BODY
  while (length > 1 && cut(length).length > MAX_BODY) length--
  return cut(length)
}

// The push services of the browsers malkochen runs in: Chrome and Android
// (FCM), Firefox, Edge (WNS) and Safari. A subscription elsewhere is refused,
// so the server never posts to an address a client made up.
const PUSH_SERVICES = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
]

// Whether `endpoint` is a push service's address. `anyService`: local dev
// and tests, whose devices subscribe on a stand-in, over http too.
export function isPushEndpoint(endpoint: string, { anyService = false } = {}): boolean {
  if (!URL.canParse(endpoint)) return false
  const { protocol, hostname } = new URL(endpoint)
  if (anyService) return protocol === 'https:' || protocol === 'http:'
  return protocol === 'https:' && PUSH_SERVICES.some(service => service.test(hostname))
}

// A device's subscription, as stored.
export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

export interface Vapid {
  subject: string
  publicKey: string
  privateKey: string
}

// 'gone': the push service says the subscription expired or was
// withdrawn (404, 410), so it is to be deleted. 'failed': anything else that
// kept it from arriving; the subscription may still work next time.
export type PushOutcome = 'sent' | 'gone' | 'failed'

// Sends a message to one device: encrypted for it and signed with the app's
// VAPID key (web-push does both), posted with `fetch`. Never rejects.
export type PushSender = (target: PushTarget, message: PushMessage) => Promise<PushOutcome>

interface PushSenderOptions {
  vapid: Vapid
  fetch?: typeof globalThis.fetch
  // How long a push service gets to answer: adding a Dish waits for it.
  timeoutMs?: number
  onFailure?: (reason: string) => void
}

// A day: a phone that is off longer than that doesn't need old news.
const TTL_SECONDS = 24 * 60 * 60

export function createPushSender({ vapid, fetch = globalThis.fetch, timeoutMs = 3_000, onFailure = () => {} }: PushSenderOptions): PushSender {
  return async (target, message) => {
    const host = URL.canParse(target.endpoint) ? new URL(target.endpoint).host : 'an invalid endpoint'
    try {
      const request = webpush.generateRequestDetails(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(message),
        {
          vapidDetails: vapid,
          contentEncoding: 'aes128gcm',
          TTL: TTL_SECONDS,
          // A push not yet delivered is replaced by the next one about the
          // same Board, like the notification itself (a topic is at most 32
          // base64url characters: the Board's id without its dashes).
          topic: message.tag.replace(/^board-/, '').replaceAll('-', ''),
        },
      )
      // fetch sets it itself, from the body.
      const { 'Content-Length': _, ...headers } = request.headers as Record<string, string>
      const res = await fetch(request.endpoint, {
        method: 'POST',
        headers,
        body: request.body && new Uint8Array(request.body),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.ok) return 'sent'
      if (res.status === 404 || res.status === 410) return 'gone'
      onFailure(`${host} answered ${res.status}`)
      return 'failed'
    }
    catch (err) {
      onFailure(`${host}: ${err instanceof Error ? err.message : String(err)}`)
      return 'failed'
    }
  }
}
