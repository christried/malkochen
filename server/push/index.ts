import webpush from 'web-push'
import { stringsFor } from '../../app/strings'
import { boardPath, dishHistoryPath, dishPath } from '../../shared/address'
import type { Language } from '../../shared/language'
import type { SourceKind } from '../source-lookup'

// Push notifications (#219): what a Member's device shows when others added
// Dishes to one of their Boards, or commented and voted on them (#352), and
// how it gets there. Pure apart from the
// push request itself, which goes through `fetch`; the database side is in
// server/utils/push.ts.

// What the service worker (public/sw.js) shows: one notification per Board
// (`tag`), replaced as more Dishes come in, the app address it opens, and
// the Dish's picture when it has one (none for a Placeholder Image).
export interface PushMessage {
  title: string
  body: string
  tag: string
  url: string
  image?: string
}

// A Dish others added: its Username, and for a push its Creator, the kind of
// its Source and its image (null for a Placeholder Image). The Email Digest
// leaves those out.
export interface DishNews {
  title: string
  code: string
  addedBy: string
  creator?: string | null
  kind?: SourceKind | null
  image?: string | null
}

// The Dishes others added to a Board since a Member last opened it, and the
// Comments and Votes they gave on its Dishes (#352).
export interface BoardNews {
  board: { id: string, slug: string, name: string, emoji: string }
  // Newest first.
  dishes: DishNews[]
  // Newest first, each with the Username of who wrote or gave it; none
  // when left out.
  talk?: Talk[]
}

// A Comment (its text) or a Vote (up or down) on a Dish.
export type Talk = { dish: { title: string, code: string, image?: string | null }, by: string } & ({ comment: string } | { up: boolean })

// The platform a Source's kind names in a push (its Creator is shown
// alongside, CONTEXT.md). A blog or another link names none.
const PLATFORMS: Partial<Record<SourceKind, string>> = {
  'tiktok': 'TikTok',
  'instagram-reel': 'Instagram',
  'instagram-post': 'Instagram',
  'youtube-short': 'YouTube',
  'pinterest-pin': 'Pinterest',
}

// How long the body gets with its list of Dish titles: a push carries at
// most 4 KB, and a phone shows a line or two anyway.
const MAX_BODY = 120

// The title names who, on which Board: „Von Mara und Tom in Kochen lecker".
// The body: one Dish with its Creator and platform, or several Dishes as
// many whole titles as fit, then the Comments and Votes counted ("Dazu …")
// when there are some; about Comments and Votes alone, the Dish's start or
// thumb, or their counts over the Dishes they're on. It opens the Dish (at
// its Verlauf when it's about Comments or Votes), or the Board when it's
// about several. The picture is the newest Dish's, or the Dish's of a
// Comment or Vote. In the recipient's `language` (server/utils/people.ts
// recipientLanguage).
export function pushMessage(language: Language, { board, dishes, talk = [] }: BoardNews): PushMessage {
  const t = stringsFor(language).push
  const comments = talk.filter(said => 'comment' in said)
  const votes = talk.length - comments.length
  const talkedAbout = uniqueDishes(talk.map(said => said.dish))
  const about = uniqueDishes([...dishes, ...talkedAbout])
  const [only] = about.length === 1 ? about : []
  const tag = `board-${board.id}`
  const url = !only ? boardPath(board) : talk.length > 0 ? dishHistoryPath(board, only) : dishPath(board, only)
  const title = t.title(names([...dishes.map(d => d.addedBy), ...talk.map(s => s.by)]), board.name)
  const picture = (dishes.length > 0 ? dishes[0]!.image : talk[0]?.dish.image) ?? null
  const shown = picture ? { image: picture } : {}

  if (dishes.length > 0) {
    const withTalk = (text: string) => talk.length > 0 ? t.also(text, comments.length, votes) : text
    const [one] = dishes.length === 1 ? dishes : []
    return {
      title,
      body: one ? withTalk(t.dish(one.title, one.creator ?? null, platformOf(one.kind ?? null))) : fitted((titles, more) => withTalk(t.dishes(dishes.length, titles, more)), dishes.map(d => d.title)),
      tag,
      url,
      ...shown,
    }
  }
  const [said] = talk.length === 1 ? talk : []
  if (said && 'comment' in said) {
    return { title, body: cutComment(text => t.comment(said.dish.title, text), said.comment), tag, url, ...shown }
  }
  if (said) return { title, body: t.vote(said.dish.title, said.up), tag, url, ...shown }
  if (only) return { title, body: t.talkOn(only.title, comments.length, votes), tag, url, ...shown }
  return {
    title,
    body: fitted((titles, more) => t.aboutDishes(comments.length, votes, titles, more), talkedAbout.map(d => d.title)),
    tag,
    url,
    ...shown,
  }
}

const platformOf = (kind: SourceKind | null): string | null => kind ? PLATFORMS[kind] ?? null : null

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
