import { asString, httpUrl, withoutTracking } from './link'
import { shortenTitle } from './title'
import { nothingFound, type SourceGuess, type SourceKind, type Strategy } from './types'

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

export const instagram: Strategy = {
  match(url) {
    if (!HOST.test(url.hostname)) return null
    return guess(url)
  },

  async lookup(url, { http, instagramAccessToken }) {
    const post = SHARE_PATH.test(url.pathname)
      ? postLink(await http.resolve(url.href, hop => postLink(hop) !== null))
      : postLink(url)
    if (!post || !instagramAccessToken) return nothingFound(post ?? guess(url))

    const query = new URLSearchParams({ url: post.canonicalLink, access_token: instagramAccessToken })
    const oembed = await http.json(`${GRAPH_API}?${query}`)
    return {
      ...post,
      suggestedTitle: shortenTitle(asString(oembed?.title)),
      imageUrl: httpUrl(oembed?.thumbnail_url),
    }
  },
}
