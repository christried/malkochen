import { httpUrl, text, withoutTracking } from './link'
import { shortenTitle } from './title'
import type { SourceKind, Strategy } from './types'

// Instagram: Meta's instagram_oembed with an app access token. Meta has
// removed fields from it before; with no token, an error, or missing fields
// it degrades to "no title, no image" (the Placeholder Image picker covers it).
const GRAPH_API = 'https://graph.facebook.com/v23.0/instagram_oembed'
const HOST = /^(?:www\.|m\.)?(?:instagram\.com|instagr\.am)$/
// /reel/<code>, /reels/<code>, /p/<code>, /tv/<code>, optionally after a
// /<username>/ prefix.
const POST_PATH = /^\/(?!share\/)(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/
// Share links carry their own code and redirect to the post.
const SHARE_PATH = /^\/share\/(reels?|p)\//

function kindOf(segment: string): SourceKind {
  return segment === 'p' ? 'instagram-post' : 'instagram-reel'
}

function parse(url: URL): { kind: SourceKind, canonicalLink: string } | null {
  const match = url.pathname.match(POST_PATH)
  if (!match || match[1] === undefined || match[2] === undefined) return null
  return {
    kind: kindOf(match[1]),
    canonicalLink: `https://www.instagram.com/${match[1] === 'p' ? 'p' : 'reel'}/${match[2]}/`,
  }
}

// What a link says about itself before any request.
function guess(url: URL): { kind: SourceKind, canonicalLink: string } {
  const share = url.pathname.match(SHARE_PATH)?.[1]
  if (share) return { kind: kindOf(share), canonicalLink: withoutTracking(url) }
  return parse(url) ?? { kind: 'other', canonicalLink: withoutTracking(url) }
}

export const instagram: Strategy = {
  match(url) {
    if (!HOST.test(url.hostname)) return null
    return guess(url)
  },

  async lookup(url, { http, instagramAccessToken }) {
    const post = SHARE_PATH.test(url.pathname) ? parse(await http.resolve(url.href, hop => parse(hop) !== null)) : parse(url)
    if (!post || !instagramAccessToken) return { ...(post ?? guess(url)), suggestedTitle: '', imageUrl: null }

    const query = new URLSearchParams({ url: post.canonicalLink, access_token: instagramAccessToken })
    const oembed = await http.json(`${GRAPH_API}?${query}`)
    return {
      ...post,
      suggestedTitle: shortenTitle(text(oembed?.title)),
      imageUrl: httpUrl(oembed?.thumbnail_url),
    }
  },
}
