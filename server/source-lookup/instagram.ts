import { captionOf } from './caption'
import { creatorName } from './creator'
import { decodeEntities, findTag, metaTags } from './html'
import type { Http } from './http'
import { httpUrl, withoutTracking } from './link'
import { shortenTitle } from './title'
import { nothingFound, type SourceGuess, type SourceKind, type SourceLookupResult, type Strategy } from './types'

// Instagram (ADR 0005): the Reel's or post's embed page shows a server what
// the post page hides from it: the caption (its first line becomes the
// Suggested Title), the account that posted it (the Creator) and the cover
// without a play button, twice the size of og:image. The embed page isn't an
// official interface, so when it fails or shows none of that, the image
// comes from the post page's og:image, as before ADR 0005. A login wall on
// both gives no image. No Meta app, no token (ADR 0001).
const HOST = /^(?:www\.|m\.)?(?:instagram\.com|instagr\.am)$/
// /reel/<code>, /reels/<code>, /p/<code>, /tv/<code>, optionally after a
// /<username>/ prefix.
const POST_PATH = /^\/(?!share\/)(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/
// Share links carry their own code and redirect to the post.
const SHARE_PATH = /^\/share\/(reels?|p)\//

function kindOf(segment: string): SourceKind {
  return segment === 'p' ? 'instagram-post' : 'instagram-reel'
}

// A post link (not a share link), normalised.
function postLink(url: URL): SourceGuess | null {
  const match = url.pathname.match(POST_PATH)
  if (!match || match[1] === undefined || match[2] === undefined) return null
  return {
    kind: kindOf(match[1]),
    canonicalLink: `https://www.instagram.com/${match[1] === 'p' ? 'p' : 'reel'}/${match[2]}/`,
  }
}

// What any Instagram link says about itself before any request.
function guess(url: URL): SourceGuess {
  const share = url.pathname.match(SHARE_PATH)?.[1]
  if (share) return { kind: kindOf(share), canonicalLink: withoutTracking(url) }
  return postLink(url) ?? { kind: 'other', canonicalLink: withoutTracking(url) }
}

// The caption as text, one line per line break. In the embed page it is the
// "Caption" block: the account's name as a link, then the caption with <br>
// for line breaks and links for hashtags and mentions, then the comments
// link in a block of its own.
function caption(html: string): string {
  const block = findTag(html, 'div', 'Caption')
  if (!block) return ''
  const rest = html.slice(block.end)
  let markup = rest.slice(0, rest.search(/<\/?div\b|$/i))
  const account = findTag(markup, 'a', 'CaptionUsername')
  if (account) {
    const close = markup.indexOf('</a>', account.end)
    markup = markup.slice(0, account.start) + (close < 0 ? '' : markup.slice(close + '</a>'.length))
  }
  return decodeEntities(markup
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
}

// The account that posted it, as the embed page's header names it.
function username(html: string): string | null {
  const span = findTag(html, 'span', 'UsernameText')
  return span && decodeEntities(html.slice(span.end).split('<', 1)[0] ?? '')
}

type Findings = Omit<SourceLookupResult, keyof SourceGuess | 'playableVideo'>

// The embed page gets half the lookup's time, so the post page still can
// answer when it stalls.
async function embedPage(http: Http, post: SourceGuess, timeoutMs: number): Promise<Findings> {
  const html = (await http.page(`${post.canonicalLink}embed/captioned/`, { timeoutMs: timeoutMs / 2 })).html ?? ''
  return {
    suggestedTitle: shortenTitle(caption(html)),
    creator: creatorName(username(html)),
    imageUrl: httpUrl(findTag(html, 'img', 'EmbeddedMediaImage')?.attrs.src),
    caption: captionOf(caption(html)),
  }
}

// The post page's og:image (or twitter:image), shown to servers without a
// login. Its caption never is ("caption":null).
async function postPageImage(http: Http, post: SourceGuess): Promise<string | null> {
  const meta = metaTags((await http.page(post.canonicalLink)).html ?? '')
  return httpUrl(meta.get('og:image')) ?? httpUrl(meta.get('twitter:image'))
}

// Whether Instagram's embed plays a post's video in place (#279, checked when
// a Dish is added since #394), as the
// Dish detail's player would load it (shared/video-embed.ts). For some
// Reels, often ones with licensed music, Instagram's embed shows only the
// cover and "Auf Instagram ansehen", which opens Instagram; it says so in a
// "WatchOnInstagramContainer" block (checked 2026-10-16). The embed page
// tells the player nothing different, so only the page shows it. Null: not
// an Instagram post, or the page showed neither (broken, unreachable), and
// the player finds out itself. Photo posts and carousels (their embed's
// data-media-type isn't GraphVideo) play no video: false.
export async function playsInPlace(http: Http, link: string): Promise<boolean | null> {
  let url: URL
  try {
    url = new URL(link)
  }
  catch {
    return null
  }
  const post = HOST.test(url.hostname) ? postLink(url) : null
  if (!post) return null
  const html = (await http.page(`${post.canonicalLink}embed/`)).html ?? ''
  if (findTag(html, 'div', 'WatchOnInstagramContainer')) return false
  const mediaType = html.match(/data-media-type="([^"]*)"/)?.[1]
  if (mediaType !== undefined && mediaType !== 'GraphVideo') return false
  return findTag(html, 'a', 'EmbeddedMedia') ? true : null
}

export const instagram: Strategy = {
  match(url) {
    if (!HOST.test(url.hostname)) return null
    return guess(url)
  },

  async lookup(url, { http, timeoutMs }) {
    const post = SHARE_PATH.test(url.pathname)
      ? postLink(await http.resolve(url.href, hop => postLink(hop) !== null))
      : postLink(url)
    if (!post) return nothingFound(guess(url))

    const [embed, played] = await Promise.all([embedPage(http, post, timeoutMs), playsInPlace(http, post.canonicalLink)])
    return { ...post, ...embed, playableVideo: played === true, imageUrl: embed.imageUrl ?? await postPageImage(http, post) }
  },
}
