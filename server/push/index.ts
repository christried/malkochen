import webpush from 'web-push'
import { stringsFor } from '../../app/strings'
import { boardPath, dishHistoryPath, dishPath } from '../../shared/address'
import type { Language } from '../../shared/language'

// Push notifications (#219): what a Member's device shows when others added
// Dishes to one of their Boards, or commented and voted on them (#352), and
// how it gets there. Pure apart from the
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

// The Dishes others added to a Board since a Member last opened it, and the
// Comments and Votes they gave on its Dishes (#352).
export interface BoardNews {
  board: { id: string, slug: string, name: string, emoji: string }
  // Newest first, each with the Username of who added it.
  dishes: { title: string, code: string, addedBy: string }[]
  // Newest first, each with the Username of who wrote or gave it; none
  // when left out.
  talk?: Talk[]
}

// A Comment (its text) or a Vote (up or down) on a Dish.
export type Talk = { dish: { title: string, code: string }, by: string } & ({ comment: string } | { up: boolean })

// How long the body gets with its list of Dish titles: a push carries at
// most 4 KB, and a phone shows a line or two anyway.
const MAX_BODY = 120

// „Chris hat 5 Gerichte hinzugefügt" over „🍪 Kochclub: Dal, Ramen und 3
// weitere", the latest adder named first, then how many Comments and Votes
// there are too (#351). Without new Dishes: about one Comment or Vote, who
// and on which Dish (and the Comment's start); about more on one Dish, who
// and how many; about several Dishes, who wrote (else gave) how many, and
// on which. About one Dish it opens that Dish, at its Verlauf when it's
// about Comments or Votes; about several, the Board. In the recipient's
// `language` (server/utils/people.ts recipientLanguage).
export function pushMessage(language: Language, { board, dishes, talk = [] }: BoardNews): PushMessage {
  const t = stringsFor(language).push
  const boardName = `${board.emoji} ${board.name}`
  const comments = talk.filter(said => 'comment' in said)
  const votes = talk.length - comments.length
  const talkedAbout = uniqueDishes(talk.map(said => said.dish))
  const about = uniqueDishes([...dishes, ...talkedAbout])
  const [only] = about.length === 1 ? about : []
  const tag = `board-${board.id}`
  const url = !only ? boardPath(board) : talk.length > 0 ? dishHistoryPath(board, only) : dishPath(board, only)

  if (dishes.length > 0) {
    const withTalk = (text: string) => talk.length > 0 ? t.also(text, comments.length, votes) : text
    const [one] = dishes.length === 1 ? dishes : []
    return {
      title: t.added(names(dishes.map(d => d.addedBy)), dishes.length, one?.title ?? ''),
      body: one ? withTalk(boardName) : fitted((titles, more) => withTalk(t.body(boardName, titles, more)), dishes.map(d => d.title)),
      tag,
      url,
    }
  }
  const [said] = talk.length === 1 ? talk : []
  if (said && 'comment' in said) {
    return { title: t.commented(said.by, said.dish.title), body: cutComment(text => t.comment(boardName, text), said.comment), tag, url }
  }
  if (said) return { title: t.voted(said.by, said.dish.title, said.up), body: boardName, tag, url }
  if (only) return { title: t.onDish(names(talk.map(s => s.by)), only.title), body: t.counts(boardName, comments.length, votes), tag, url }
  return {
    title: comments.length > 0 ? t.wrote(names(comments.map(c => c.by)), comments.length) : t.gave(names(talk.map(s => s.by)), votes),
    body: fitted((titles, more) => {
      const on = t.about(boardName, titles, more)
      return comments.length > 0 && votes > 0 ? t.also(on, 0, votes) : on
    }, talkedAbout.map(d => d.title)),
    tag,
    url,
  }
}

// Each once, in the order first named.
const names = (all: string[]) => [...new Set(all)]

function uniqueDishes<D extends { code: string }>(all: D[]): D[] {
  const byCode = new Map<string, D>()
  for (const dish of all) if (!byCode.has(dish.code)) byCode.set(dish.code, dish)
  return [...byCode.values()]
}

// The first `length` characters of `text`, never cut inside an emoji, then „ …".
const cutTo = (text: string, length: number) => `${[...text].slice(0, length).join('')} …`

// What `write` makes of as many whole titles as fit and how many more. A
// first title too long on its own is cut to fit.
function fitted(write: (titles: string[], more: number) => string, titles: string[]): string {
  const listing = (shown: number) => write(titles.slice(0, shown), titles.length - shown)
  let shown = 0
  while (shown < titles.length && listing(shown + 1).length <= MAX_BODY) shown++
  if (shown > 0) return listing(shown)
  const cut = (length: number) => write([cutTo(titles[0]!, length)], titles.length - 1)
  let length = MAX_BODY
  while (length > 1 && cut(length).length > MAX_BODY) length--
  return cut(length)
}

// What `write` makes of as much of a Comment as fits, on one line: whole
// words, then „ …". A first word too long on its own is cut to fit.
function cutComment(write: (text: string) => string, comment: string): string {
  const words = comment.trim().split(/\s+/)
  for (let shown = words.length; shown > 0; shown--) {
    const text = write(shown === words.length ? words.join(' ') : `${words.slice(0, shown).join(' ')} …`)
    if (text.length <= MAX_BODY) return text
  }
  let length = MAX_BODY
  while (length > 1 && write(cutTo(words[0]!, length)).length > MAX_BODY) length--
  return write(cutTo(words[0]!, length))
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
