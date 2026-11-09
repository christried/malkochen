import { asString, httpUrl } from './link'
import { captionOf } from './caption'
import { creatorName } from './creator'
import type { Http } from './http'
import { shortenTitle } from './title'
import { videoEmbed } from '../../shared/video-embed'
import type { Strategy } from './types'

// TikTok (ADR 0011): public oEmbed and the video's embed page, no key. Since
// early November 2026, oEmbed answers with the player alone, without the
// caption, the author or the cover; the embed page still shows them. What
// oEmbed gives wins, the embed page fills the rest. Short links (vm./vt.tiktok.com,
// /t/…) are resolved first; they land on /@/video/<id> without a username,
// which the author's handle fills in.
const HOST = /^(?:www\.|m\.|vm\.|vt\.)?tiktok\.com$/
const POST_PATH = /^\/@([^/]*)\/(video|photo)\/(\d+)/

// Share parameters are all TikTok puts in the query, so it goes entirely.
function canonical(url: URL, username?: string): string {
  const match = url.pathname.match(POST_PATH)
  if (!match) return `${url.origin}${url.pathname}`
  return `https://www.tiktok.com/@${match[1] || username || ''}/${match[2]}/${match[3]}`
}

function isPost(url: URL): boolean {
  return POST_PATH.test(url.pathname)
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

interface EmbedFindings {
  caption: string
  author: string
  username: string
  cover: string | null
}

// The embed page (tiktok.com/embed/<id>) keeps the post in a JSON state
// script, under the page's own route. It isn't an official interface, so
// anything unexpected there (a missing video answers 400, a rate limit 429)
// gives nothing, and the lookup carries on with what oEmbed gave.
const STATE = /<script id="__FRONTITY_CONNECT_STATE__"[^>]*>([\s\S]*?)<\/script>/
// TikTok turns some requests away with 429 at random (about one in four in a
// burst, checked 2026-11-09), and asking again at once mostly gets the page.
const EMBED_ATTEMPTS = 3

async function embedPage(http: Http, id: string): Promise<EmbedFindings | null> {
  let html: string | null = null
  for (let attempt = 0; attempt < EMBED_ATTEMPTS && html === null; attempt++) {
    html = (await http.page(`https://www.tiktok.com/embed/${id}`)).html
  }
  const state = html?.match(STATE)?.[1]
  if (!state) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(state)
  }
  catch {
    return null
  }
  const route = record(record(record(record(parsed)?.source)?.data)?.[`/embed/${id}`])
  const video = record(route?.videoData)
  const item = record(video?.itemInfos)
  if (!item || asString(item.id) !== id) return null
  const author = record(video?.authorInfos)
  const covers = Array.isArray(item.covers) ? item.covers : []
  return {
    caption: asString(item.text),
    author: asString(author?.nickName),
    username: asString(author?.uniqueId),
    cover: covers.map(cover => httpUrl(cover)).find(Boolean) ?? null,
  }
}

// The first value with something in it.
function firstText(...values: string[]): string {
  return values.find(value => value.trim()) ?? ''
}

export const tiktok: Strategy = {
  match(url) {
    if (!HOST.test(url.hostname)) return null
    return { kind: 'tiktok', canonicalLink: canonical(url) }
  },

  async lookup(url, { http }) {
    const post = isPost(url) ? url : await http.resolve(url.href, isPost)
    const id = post.pathname.match(POST_PATH)?.[3]
    const [oembed, embed] = await Promise.all([
      http.json(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical(post))}`),
      id ? embedPage(http, id) : null,
    ])
    const canonicalLink = canonical(post, firstText(asString(oembed?.author_unique_id), embed?.username ?? ''))
    // oEmbed's title is the caption itself.
    const caption = firstText(asString(oembed?.title), embed?.caption ?? '')
    return {
      kind: 'tiktok',
      canonicalLink,
      suggestedTitle: shortenTitle(caption),
      creator: creatorName(oembed?.author_name) ?? creatorName(embed?.author),
      imageUrl: httpUrl(oembed?.thumbnail_url) ?? embed?.cover ?? null,
      caption: captionOf(caption),
      // A photo post has no /video/<id>.
      playableVideo: videoEmbed({ kind: 'tiktok', link: canonicalLink }) !== null,
    }
  },
}
